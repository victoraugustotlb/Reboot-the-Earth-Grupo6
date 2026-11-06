import { api } from '../api.js';
let catalogRequest;
export function geoaiCatalog() {
  if (!catalogRequest)
    catalogRequest = api('/api/geoai/catalog').catch((error) => {
      catalogRequest = null;
      throw error;
    });
  return catalogRequest;
}
export const analyzeProduct = (recordId, productId, settings) =>
  api(`/api/geoai/records/${recordId}/products/${productId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
export const analysisDetail = (id) => api(`/api/geoai/analyses/${id}`);
