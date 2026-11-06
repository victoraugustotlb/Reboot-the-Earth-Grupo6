"""Demonstration reports. No permit in this module is official."""
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException

ARQUIVO = Path(__file__).resolve().parent.parent / 'dados' / 'permissoes_demo.json'


def listar_permissoes():
    try:
        dados = json.loads(ARQUIVO.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f'Unable to read demonstration permit file: {exc}') from exc
    if dados.get('ambiente') != 'DEMONSTRACAO' or not isinstance(dados.get('permissoes'), list):
        raise HTTPException(status_code=500, detail='Invalid demonstration permit database.')
    return dados


def obter_permissao(permissao_id):
    for permissao in listar_permissoes()['permissoes']:
        if permissao.get('id') == permissao_id:
            return permissao
    raise HTTPException(status_code=404, detail=f'Fictional permit not found: {permissao_id}')


def _dentro_anel(x, y, anel):
    dentro = False
    for i in range(len(anel) - 1):
        x1, y1 = anel[i]
        x2, y2 = anel[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dentro = not dentro
    return dentro


def _dentro_poligono(lon, lat, geojson):
    def poligono(coords):
        return _dentro_anel(lon, lat, coords[0]) and not any(
            _dentro_anel(lon, lat, hole) for hole in coords[1:]
        )
    tipo = geojson.get('type')
    coords = geojson.get('coordinates')
    if tipo == 'Polygon':
        return poligono(coords)
    if tipo == 'MultiPolygon':
        return any(poligono(p) for p in coords)
    raise ValueError('Permit geometry must be a Polygon or MultiPolygon.')


def _distancia_borda_m(lon, lat, geojson):
    """Approximate local distance, used only to flag GPS uncertainty."""
    kx = 111320 * math.cos(math.radians(lat))
    ky = 110574
    px, py = lon * kx, lat * ky
    poligonos = [geojson['coordinates']] if geojson['type'] == 'Polygon' else geojson['coordinates']
    menor = float('inf')
    for poligono in poligonos:
        for anel in poligono:
            for a, b in zip(anel, anel[1:]):
                ax, ay = a[0] * kx, a[1] * ky
                bx, by = b[0] * kx, b[1] * ky
                dx, dy = bx - ax, by - ay
                t = max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy))) if dx*dx + dy*dy else 0
                menor = min(menor, math.hypot(px - (ax + t*dx), py - (ay + t*dy)))
    return round(menor, 1)


def verificar_posicao(pedido, permissao):
    origem = pedido.origem_localizacao
    if origem != 'device':
        return {'situacao': 'evidencia_insuficiente', 'motivo': 'Missing or simulated position; cannot establish capture location.'}
    if pedido.precisao_metros is None:
        return {'situacao': 'evidencia_insuficiente', 'motivo': 'GPS accuracy was not provided.'}
    geometria = permissao['area_autorizada']
    dentro = _dentro_poligono(pedido.longitude, pedido.latitude, geometria)
    distancia = _distancia_borda_m(pedido.longitude, pedido.latitude, geometria)
    if distancia <= pedido.precisao_metros:
        situacao = 'evidencia_insuficiente'
        motivo = 'GPS uncertainty overlaps the declared area boundary.'
    elif dentro:
        situacao = 'compativel_geograficamente'
        motivo = 'Reported point is inside the area given the stated GPS accuracy.'
    else:
        situacao = 'divergencia_para_conferir'
        motivo = 'Reported point lies outside the area beyond the stated GPS accuracy.'
    return {'situacao': situacao, 'motivo': motivo, 'ponto_dentro_poligono': dentro,
            'distancia_aproximada_borda_m': distancia, 'precisao_gps_m': pedido.precisao_metros}


