"""Experimental Sentinel-2 and Dynamic World analysis using Google Earth Engine."""
import os
from functools import lru_cache

@lru_cache(maxsize=1)
def iniciar_ee():
    import ee
    projeto = os.getenv('EE_PROJECT', '').strip()
    if not projeto:
        raise RuntimeError('Configure EE_PROJECT com o ID do projeto Google Cloud habilitado para Earth Engine.')
    try:
        ee.Initialize(project=projeto)
    except Exception as exc:
        raise RuntimeError('Earth Engine nao autenticado. Execute: earthengine authenticate. Detalhe: ' + str(exc)) from exc
    return ee


def analisar_sentinel(payload):
    ee = iniciar_ee()
    lat, lon = payload.latitude, payload.longitude
    area = ee.Geometry.Point([lon, lat]).buffer(payload.raio_metros)
    autorizado = None
    if payload.poligono_autorizado is not None:
        autorizado = ee.Geometry(payload.poligono_autorizado)

    def datas(ano):
        return f'{ano}-06-01', f'{ano}-10-01'

    def sem_nuvem(img):
        scl = img.select('SCL')
        valido = (scl.neq(0).And(scl.neq(1)).And(scl.neq(3))
                   .And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10)).And(scl.neq(11)))
        return img.updateMask(valido).normalizedDifference(['B8', 'B4']).rename('NDVI')

    def composito(ano):
        ini, fim = datas(ano)
        col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
               .filterBounds(area).filterDate(ini, fim)
               .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80)))
        n = col.size().getInfo()
        if n == 0:
            raise ValueError(f'Sem imagens Sentinel-2 em {ano} para a area selecionada.')
        return col.map(sem_nuvem).median().clip(area), n

    antes, n_antes = composito(payload.ano_inicial)
    depois, n_depois = composito(payload.ano_final)
    delta = depois.subtract(antes)
    queda = delta.lt(-0.2).And(antes.gt(0.5)).selfMask()

    def dw(ano):
        ini, fim = datas(ano)
        col = (ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
               .filterBounds(area).filterDate(ini, fim).select('label'))
        n = col.size().getInfo()
        if n == 0:
            raise ValueError(f'Sem cenas Dynamic World em {ano}.')
        return col.mode().clip(area), n

    dw_antes, dw_n_antes = dw(payload.ano_inicial)
    dw_depois, dw_n_depois = dw(payload.ano_final)
    # Dynamic World: trees=1; grass=2; crops=4. A class transition does not prove deforestation.
    arvore_para_outra = dw_antes.eq(1).And(dw_depois.neq(1)).selfMask()
    arvore_para_cultivo = dw_antes.eq(1).And(dw_depois.eq(4)).selfMask()
    arvore_para_graminea = dw_antes.eq(1).And(dw_depois.eq(2)).selfMask()

    def hectares(mascara, geometria):
        imagem = ee.Image.pixelArea().divide(10000).updateMask(mascara).rename('ha')
        stats = imagem.reduceRegion(reducer=ee.Reducer.sum(), geometry=geometria,
                                    scale=10, maxPixels=1e8, tileScale=4).getInfo()
        return round(float(stats.get('ha') or 0), 4)

    resultado = {
        'status': 'experimental',
        'fonte': 'Sentinel-2 SR + Google Dynamic World',
        'anos': [payload.ano_inicial, payload.ano_final],
        'periodo_em_cada_ano': '01/06 a 30/09',
        'cenas_sentinel': [n_antes, n_depois],
        'cenas_dynamic_world': [dw_n_antes, dw_n_depois],
        'queda_ndvi_ha': hectares(queda, area),
        'arvore_para_nao_arvore_ha': hectares(arvore_para_outra, area),
        'arvore_para_cultivo_ha': hectares(arvore_para_cultivo, area),
        'arvore_para_graminea_ha': hectares(arvore_para_graminea, area),
        'poligono_autorizado_fornecido': autorizado is not None,
        'observacoes': [
            'Queda de NDVI e alteracao de classe nao comprovam desmatamento nem ilegalidade.',
            'Dynamic World foi agregado por classe modal, sem filtro adicional de confianca.',
            'A analise considera apenas os meses de junho a setembro de cada ano.'
        ]
    }
    if autorizado is not None:
        # Clip the declared area to the actual analysis region.
        dentro = area.intersection(autorizado, 1)
        fora = area.difference(autorizado, 1)
        resultado['area_declarada_na_regiao_ha'] = round(float(dentro.area(1).getInfo()) / 10000, 4)
        resultado['queda_ndvi_dentro_autorizacao_ha'] = hectares(queda, dentro)
        resultado['queda_ndvi_fora_autorizacao_ha'] = hectares(queda, fora)
        resultado['arvore_para_nao_arvore_dentro_autorizacao_ha'] = hectares(arvore_para_outra, dentro)
        resultado['arvore_para_nao_arvore_fora_autorizacao_ha'] = hectares(arvore_para_outra, fora)
        resultado['arvore_para_cultivo_dentro_autorizacao_ha'] = hectares(arvore_para_cultivo, dentro)
        resultado['arvore_para_cultivo_fora_autorizacao_ha'] = hectares(arvore_para_cultivo, fora)
        resultado['arvore_para_graminea_dentro_autorizacao_ha'] = hectares(arvore_para_graminea, dentro)
        resultado['arvore_para_graminea_fora_autorizacao_ha'] = hectares(arvore_para_graminea, fora)
        resultado['observacoes'].append('Poligono declarado pelo usuario; validade legal nao verificada.')
        resultado['observacoes'].append('Areas dentro e fora limitadas ao circulo analisado; valores arredondados e estimativos.')
    return resultado
