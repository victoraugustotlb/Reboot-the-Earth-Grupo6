"""Visualizacoes reais do Earth Engine para o MVP. URLs temporarias, nao provas oficiais."""
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator
from api.earth_engine import iniciar_ee

router = APIRouter(prefix='/imagens', tags=['Imagens de satelite'])

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
            raise ValueError('ano_final precisa ser posterior ao ano_inicial')
        if self.poligono_autorizado is not None and self.poligono_autorizado.get('type') not in ('Polygon','MultiPolygon'):
            raise ValueError('Use GeoJSON Polygon ou MultiPolygon')
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
                raise ValueError(f'Nao ha cenas Sentinel-2 em {ano}')
            return col.map(filtrar_nuvem).median().clip(area), quantidade

        antes, n_antes = imagem_ano(pedido.ano_inicial)
        depois, n_depois = imagem_ano(pedido.ano_final)

        # Dynamic World: classe 1 = arvores. Mesma regra de mudanca do endpoint analitico.
        def classes_ano(ano):
            col = (ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                   .filterBounds(area)
                   .filterDate(f'{ano}-06-01', f'{ano}-10-01')
                   .select('label'))
            if col.size().getInfo() == 0:
                raise ValueError(f'Nao ha cenas Dynamic World em {ano}')
            return col.mode().clip(area)

        classe_antes = classes_ano(pedido.ano_inicial)
        classe_depois = classes_ano(pedido.ano_final)
        mudanca = classe_antes.eq(1).And(classe_depois.neq(1)).selfMask()

        # B4=vermelho, B3=verde, B2=azul; reflectancia SR escalada por 10000.
        visual = {'bands': ['B4','B3','B2'], 'min': 0, 'max': 3000, 'gamma': 1.2}
        rgb_antes = antes.visualize(**visual)
        rgb_depois = depois.visualize(**visual)
        # Laranja = mudanca de classe; azul = limite informado. Nao representa infracao.
        sobreposicao = rgb_depois.blend(mudanca.visualize(palette=['ff8c00'], opacity=0.75))
        if autorizado is not None:
            linha = ee.Image().byte().paint(autorizado, 1, 2).selfMask()
            sobreposicao = sobreposicao.blend(linha.visualize(palette=['1967d2']))

        parametros = {'region': regiao, 'dimensions': 700, 'format': 'png'}
        return {
            'status': 'experimental',
            'fonte': 'Sentinel-2 SR Harmonized e Google Dynamic World',
            'periodos': [f'01/06 a 30/09/{pedido.ano_inicial}', f'01/06 a 30/09/{pedido.ano_final}'],
            'cenas_sentinel': [n_antes, n_depois],
            'imagens_antes_depois': [
                {'tipo': 'antes', 'titulo': f'Antes - {pedido.ano_inicial}', 'url': rgb_antes.getThumbURL(parametros)},
                {'tipo': 'depois', 'titulo': f'Depois - {pedido.ano_final}', 'url': rgb_depois.getThumbURL(parametros)},
                {'tipo': 'mudancas', 'titulo': 'Possiveis mudancas de cobertura arborea', 'url': sobreposicao.getThumbURL(parametros)}
            ],
            'legenda': {'laranja': 'Possivel mudanca de classe arvores para outra cobertura',
                        'azul': 'Limite do poligono informado (se fornecido)'},
            'avisos': [
                'URLs de imagens temporarias: salve as imagens para preservacao do relatorio.',
                'Imagens sao compositos de junho a setembro, nao fotografias de uma data unica.',
                'Classificacao experimental; nao prova extracao, fraude ou ilegalidade.',
                'O poligono e declarado e nao foi validado por orgao ambiental.',
                'A ausencia de pixels destacados nao comprova ausencia de alteracao.'
            ]
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f'Erro ao gerar imagens no Earth Engine: {exc}') from exc
