import { HttpError } from '../../../shared/errors/HttpError.js';
import { validateRecord, validateAttempt, text, uuid } from '../validators/recordValidator.js';
import {
  invalidateFinalization,
  startFinalization,
  expediteFinalization,
  issueFinalization,
} from '../models/DemoFinalization.js';

export class RecordService {
  constructor(repository, clock = () => Date.now()) {
    this.repository = repository;
    this.clock = clock;
  }
  requireRecord(id) {
    const record = this.repository.find(id);
    if (!record) throw new HttpError(404, 'Registro não encontrado.');
    return record;
  }
  create(input, files) {
    const { record, photos } = validateRecord(input, files);
    return this.repository.transaction(() => {
      // Repetir um rascunho já recebido não duplica registros nem consome novos códigos.
      return this.repository.find(record.id) || this.repository.insert(record, photos);
    });
  }
  rename(id, name) {
    const validName = text(name, 'Nome do registro');
    return this.repository.transaction(() =>
      this.repository.update({
        ...this.requireRecord(id),
        name: validName,
        updatedAt: new Date().toISOString(),
      }),
    );
  }
  addAttempt(id, productId, phase, input, file) {
    if (!uuid(productId) || !['before', 'after'].includes(phase))
      throw new HttpError(400, 'Produto ou etapa inválidos.');
    const { metadata, file: image } = validateAttempt(input, file);
    return this.repository.transaction(() => {
      const record = this.requireRecord(id);
      const product = record.products.find((p) => p.id === productId);
      if (!product) throw new HttpError(404, 'Produto não encontrado.');
      const all = record.products.flatMap((p) => [...p.before, ...p.after]);
      if (all.some((a) => a.id === metadata.id)) {
        if (product[phase].some((a) => a.id === metadata.id)) return record;
        throw new HttpError(409, 'Identificador de tentativa já utilizado.');
      }
      if (product[phase].length >= 3)
        throw new HttpError(409, 'Limite de três tentativas atingido.');
      this.repository.insertPhoto(id, metadata.id, image);
      product[phase].push({ ...metadata, number: product[phase].length + 1 });
      if (product.environmentalAnalysis)
        product.environmentalAnalysis = { ...product.environmentalAnalysis, stale: true };
      // Uma repetição idempotente ou tentativa recusada não invalida a finalização.
      invalidateFinalization(record, 'new-evidence', this.clock(), metadata.id);
      record.updatedAt = new Date().toISOString();
      return this.repository.update(record);
    });
  }
  setProductType(id, productId, value) {
    if (!uuid(productId)) throw new HttpError(400, 'Identificador de produto inválido.');
    const productType = text(value, 'Tipo de produto');
    return this.repository.transaction(() => {
      const record = this.requireRecord(id);
      const product = record.products.find((p) => p.id === productId);
      if (!product) throw new HttpError(404, 'Produto não encontrado.');
      if (product.productType === productType) return record;
      product.productType = productType;
      if (product.environmentalAnalysis)
        product.environmentalAnalysis = { ...product.environmentalAnalysis, stale: true };
      invalidateFinalization(record, 'product-type-changed', this.clock());
      record.updatedAt = new Date(this.clock()).toISOString();
      return this.repository.update(record);
    });
  }
  finalize(id, action) {
    const operations = {
      request: startFinalization,
      expedite: expediteFinalization,
      issue: issueFinalization,
    };
    if (!Object.hasOwn(operations, action))
      throw new HttpError(400, 'Ação de finalização inválida.');
    return this.repository.transaction(() => {
      const record = this.requireRecord(id);
      const before = JSON.stringify(record);
      const now = this.clock();
      operations[action](record, now);
      if (JSON.stringify(record) === before) return record;
      record.updatedAt = new Date(now).toISOString();
      return this.repository.update(record);
    });
  }
}
