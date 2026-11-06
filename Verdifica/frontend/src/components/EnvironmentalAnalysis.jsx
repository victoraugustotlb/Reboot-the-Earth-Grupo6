import React, { useEffect, useState } from 'react';
import { geoaiCatalog, analyzeProduct, analysisDetail } from '../services/geoai.js';

// Mostra a origem dos dados e mantém posição da captura separada da área de referência.
export function EnvironmentalAnalysis({ recordId, product, onUpdated }) {
  const [catalog, setCatalog] = useState(null),
    [result, setResult] = useState(null),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [mode, setMode] = useState('reference');
  const [permissionId, setPermissionId] = useState('DEMO-AUT-001'),
    [attemptId, setAttemptId] = useState('');
  const [yearBefore, setYearBefore] = useState(2024),
    [yearAfter, setYearAfter] = useState(2025),
    [radius, setRadius] = useState(1000);
  const [showReference, setShowReference] = useState(false);
  const summary = product.environmentalAnalysis;
  const attempts = [
    ...product.before.map((a) => ({ ...a, phase: 'Antes' })),
    ...product.after.map((a) => ({ ...a, phase: 'Depois' })),
  ];
  useEffect(() => {
    let active = true;
    geoaiCatalog()
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    if (summary?.analysisId)
      analysisDetail(summary.analysisId)
        .then((data) => {
          if (active) setResult(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [summary?.analysisId]);
  async function analyze(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await analyzeProduct(recordId, product.id, {
        mode,
        permissionId,
        attemptId: attemptId || undefined,
        yearBefore,
        yearAfter,
        radius,
      });
      setResult(data);
      await onUpdated();
    } catch (error) {
      setError(error.message);
      await onUpdated().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const decision = summary?.decisao_token;
  const decisionText = {
    sem_alertas_detectados: 'Sem alertas nos critérios experimentais',
    revisao_necessaria: 'Revisão humana necessária',
    evidencias_insuficientes: 'Evidências insuficientes',
  };
  return (
    <section className="environmental-analysis" aria-label="Triagem ambiental GeoAI">
      <h3>Triagem ambiental · GeoAI</h3>
      <p className="small muted">
        Modelo do Grupo 6: Sentinel‑2, Dynamic World e referência Amazônia‑1. Permissões
        demonstrativas e resultados experimentais; não são certificação ambiental.
      </p>
      {catalog && !catalog.ee_project_configured && (
        <p className="demo-banner">
          Earth Engine ainda não configurado. O modo de referência funciona sem credenciais e não
          libera token.
        </p>
      )}
      <form onSubmit={analyze} className="geoai-form">
        <fieldset disabled={busy}>
          <div className="fields-grid">
            <label className="field">
              Fonte da análise
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="reference">Amazônia‑1 · referência pré-calculada</option>
                <option value="live">Sentinel‑2 / Dynamic World · consulta real</option>
              </select>
            </label>
            <label className="field">
              Permissão fictícia
              <select value={permissionId} onChange={(e) => setPermissionId(e.target.value)}>
                {catalog?.permits?.length ? (
                  catalog.permits.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · fictícia
                    </option>
                  ))
                ) : (
                  <option value="DEMO-AUT-001">DEMO-AUT-001 · fictícia</option>
                )}
              </select>
            </label>
            <label className="field">
              Evidência associada
              <select value={attemptId} onChange={(e) => setAttemptId(e.target.value)}>
                <option value="">
                  {attempts.length
                    ? 'Última tentativa do produto'
                    : 'Sem foto · somente referência'}
                </option>
                {attempts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.phase} · tentativa {a.number} ·{' '}
                    {a.location?.source === 'device'
                      ? 'GPS do dispositivo'
                      : a.location?.source === 'demo'
                        ? 'posição simulada'
                        : 'sem GPS'}
                  </option>
                ))}
              </select>
            </label>
            {mode === 'live' && (
              <>
                <label className="field">
                  Ano inicial
                  <input
                    type="number"
                    min="2017"
                    max={new Date().getFullYear() - 1}
                    required
                    value={yearBefore}
                    onChange={(e) => setYearBefore(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Ano final
                  <input
                    type="number"
                    min={Number(yearBefore) + 1}
                    max={new Date().getFullYear()}
                    required
                    value={yearAfter}
                    onChange={(e) => setYearAfter(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Raio (metros)
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    required
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                  />
                </label>
              </>
            )}
          </div>
          <p className="small muted">
            {mode === 'reference'
              ? 'Área fixa de demonstração: -12,5 / -54,5. Não é a localização da sua foto e não analisa a propriedade cadastrada.'
              : 'Utiliza o GPS real da tentativa selecionada. Exige EE_PROJECT e conta autorizada no Earth Engine. A consulta pode demorar.'}
          </p>
          <button className="primary" disabled={busy}>
            {busy
              ? 'Analisando…'
              : mode === 'reference'
                ? 'Gerar relatório de referência'
                : 'Consultar satélite e gerar relatório'}
          </button>
        </fieldset>
      </form>
      {catalog && (
        <>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowReference(!showReference)}
          >
            {showReference ? 'Ocultar' : 'Consultar'} dados de referência Amazônia‑1
          </button>
          {showReference && (
            <p className="small">
              {catalog.reference.fonte} · {catalog.reference.cenas_catalogadas} cenas catalogadas.
              Dados pré-calculados; não representam uma consulta desta propriedade.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {summary && (
        <div className="geoai-result">
          <h4>
            {summary.status === 'pending'
              ? 'Análise em andamento'
              : summary.status === 'failed'
                ? 'Análise não concluída'
                : decisionText[decision?.status] || 'Resultado inconclusivo'}
          </h4>
          {(summary.stale || result?.stale) && (
            <p className="error">
              As evidências mudaram. Este relatório é histórico; execute nova análise.
            </p>
          )}
          <p>{decision?.motivo}</p>
          <p className="small">
            Emissão de etiqueta:{' '}
            {decision?.pode_emitir === true && !summary.stale
              ? 'permitida apenas como demonstração, após os demais requisitos'
              : 'bloqueada'}
          </p>
          {result?.captureLocation && (
            <p className="small">
              Posição da captura ({result.captureLocation.source}):{' '}
              {result.captureLocation.latitude}, {result.captureLocation.longitude}
            </p>
          )}
          {result?.analysisLocation && (
            <p className="small">
              Área consultada ({result.analysisLocation.source}): {result.analysisLocation.latitude}
              , {result.analysisLocation.longitude}
            </p>
          )}
          {summary.photoCheck && (
            <p className="small muted">
              Foto conferida: formato e resolução ({summary.photoCheck.dimensoes?.largura} ×{' '}
              {summary.photoCheck.dimensoes?.altura}). Sem IA visual, verificação de autenticidade
              ou comprovação do GPS pela imagem.
            </p>
          )}
          {result?.report && (
            <>
              <p>{result.report.resumo_produtor?.mensagem}</p>
              <dl>
                <dt>Mudança arbórea total</dt>
                <dd>
                  {result.report.indicadores?.mudanca_arborea_total_ha == null
                    ? 'Não calculada'
                    : `${result.report.indicadores.mudanca_arborea_total_ha} ha`}
                </dd>
                <dt>Fora do polígono declarado</dt>
                <dd>
                  {result.report.indicadores?.mudanca_arborea_fora_ha == null
                    ? 'Não calculada'
                    : `${result.report.indicadores.mudanca_arborea_fora_ha} ha`}
                </dd>
              </dl>
            </>
          )}
          {result?.pdfUrl && (
            <a className="secondary" href={result.pdfUrl}>
              Baixar relatório ambiental PDF
            </a>
          )}
        </div>
      )}
    </section>
  );
}
