import { HttpError } from '../../../shared/errors/HttpError.js';
import { validateImage } from '../../../shared/validators/imageValidator.js';
import { sha256 } from '../../../shared/utils/sha256.js';

export const uuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const bad = (message) => {
  throw new HttpError(400, message);
};
export function text(value, title, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    bad(`${title}: informe de 1 a ${max} caracteres.`);
  return value.trim();
}
export function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    bad('Metadados do registro inválidos.');
  }
}
function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    bad('Horário da evidência inválido.');
  return new Date(value).toISOString();
}
// Aceita ausência de GPS como evidência incompleta; nunca inventa coordenadas reais.
export function validateAttempt(input, file) {
  if (!input || !uuid(input.id)) bad('Identificador de tentativa inválido.');
  const image = validateImage(file);
  let location = null;
  if (input.location != null) {
    const l = input.location;
    if (
      !['demo', 'device'].includes(l.source) ||
      !Number.isFinite(l.latitude) ||
      Math.abs(l.latitude) > 90 ||
      !Number.isFinite(l.longitude) ||
      Math.abs(l.longitude) > 180
    )
      bad('Localização da tentativa inválida.');
    if (l.accuracy != null && (!Number.isFinite(l.accuracy) || l.accuracy < 0))
      bad('Precisão da localização inválida.');
    location = {
      source: l.source,
      latitude: l.latitude,
      longitude: l.longitude,
      accuracy: l.accuracy ?? null,
      timestamp: timestamp(l.timestamp ?? input.capturedAt),
    };
  }
  if (!['camera', 'native-camera', 'import', 'example'].includes(input.imageSource))
    bad('Origem da foto inválida.');
  return {
    metadata: {
      id: input.id,
      capturedAt: timestamp(input.capturedAt),
      includedAt: new Date().toISOString(),
      imageSource: input.imageSource,
      location,
      photoHash: sha256(image.buffer),
    },
    file: image,
  };
}
export function validateRecord(input, files = []) {
  if (!input || !uuid(input.id)) bad('Identificador do registro inválido.');
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > 10)
    bad('Inclua de 1 a 10 produtos por registro.');
  const seen = new Set([input.id]);
  const photoMap = new Map(files.map((file) => [file.originalname, file]));
  if (photoMap.size !== files.length) bad('Fotos duplicadas no envio.');
  const photos = [];
  const products = input.products.map((product) => {
    if (!product || typeof product !== 'object') bad('Produto inválido.');
    if (!uuid(product.id) || seen.has(product.id))
      bad('Identificador de produto inválido ou repetido.');
    seen.add(product.id);
    const result = {
      id: product.id,
      species: typeof product.species === 'string' ? product.species.trim() : '',
      productType: typeof product.productType === 'string' ? product.productType.trim() : '',
    };
    if (result.species.length > 100) bad('Espécie deve ter até 100 caracteres.');
    if (result.productType.length > 100) bad('Tipo de produto deve ter até 100 caracteres.');
    for (const phase of ['before', 'after']) {
      if (!Array.isArray(product[phase]) || product[phase].length > 3)
        bad('São permitidas até três tentativas por etapa.');
      result[phase] = product[phase].map((attempt, index) => {
        if (!attempt || typeof attempt !== 'object') bad('Tentativa inválida.');
        if (!uuid(attempt.id) || seen.has(attempt.id)) bad('Tentativa inválida ou repetida.');
        seen.add(attempt.id);
        const validated = validateAttempt(attempt, photoMap.get(attempt.id));
        photoMap.delete(attempt.id);
        photos.push({ id: attempt.id, file: validated.file });
        return { ...validated.metadata, number: index + 1 };
      });
    }
    return result;
  });
  if (photoMap.size) bad('O envio contém fotos sem uma tentativa correspondente.');
  const now = new Date().toISOString();
  return {
    record: {
      id: input.id,
      name: text(input.name, 'Nome do registro'),
      producer: text(input.producer, 'Nome do produtor'),
      products,
      createdAt: now,
      updatedAt: now,
    },
    photos,
  };
}
