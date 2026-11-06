// Valida os identificadores da associação entre registro, produto e relatório.
const uuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
export function validateGeoaiIds(req, res, next) {
  for (const key of ['id', 'productId', 'analysisId']) {
    if (req.params[key] !== undefined && !uuid(req.params[key]))
      return res.status(400).json({ error: 'Identificador GeoAI inválido.' });
  }
  next();
}
