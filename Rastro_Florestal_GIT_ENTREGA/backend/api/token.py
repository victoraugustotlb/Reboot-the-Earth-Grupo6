"""Decisao de token EXCLUSIVAMENTE demonstrativo; falha fechada."""
import math


def decidir_token(relatorio):
    negado = lambda status, motivo: {'pode_emitir': False, 'status': status, 'motivo': motivo, 'tipo_token': None}
    if relatorio.get('ambiente') != 'DEMONSTRACAO':
        return negado('nao_habilitado', 'Emissao oficial nao implementada.')
    permissao = relatorio.get('permissao') or {}
    if permissao.get('fonte') != 'BASE FICTICIA - NAO OFICIAL':
        return negado('evidencias_insuficientes', 'Fonte da permissao nao reconhecida.')
    if relatorio.get('status') == 'divergencia_para_conferir':
        return negado('revisao_necessaria', 'Possivel divergencia ambiental ou geografica.')
    if relatorio.get('status') != 'sem_divergencia_detectada_nesta_analise':
        return negado('evidencias_insuficientes', 'Analise inconclusiva ou status nao reconhecido.')
    local = relatorio.get('localizacao') or {}
    if local.get('origem') != 'device' or (local.get('verificacao') or {}).get('situacao') != 'compativel_geograficamente':
        return negado('evidencias_insuficientes', 'GPS nao verificado como compativel.')
    sat = (relatorio.get('evidencias') or {}).get('analise_satelite') or {}
    ind = relatorio.get('indicadores') or {}
    if sat.get('status') != 'experimental':
        return negado('evidencias_insuficientes', 'Analise satelital nao concluida.')
    for chave in ('mudanca_arborea_total_ha', 'mudanca_arborea_dentro_ha', 'mudanca_arborea_fora_ha'):
        valor = ind.get(chave)
        if not isinstance(valor, (int, float)) or not math.isfinite(valor) or valor < 0:
            return negado('evidencias_insuficientes', 'Indicadores ambientais invalidos ou ausentes.')
    if ind['mudanca_arborea_fora_ha'] > 0:
        return negado('revisao_necessaria', 'Mudanca fora do poligono declarado.')
    for chave in ('cenas_sentinel', 'cenas_dynamic_world'):
        contagens = sat.get(chave)
        if not isinstance(contagens, list) or len(contagens) != 2 or any(not isinstance(n, int) or n <= 0 for n in contagens):
            return negado('evidencias_insuficientes', 'Nao ha cenas suficientes informadas.')
    return {'pode_emitir': True, 'status': 'sem_alertas_detectados',
            'motivo': 'Sem divergencias nos criterios experimentais avaliados; nao comprova legalidade.',
            'tipo_token': 'rastro_experimental'}
