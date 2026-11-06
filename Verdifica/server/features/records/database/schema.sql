-- Registros do frontend e suas fotos, sem alterar as tabelas da API de produtos.
CREATE TABLE IF NOT EXISTS forest_records (
  code INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS record_photos (
  record_id TEXT NOT NULL REFERENCES forest_records(id),
  attempt_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  content BLOB NOT NULL,
  PRIMARY KEY (record_id, attempt_id)
);
