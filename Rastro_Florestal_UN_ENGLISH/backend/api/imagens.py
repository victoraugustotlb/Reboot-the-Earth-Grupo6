"""Earth Engine visualizations for the MVP. Temporary URLs are not official evidence."""
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from api.earth_engine import iniciar_ee

router = APIRouter(prefix='/imagens', tags=['Satellite imagery'])

class ImagensRequest(BaseModel):
    latitude: float = Field(default=-12.5, ge=-90, le=90)
    longitude: float = Field(default=-54.5, ge=-180, le=180)
    raio_metros: int = Field(default=1000, ge=100, le=5000)
    ano_inicial: int = Field(default=2024, ge=2017, le=2030)
    ano_final: int = Field(default=2025, ge=2017, le=2030)
    poligono_autorizado: dict[str, Any] | None = None

    @model_validator(mode='after')
    def validar(self):
        if self.ano_final <= self.ano_inicial:
            raise ValueError('end year must be later than start year')
        if self.poligono_autorizado is not None and self.poligono_autorizado.get('type') not in ('Polygon','MultiPolygon'):
            raise ValueError('Use GeoJSON Polygon or MultiPolygon')
        return self

@router.post('/satelite')
def imagens_satelite(pedido: ImagensRequest):
    try:
        ee = iniciar_ee()
        area = ee.Geometry.Point([pedido.longitude, pedido.latitude]).buffer(pedido.raio_metros)
        autorizado = ee.Geometry(pedido.poligono_autorizado) if pedido.poligono_autorizado else None
        regiao = area.bounds(1)

        def filtrar_nuvem(imagem):
            scl = imagem.select('SCL')
            valido = (scl.neq(0).And(scl.neq(1)).And(scl.neq(3))
                      .And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11)))
            return imagem.updateMask(valido)

        def imagem_ano(ano):
            col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                   .filterBounds(area)
                   .filterDate(f'{ano}-06-01', f'{ano}-10-01')
                   .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80)))
            quantidade = col.size().getInfo()
            if quantidade == 0:
                raise ValueError(f'No Sentinel-2 scenes found in {ano}')
            return col.map(filtrar_nuvem).median().clip(area), quantidade

        antes, n_antes = imagem_ano(pedido.ano_inicial)
        depois, n_depois = imagem_ano(pedido.ano_final)

        # Dynamic World: class 1 = trees. Use the same change rule as the analytical endpoint.
        def classes_ano(ano):
            col = (ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                   .filterBounds(area)
                   .filterDate(f'{ano}-06-01', f'{ano}-10-01')
                   .select('label'))
            if col.size().getInfo() == 0:
                raise ValueError(f'No Dynamic World scenes found in {ano}')
            return col.mode().clip(area)

        classe_antes = classes_ano(pedido.ano_inicial)
        classe_depois = classes_ano(pedido.ano_final)
        mudanca = classe_antes.eq(1).And(classe_depois.neq(1)).selfMask()

        # B4=red, B3=green, B2=blue; surface reflectance scaled by 10,000.
        visual = {'bands': ['B4','B3','B2'], 'min': 0, 'max': 3000, 'gamma': 1.2}
        rgb_antes = antes.visualize(**visual)
        rgb_depois = depois.visualize(**visual)
        # Orange = land-cover class change; blue = declared boundary. Neither implies a violation.
        sobreposicao = rgb_depois.blend(mudanca.visualize(palette=['ff8c00'], opacity=0.75))
        if autorizado is not None:
            linha = ee.Image().byte().paint(autorizado, 1, 2).selfMask()
            sobreposicao = sobreposicao.blend(linha.visualize(palette=['1967d2']))

        parametros = {'region': regiao, 'dimensions': 700, 'format': 'png'}
        return {
            'status': 'experimental',
            'fonte': 'Sentinel-2 SR Harmonized and Google Dynamic World',
            'periodos': [f'June 1 to September 30, {pedido.ano_inicial}', f'June 1 to September 30, {pedido.ano_final}'],
            'cenas_sentinel': [n_antes, n_depois],
            'imagens_antes_depois': [
                {'tipo': 'antes', 'titulo': f'Before - {pedido.ano_inicial}', 'url': rgb_antes.getThumbURL(parametros)},
                {'tipo': 'depois', 'titulo': f'After - {pedido.ano_final}', 'url': rgb_depois.getThumbURL(parametros)},
                {'tipo': 'mudancas', 'titulo': 'Potential tree-cover changes', 'url': sobreposicao.getThumbURL(parametros)}
            ],
            'legenda': {'laranja': 'Potential change from tree-cover class to another land-cover class',
                        'azul': 'Boundary of declared polygon (if provided)'},
            'avisos': [
                'Image URLs are temporary; save images to preserve report evidence.',
                'Images are June-to-September composites, not single-date photographs.',
                'Experimental classification; not evidence of extraction, fraud, or illegality.',
                'The declared polygon has not been verified by an environmental authority.',
                'No highlighted pixels does not prove the absence of change.'
            ]
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Erro ao gerar imagens no Earth Engine: {exc}') from exc
