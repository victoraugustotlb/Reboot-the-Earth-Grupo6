// Camada de persistência: todas as consultas SQLite e o armazenamento binário das fotos.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { HttpError } from '../../../shared/errors/HttpError.js';

export class ProductRepository {
  #db;
  #statements;
  #columns;

  constructor(filename = resolve('data/reboot.sqlite')) {
    if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
    const db = new DatabaseSync(filename);
    // FK protege as referências; WAL facilita leituras durante escritas; timeout espera por bloqueios curtos.
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    db.exec(readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    const find = db.prepare('SELECT * FROM extractions WHERE id = ?');
    // Valores são passados como parâmetros (?) para não concatenar entradas do usuário no SQL.
    const columns = [
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
      'hash',
      'status',
      'created_at',
    ];
    const insert = db.prepare(
      `INSERT INTO extractions (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
    );
    const upload = db.prepare('INSERT INTO photos (path, mime_type, content) VALUES (?, ?, ?)');
    const remove = db.prepare('DELETE FROM photos WHERE path = ?');
    const complete = db.prepare(
      'UPDATE extractions SET photo_after = ?, photo_after_hash = ?, status = ?, hash = ? WHERE id = ? AND photo_after IS NULL',
    );
    const photo = db.prepare(`SELECT photos.mime_type, photos.content FROM photos WHERE path = ?
    AND EXISTS (SELECT 1 FROM extractions WHERE photo_before = photos.path OR photo_after = photos.path)`);
    this.#db = db;
    this.#columns = columns;
    this.#statements = { find, insert, upload, remove, complete, photo };
  }
  // Fotos são bytes no banco: o "path" é um identificador lógico, não um caminho do Windows.
  async upload(path, file) {
    this.#statements.upload.run(path, file.mimetype, file.buffer);
    return path;
  }
  async remove(paths) {
    for (const path of paths) this.#statements.remove.run(path);
  }
  async insert(row) {
    this.#statements.insert.run(...this.#columns.map((key) => row[key] ?? null));
    return this.#statements.find.get(row.id);
  }
  async find(id) {
    return this.#statements.find.get(id) || null;
  }
  async complete(id, row) {
    // A condição no UPDATE impede duas requisições de substituir a foto uma da outra.
    const result = this.#statements.complete.run(
      row.photo_after,
      row.photo_after_hash,
      row.status,
      row.hash,
      id,
    );
    if (!result.changes) throw new HttpError(409, 'A foto posterior já foi registrada.');
    return this.#statements.find.get(id);
  }
  // A consulta preparada só retorna fotos que estejam vinculadas a um produto.
  async readPhoto(path) {
    const value = this.#statements.photo.get(path);
    return value ? { mimetype: value.mime_type, buffer: Buffer.from(value.content) } : null;
  }
  close() {
    this.#db.close();
  }
}

export const createRepository = (filename) => new ProductRepository(filename);
