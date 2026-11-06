import { Router, json } from 'express';
import { createAuth } from '../../../shared/middlewares/auth.js';
import { GeoaiController } from '../controllers/geoaiController.js';
import { validateGeoaiIds } from '../middlewares/validateIds.js';
export function createGeoaiRoutes({ geoaiRepository, geoaiClient, writeToken, authEnabled }) {
  const router = Router(),
    controller = new GeoaiController(geoaiRepository, geoaiClient);
  router.use(createAuth(writeToken, authEnabled));
  router.get('/catalog', controller.catalog);
  router.post(
    '/records/:id/products/:productId/analyze',
    validateGeoaiIds,
    json({ limit: '8kb' }),
    controller.analyze,
  );
  router.get('/analyses/:analysisId', validateGeoaiIds, controller.detail);
  router.get('/analyses/:analysisId/pdf', validateGeoaiIds, controller.pdf);
  return router;
}
