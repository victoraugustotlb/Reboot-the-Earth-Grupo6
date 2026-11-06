export const MAX_ATTEMPTS = 3;
export const ALERT_DISTANCE_M = 100;
export const DEMO_WAIT_MS = 5 * 24 * 60 * 60 * 1000;
export const environmentalApproved = (record) =>
  record.products.every((product) => {
    const a = product.environmentalAnalysis;
    return (
      a?.status === 'completed' &&
      a.mode === 'live' &&
      !a.stale &&
      a.decisao_token?.pode_emitir === true &&
      a.decisao_token?.status === 'sem_alertas_detectados'
    );
  });

// A API devolve URLs locais e hashes para as fotos; o rascunho ainda usa Blob.
export const canFinalizeDemo = (record) =>
  isComplete(record) &&
  record.products.every(
    (product) =>
      product.productType?.trim() &&
      ['before', 'after'].every((phase) =>
        product[phase].some(
          (a) =>
            ((a.photo instanceof Blob && a.photo.size > 0) ||
              (typeof a.photo === 'string' && a.photoHash)) &&
            a.location &&
            Number.isFinite(a.location.latitude) &&
            Math.abs(a.location.latitude) <= 90 &&
            Number.isFinite(a.location.longitude) &&
            Math.abs(a.location.longitude) <= 180,
        ),
      ),
  );
export function demoStatus(record, now = Date.now()) {
  const flow = record.demoFinalization;
  if (!flow?.startedAt) return canFinalizeDemo(record) ? 'ready' : 'incomplete';
  if (flow.token && flow.labels?.length) return 'issued';
  return flow.expeditedAt || now >= Date.parse(flow.availableAt) ? 'eligible' : 'waiting';
}
export function uid(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  // randomUUID exige contexto seguro; getRandomValues também funciona via HTTP na LAN.
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function appendAttempt(product, phase, attempt) {
  if (!['before', 'after'].includes(phase)) throw new Error('Tipo de foto inválido.');
  const attempts = product[phase];
  if (attempts.some((a) => a.id === attempt.id)) return product;
  if (attempts.length >= MAX_ATTEMPTS) throw new Error('Limite de três tentativas atingido.');
  return { ...product, [phase]: [...attempts, { ...attempt, number: attempts.length + 1 }] };
}
export const isComplete = (record) =>
  record.products.length > 0 &&
  record.products.every(
    (p) => p.species.trim() && p.before.some((a) => a.location) && p.after.some((a) => a.location),
  );
/** Distância aproximada em metros pela fórmula de Haversine; recebe latitude/longitude em graus. */
export function distance(a, b) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
/**
 * Compara a última tentativa da etapa com as demais evidências do mesmo produto.
 * Não mistura GPS real com simulação. O alerta exige distância acima do limiar
 * mais a soma das precisões, reduzindo avisos por oscilação do GPS.
 * O resultado orienta conferência humana; não é uma classificação de fraude.
 */
export function discrepancies(product, phase) {
  const current = product[phase].at(-1);
  if (!current?.location) return [];
  return [...product.before, ...product.after]
    .filter(
      (a) => a.id !== current.id && a.location && a.location.source === current.location.source,
    )
    .map((a) => ({
      attempt: a,
      meters: distance(a.location, current.location),
      uncertainty: (a.location.accuracy || 0) + (current.location.accuracy || 0),
    }))
    .filter((d) => d.meters > ALERT_DISTANCE_M + d.uncertainty);
}
