// Valida o UUID v4 do produto antes de consultar o banco.
export const validateId = (req, res, next) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)
    ? next()
    : res.status(400).json({ error: 'Identificador inválido.' });