def gerar_relatorio(pedido, analisar_sentinel, analise_request_cls):
    permissao = obter_permissao(pedido.permissao_id)
    geometria = permissao['area_autorizada']
    posicao = verificar_posicao(pedido, permissao)
    consulta = analise_request_cls(latitude=pedido.latitude, longitude=pedido.longitude,
                                   raio_metros=pedido.raio_metros, ano_inicial=pedido.ano_inicial,
                                   ano_final=pedido.ano_final, poligono_autorizado=geometria)
    satelite = analisar_sentinel(consulta)
    fora = satelite.get('arvore_para_nao_arvore_fora_autorizacao_ha')
    dentro = satelite.get('arvore_para_nao_arvore_dentro_autorizacao_ha')
    if fora is None or dentro is None:
        status = 'evidencia_insuficiente'
        mensagem = 'The observed changes could not be fully compared with the declared area.'
    elif fora > 0:
        status = 'divergencia_para_conferir'
        mensagem = ('Satellite analysis detected a possible vegetation change outside the '
                    'fictional permit area. This requires human review.')
    elif posicao['situacao'] == 'divergencia_para_conferir':
        status = 'divergencia_para_conferir'
        mensagem = 'The reported position lies outside the fictional permit area and requires review.'
    elif posicao['situacao'] == 'evidencia_insuficiente':
        status = 'evidencia_insuficiente'
        mensagem = 'The location evidence is inconclusive and requires review.'
    else:
        status = 'sem_divergencia_detectada_nesta_analise'
        mensagem = 'No tree-cover class change outside the declared area was detected for this period.'
    limite = permissao.get('area_maxima_ha')
    return {
        'id_relatorio': 'DEMO-REL-' + uuid4().hex[:12].upper(),
        'gerado_em_utc': datetime.now(timezone.utc).isoformat(),
        'ambiente': 'DEMONSTRACAO',
        'status': status,
        'resumo_produtor': {
            'titulo': 'What does the satellite analysis show?',
            'mensagem': mensagem,
            'explicacao': 'We compared satellite imagery from two periods. Results are estimates and may require human review.',
            'aviso': 'Fictional permit. This report does not prove compliance or a violation.'
        },
        'referencias': {'registro_id': pedido.registro_id, 'produto_id': pedido.produto_id,
                        'tentativa_id': pedido.tentativa_id},
        'permissao': {'id': permissao['id'], 'fonte': 'BASE FICTICIA - NAO OFICIAL',
                     'orgao_emissor': permissao['orgao_emissor'], 'atividade': permissao['atividade'],
                     'validade_inicio': permissao['validade_inicio'], 'validade_fim': permissao['validade_fim'],
                     'limite_ficticio_ha': limite, 'poligono': geometria,
                     'aviso': 'Area limit and polygon are simulated; no public authority was consulted.'},
        'localizacao': {'latitude': pedido.latitude, 'longitude': pedido.longitude,
                        'origem': pedido.origem_localizacao, 'verificacao': posicao},
        'indicadores': {
            'mudanca_arborea_total_ha': satelite.get('arvore_para_nao_arvore_ha'),
            'mudanca_arborea_dentro_ha': dentro,
            'mudanca_arborea_fora_ha': fora,
            'queda_ndvi_total_ha': satelite.get('queda_ndvi_ha'),
            'limite_ficticio_ha': limite,
            'limite_excedido': None
        },
        'evidencias': {'analise_satelite': satelite,
                       'imagens_antes_depois': [],
                       'aviso_imagens': 'This endpoint did not generate visual images. Do not present illustrative images as real evidence.'},
        'metodologia': {'versao': 'geoai-relatorio-demo-1.0',
                        'fontes': ['Sentinel-2 SR Harmonized', 'Google Dynamic World'],
                        'observacoes': [
                            'Satellite classification does not establish clearing, extraction, or illegality.',
                            'The fictional hectare limit cannot be validated directly from tree-cover class changes.',
                            'Device GPS and timestamps do not independently establish photo provenance.',
                            'The permit is entirely fictional.',
                            'The assessment must be reviewed if usable imagery or sufficient quality is unavailable.'
                        ]}
    }
