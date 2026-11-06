-- Esquema da funcionalidade de produtos: cria tabelas sem apagar registros existentes.
-- As chaves estrangeiras ligam os produtos às fotos e impedem referências inválidas.
CREATE TABLE IF NOT EXISTS photos (
  path TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  content BLOB NOT NULL CHECK (length(content) BETWEEN 1 AND 5242880)
);
CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  producer_name TEXT NOT NULL CHECK (length(producer_name) BETWEEN 2 AND 150),
  tree_species TEXT NOT NULL CHECK (length(tree_species) BETWEEN 2 AND 120),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  extraction_date TEXT NOT NULL,
  photo_before TEXT NOT NULL REFERENCES photos(path),
  photo_after TEXT REFERENCES photos(path),
  photo_before_hash TEXT NOT NULL,
  photo_after_hash TEXT,
  hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  created_at TEXT NOT NULL,
  CHECK ((status = 'completed') = (photo_after IS NOT NULL))
);
