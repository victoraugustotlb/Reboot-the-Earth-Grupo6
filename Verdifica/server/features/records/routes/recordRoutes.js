import { Router, json } from 'express';
import { RecordController } from '../controllers/recordController.js';
import { recordUpload } from '../middlewares/upload.js';
import { validateRecordId } from '../middlewares/validateId.js';
import { createAuth } from '../../../shared/middlewares/auth.js';
export function createRecordRoutes({ recordRepository, writeToken, publicBaseUrl, authEnabled }) {
  const router = Router();
  const controller = new RecordController(recordRepository, publicBaseUrl);
  const auth = createAuth(writeToken, authEnabled);
  router.get('/', auth, controller.list);
  router.post('/', auth, recordUpload.array('photos', 60), controller.create);
  router.patch('/:id', validateRecordId, auth, json({ limit: '4kb' }), controller.rename);
  router.patch(
    '/:id/products/:productId/type',
    validateRecordId,
    auth,
    json({ limit: '4kb' }),
    controller.productType,
  );
  router.post('/:id/finalization/:action', validateRecordId, auth, controller.finalize);
  router.post(
    '/:id/products/:productId/attempts/:phase',
    validateRecordId,
    auth,
    recordUpload.single('photo'),
    controller.attempt,
  );
  router.get('/:id/trace', validateRecordId, controller.trace);
  router.get('/:id/photos/:attemptId', validateRecordId, controller.photo);
  return router;
}
