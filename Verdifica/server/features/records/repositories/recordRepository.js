import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export class RecordRepository {
  #db;
  constructor(filename = resolve('data/reboot.sqlite')) {
    if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
    this.#db = new DatabaseSync(filename);
    this.#db.exec(
      'PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;',
    );
    this.#db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  }
  list() {
    return this.#db
      .prepare('SELECT code, payload FROM forest_records ORDER BY code DESC')
      .all()
      .map((row) => ({ ...JSON.parse(row.payload), code: row.code }));
  }
  find(id) {
    const row = this.#db.prepare('SELECT code, payload FROM forest_records WHERE id = ?').get(id);
    return row ? { ...JSON.parse(row.payload), code: row.code } : null;
  }
  // Nenhuma operação de rede ocorre na transação: registro, histórico e bytes são atômicos.
  transaction(action) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.#db.exec('COMMIT');
      return result;
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
  }
  insert(record, photos) {
    this.#db
      .prepare('INSERT INTO forest_records (id, payload) VALUES (?, ?)')
      .run(record.id, JSON.stringify(record));
    for (const photo of photos) this.insertPhoto(record.id, photo.id, photo.file);
    return this.find(record.id);
  }
  update(record) {
    const { code, ...payload } = record;
    this.#db
      .prepare('UPDATE forest_records SET payload = ? WHERE id = ?')
      .run(JSON.stringify(payload), record.id);
    return this.find(record.id);
  }
  insertPhoto(id, attemptId, file) {
    this.#db
      .prepare('INSERT INTO record_photos VALUES (?, ?, ?, ?)')
      .run(id, attemptId, file.mimetype, file.buffer);
  }
  photo(id, attemptId) {
    const row = this.#db
      .prepare(
        'SELECT mime_type, content FROM record_photos WHERE record_id = ? AND attempt_id = ?',
      )
      .get(id, attemptId);
    return row ? { mimetype: row.mime_type, buffer: Buffer.from(row.content) } : null;
  }
  close() {
    this.#db.close();
  }
}
