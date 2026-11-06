import { HttpError } from '../../../shared/errors/HttpError.js';
import { labelPayload } from '../../../../shared/labels/labelPayload.js';
import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { assertEnvironmentalApproval } from '../../../shared/utils/environmentalEvidence.js';

export const DEMO_WAIT_MS = 5 * 24 * 60 * 60 * 1000;
export const canFinalize = (record) =>
  record.products.length > 0 &&
  record.products.every(
    (product) =>
      product.productType?.trim() &&
      product.species?.trim() &&
      ['before', 'after'].every((phase) =>
        product[phase].some(
          (a) =>
            a.photoHash &&
            a.location &&
            Number.isFinite(a.location.latitude) &&
            Math.abs(a.location.latitude) <= 90 &&
            Number.isFinite(a.location.longitude) &&
            Math.abs(a.location.longitude) <= 180,
        ),
      ),
  );

export function invalidateFinalization(record, reason, now, attemptId) {
  if (!record.demoFinalization) return;
  record.demoFinalizationHistory = [
    ...(record.demoFinalizationHistory || []),
    {
      ...record.demoFinalization,
      invalidatedAt: new Date(now).toISOString(),
      reason,
      ...(attemptId ? { attemptId } : {}),
    },
  ];
  delete record.demoFinalization;
}
export function startFinalization(record, now) {
  if (record.demoFinalization?.startedAt) return record;
  if (!canFinalize(record))
    throw new HttpError(
      409,
      'Cada produto precisa de tipo, espécie e fotos antes/depois com coordenadas válidas.',
    );
  record.demoFinalization = {
    id: randomUUID(),
    startedAt: new Date(now).toISOString(),
    availableAt: new Date(now + DEMO_WAIT_MS).toISOString(),
  };
  return record;
}
export function expediteFinalization(record, now) {
  const flow = record.demoFinalization;
  if (!flow?.startedAt) throw new HttpError(409, 'Inicie o prazo para envio do token primeiro.');
  if (!flow.token && !flow.expeditedAt) flow.expeditedAt = new Date(now).toISOString();
  return record;
}
export function issueFinalization(record, now) {
  // O prazo e a antecipação de pitch nunca substituem a decisão ambiental do modelo.
  assertEnvironmentalApproval(record);
  const flow = record.demoFinalization;
  if (flow?.token && flow.labels?.length) return record;
  if (
    !canFinalize(record) ||
    !flow?.startedAt ||
    (!flow.expeditedAt && now < Date.parse(flow.availableAt))
  )
    throw new HttpError(409, 'Aguarde cinco dias ou antecipe a espera para o pitch.');
  const issuedAt = new Date(now).toISOString();
  const labels = record.products.map((product) => ({
    productId: product.id,
    payload: labelPayload(record, product, flow, issuedAt),
  }));
  // Só conclui a emissão se os snapshots couberem em um QR com a mesma configuração do frontend.
  try {
    for (const label of labels)
      QRCode.create(JSON.stringify(label.payload), { errorCorrectionLevel: 'M' });
  } catch {
    throw new HttpError(
      400,
      'Os dados excedem a capacidade da etiqueta QR. Reduza os textos de identificação antes de solicitar novamente.',
    );
  }
  record.demoFinalization = { ...flow, token: `DEMO-${flow.id}`, issuedAt, labels };
  return record;
}
