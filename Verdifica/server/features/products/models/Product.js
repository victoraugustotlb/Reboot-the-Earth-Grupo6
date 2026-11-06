import { HttpError } from '../../../shared/errors/HttpError.js';
import { hashProduct, sha256 } from '../utils/hash.js';

// O estado só é alterado por operações do domínio; toRow devolve uma cópia.
export class Product {
  #row;

  constructor(row) {
    this.#row = { ...row };
  }

  static register({ id, fields, photo_before, photo_after, before, after }) {
    const row = {
      id,
      ...fields,
      photo_before,
      photo_after,
      photo_before_hash: sha256(before.buffer),
      photo_after_hash: after ? sha256(after.buffer) : null,
      status: after ? 'completed' : 'pending',
      created_at: new Date().toISOString(),
    };
    row.hash = hashProduct(row);
    return new Product(row);
  }

  assertPending() {
    if (this.#row.photo_after) throw new HttpError(409, 'A foto posterior já foi registrada.');
  }

  complete(path, file) {
    this.assertPending();
    this.#row.photo_after = path;
    this.#row.photo_after_hash = sha256(file.buffer);
    this.#row.status = 'completed';
    this.#row.hash = hashProduct(this.#row);
    return this;
  }

  toRow() {
    return { ...this.#row };
  }

  toReceipt(publicBaseUrl) {
    const { id, hash, status } = this.#row;
    return { id, hash, status, tracking_url: `${publicBaseUrl}/rastreio/${id}` };
  }

  toPublicData() {
    const row = this.#row;
    return {
      id: row.id,
      tree_species: row.tree_species,
      extraction_date: row.extraction_date,
      status: row.status,
      hash: row.hash,
      created_at: row.created_at,
      // A consulta pública não revela produtor nem coordenadas precisas.
      approximate_location: {
        latitude: Number(row.latitude.toFixed(2)),
        longitude: Number(row.longitude.toFixed(2)),
      },
      photo_before: `/api/products/${row.id}/photos/before`,
      photo_after: row.photo_after ? `/api/products/${row.id}/photos/after` : null,
    };
  }
}
