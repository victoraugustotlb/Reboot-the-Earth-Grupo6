"""DEMONSTRATION-ONLY token decision; fail closed."""
import math


def decidir_token(relatorio):
    negado = lambda status, motivo: {'pode_emitir': False, 'status': status, 'motivo': motivo, 'tipo_token': None}
    if relatorio.get('ambiente') != 'DEMONSTRACAO':
        return negado('nao_habilitado', 'Official issuance is not implemented.')
    permissao = relatorio.get('permissao') or {}
    if permissao.get('fonte') != 'BASE FICTICIA - NAO OFICIAL':
        return negado('evidencias_insuficientes', 'Unrecognized permit source.')
    if relatorio.get('status') == 'divergencia_para_conferir':
        return negado('revisao_necessaria', 'Possible environmental or geographic discrepancy.')
    if relatorio.get('status') != 'sem_divergencia_detectada_nesta_analise':
        return negado('evidencias_insuficientes', 'Inconclusive analysis or unrecognized status.')
    local = relatorio.get('localizacao') or {}
    if local.get('origem') != 'device' or (local.get('verificacao') or {}).get('situacao') != 'compativel_geograficamente':
        return negado('evidencias_insuficientes', 'GPS compatibility was not established.')
    sat = (relatorio.get('evidencias') or {}).get('analise_satelite') or {}
    ind = relatorio.get('indicadores') or {}
    if sat.get('status') != 'experimental':
        return negado('evidencias_insuficientes', 'Satellite analysis is incomplete.')
    for chave in ('mudanca_arborea_total_ha', 'mudanca_arborea_dentro_ha', 'mudanca_arborea_fora_ha'):
        valor = ind.get(chave)
        if not isinstance(valor, (int, float)) or not math.isfinite(valor) or valor < 0:
            return negado('evidencias_insuficientes', 'Environmental indicators are missing or invalid.')
    if ind['mudanca_arborea_fora_ha'] > 0:
        return negado('revisao_necessaria', 'Change detected outside the declared polygon.')
    for chave in ('cenas_sentinel', 'cenas_dynamic_world'):
        contagens = sat.get(chave)
        if not isinstance(contagens, list) or len(contagens) != 2 or any(not isinstance(n, int) or n <= 0 for n in contagens):
            return negado('evidencias_insuficientes', 'Insufficient satellite scenes reported.')
    return {'pode_emitir': True, 'status': 'sem_alertas_detectados',
            'motivo': 'No discrepancies under the experimental criteria; this does not prove legal compliance.',
            'tipo_token': 'rastro_experimental'}
