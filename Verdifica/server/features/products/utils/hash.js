import { sha256 } from '../../../shared/utils/sha256.js';
export { sha256 };

// Calcula um resumo determinístico para detectar alterações nos bytes ou nos campos.

// Campos específicos de produtos em ordem fixa mantêm o hash reproduzível.
export function hashProduct(row) {
  return sha256(
    JSON.stringify(
      Object.fromEntries(
        [
          'id',
          'producer_name',
          'tree_species',
          'latitude',
          'longitude',
          'extraction_date',
          'photo_before',
          'photo_after',
          'photo_before_hash',
          'photo_after_hash',
          'status',
          'created_at',
        ].map((key) => [key, row[key] ?? null]),
      ),
    ),
  );
}
