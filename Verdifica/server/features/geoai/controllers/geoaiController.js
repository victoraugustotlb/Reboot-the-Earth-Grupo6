import { GeoaiService } from '../services/geoaiService.js';
import { HttpError } from '../../../shared/errors/HttpError.js';
export class GeoaiController {
  constructor(repository, client) {
    this.repository = repository;
    this.client = client;
    this.service = new GeoaiService(repository, client);
  }
  catalog = async (req, res) => res.json(await this.client.catalog());
  analyze = async (req, res) => {
    const result = await this.service.analyze(req.params.id, req.params.productId, req.body);
    res.status(201).json(this.present(result));
  };
  present = (analysis) => {
    const { pdf, ...result } = analysis;
    return {
      ...result,
      pdfUrl: analysis.status === 'completed' ? `/api/geoai/analyses/${analysis.id}/pdf` : null,
    };
  };
  detail = (req, res) => {
    const analysis = this.repository.find(req.params.analysisId);
    if (!analysis) throw new HttpError(404, 'Análise não encontrada.');
    res.set('Cache-Control', 'no-store').json(this.present(analysis));
  };
  pdf = (req, res) => {
    const analysis = this.repository.find(req.params.analysisId);
    if (!analysis?.pdf) throw new HttpError(404, 'PDF não disponível.');
    res
      .set('Content-Disposition', `attachment; filename="verdefica-${analysis.id}.pdf"`)
      .set('Cache-Control', 'no-store')
      .type('application/pdf')
      .send(analysis.pdf);
  };
}
