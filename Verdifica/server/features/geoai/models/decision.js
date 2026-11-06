// Reaplica a política fail-closed do api/token.py importado; não confia só em pode_emitir.
export function decideReport(report, mode) {
  const no = (status, motivo) => ({ pode_emitir: false, status, motivo, tipo_token: null });
  if (mode !== 'live')
    return no(
      'evidencias_insuficientes',
      'Dados de referência não analisam a propriedade registrada.',
    );
  if (
    report?.ambiente !== 'DEMONSTRACAO' ||
    report.permissao?.fonte !== 'BASE FICTICIA - NAO OFICIAL'
  )
    return no('evidencias_insuficientes', 'Ambiente ou fonte de permissão não reconhecidos.');
  if (report.status === 'divergencia_para_conferir')
    return no(
      'revisao_necessaria',
      'Possível divergência ambiental ou geográfica; requer conferência humana.',
    );
  if (
    report.status !== 'sem_divergencia_detectada_nesta_analise' ||
    report.localizacao?.origem !== 'device' ||
    report.localizacao.verificacao?.situacao !== 'compativel_geograficamente'
  )
    return no(
      'evidencias_insuficientes',
      'Não foi estabelecida compatibilidade geográfica com GPS real.',
    );
  const satellite = report.evidencias?.analise_satelite;
  const indicators = report.indicadores;
  if (satellite?.status !== 'experimental' || !indicators)
    return no('evidencias_insuficientes', 'Análise de satélite incompleta.');
  for (const key of [
    'mudanca_arborea_total_ha',
    'mudanca_arborea_dentro_ha',
    'mudanca_arborea_fora_ha',
  ]) {
    if (!Number.isFinite(indicators[key]) || indicators[key] < 0)
      return no('evidencias_insuficientes', 'Indicadores ausentes ou inválidos.');
  }
  if (indicators.mudanca_arborea_fora_ha > 0)
    return no('revisao_necessaria', 'Possível mudança de cobertura fora do polígono declarado.');
  for (const key of ['cenas_sentinel', 'cenas_dynamic_world']) {
    const counts = satellite[key];
    if (
      !Array.isArray(counts) ||
      counts.length !== 2 ||
      counts.some((n) => !Number.isInteger(n) || n <= 0)
    )
      return no('evidencias_insuficientes', 'Cenas de satélite insuficientes.');
  }
  return {
    pode_emitir: true,
    status: 'sem_alertas_detectados',
    motivo: 'Sem divergências nos critérios experimentais; não comprova legalidade.',
    tipo_token: 'rastro_experimental',
  };
}
