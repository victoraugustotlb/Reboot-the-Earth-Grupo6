import multer from 'multer';

// Recebe as fotos dos produtos em memória antes de gravá-las como BLOBs no SQLite.
// Limites de quantidade e tamanho evitam uploads excessivos no MVP.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 2,
    fields: 5,
    fieldSize: 1024,
  },
});
