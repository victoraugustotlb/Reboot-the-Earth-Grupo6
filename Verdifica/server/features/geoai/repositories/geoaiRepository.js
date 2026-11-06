import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HttpError } from '../../../shared/errors/HttpError.js';
import { evidenceHash } from '../../../shared/utils/environmentalEvidence.js';
import { invalidateFinalization } from '../../records/models/DemoFinalization.js';

export class GeoaiRepository {
  constructor(filename = resolve('data/reboot.sqlite')) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    this.db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  }
  record(id) {
    const row = this.db.prepare('SELECT code,payload FROM forest_records WHERE id=?').get(id);
    return row ? { ...JSON.parse(row.payload), code: row.code } : null;
  }
  photo(id, attemptId) {
    const row = this.db
      .prepare('SELECT mime_type,content FROM record_photos WHERE record_id=? AND attempt_id=?')
      .get(id, attemptId);
    return row ? { mimetype: row.mime_type, buffer: Buffer.from(row.content) } : null;
  }
  find(id) {
    const row = this.db.prepare('SELECT payload,pdf FROM geoai_analyses WHERE id=?').get(id);
    return row ? { ...JSON.parse(row.payload), pdf: row.pdf ? Buffer.from(row.pdf) : null } : null;
  }
  writeRecord(record) {
    const { code, ...payload } = record;
    this.db
      .prepare('UPDATE forest_records SET payload=? WHERE id=?')
      .run(JSON.stringify(payload), record.id);
  }
  transaction(change) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = change();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  begin(analysis) {
    return this.transaction(() => {
      const record = this.record(analysis.recordId);
      const product = record?.products.find((p) => p.id === analysis.productId);
      if (!product || evidenceHash(product) !== analysis.inputHash)
        throw new HttpError(409, 'O produto mudou antes da análise. Atualize a página.');
      this.db
        .prepare('INSERT INTO geoai_analyses (id,record_id,product_id,payload) VALUES (?,?,?,?)')
        .run(analysis.id, analysis.recordId, analysis.productId, JSON.stringify(analysis));
      product.environmentalAnalysis = this.summary(analysis);
      invalidateFinalization(record, 'environmental-analysis-updated', Date.now());
      record.updatedAt = new Date().toISOString();
      this.writeRecord(record);
    });
  }
  summary(a) {
    return {
      analysisId: a.id,
      status: a.status,
      mode: a.mode,
      inputHash: a.inputHash,
      createdAt: a.createdAt,
      stale: a.stale || false,
      decisao_token: a.decisao_token,
      reportStatus: a.report?.status,
      error: a.error,
      photoCheck: a.photoCheck,
    };
  }
  finish(analysis, pdf = null) {
    return this.transaction(() => {
      const record = this.record(analysis.recordId);
      const product = record?.products.find((p) => p.id === analysis.productId);
      const stale =
        !product ||
        evidenceHash(product) !== analysis.inputHash ||
        product.environmentalAnalysis?.analysisId !== analysis.id;
      const saved = { ...analysis, stale };
      this.db
        .prepare('UPDATE geoai_analyses SET payload=?,pdf=? WHERE id=?')
        .run(JSON.stringify(saved), pdf, saved.id);
      if (!stale) {
        product.environmentalAnalysis = this.summary(saved);
        record.updatedAt = new Date().toISOString();
        this.writeRecord(record);
      }
      return saved;
    });
  }
  close() {
    this.db.close();
  }
}
