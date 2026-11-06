CREATE TABLE IF NOT EXISTS geoai_analyses (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES forest_records(id),
  product_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  pdf BLOB
);
CREATE INDEX IF NOT EXISTS geoai_analyses_product ON geoai_analyses(record_id, product_id);
