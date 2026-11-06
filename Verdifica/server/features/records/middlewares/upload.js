import multer from 'multer';
// Até dez produtos com três fotos em cada etapa. Metadados são limitados separadamente.
export const recordUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 60, fileSize: 5 * 1024 * 1024, fields: 1, fieldSize: 128 * 1024 },
});
