import { uuid } from '../validators/recordValidator.js';
export function validateRecordId(req, res, next) {
  if (!uuid(req.params.id))
    return res.status(400).json({ error: 'Identificador de registro inválido.' });
  next();
}
