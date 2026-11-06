import { randomUUID } from 'node:crypto';
import { HttpError } from '../../../shared/errors/HttpError.js';
import { evidenceHash } from '../../../shared/utils/environmentalEvidence.js';
import { decideReport } from '../models/decision.js';
import { validateAnalysis } from '../validators/geoaiValidator.js';

export class GeoaiService {
  constructor(repository, client) {
    this.repository = repository;
    this.client = client;
  }
  async analyze(recordId, productId, input) {
    const settings = validateAnalysis(input);
    const record = this.repository.record(recordId);
    const product = record?.products.find((p) => p.id === productId);
    if (!product) throw new HttpError(404, 'Registro ou produto não encontrado.');
    const attempts = [...product.before, ...product.after];
    const attempt = settings.attemptId
      ? attempts.find((a) => a.id === settings.attemptId)
      : attempts.at(-1);
    if (settings.attemptId && !attempt)
      throw new HttpError(400, 'A tentativa não pertence ao produto.');
    if (
      settings.mode === 'live' &&
      (!attempt ||
        attempt.location?.source !== 'device' ||
        !Number.isFinite(attempt.location.accuracy))
    )
      throw new HttpError(
        400,
        'A análise real exige uma tentativa com GPS do dispositivo e precisão informada.',
      );
    const capture = attempt?.location || null;
    const pedido = {
      permissao_id: settings.permissionId,
      latitude: settings.mode === 'reference' ? -12.5 : capture.latitude,
      longitude: settings.mode === 'reference' ? -54.5 : capture.longitude,
      precisao_metros: settings.mode === 'reference' ? null : capture.accuracy,
      origem_localizacao: settings.mode === 'reference' ? 'demo' : 'device',
      raio_metros: settings.radius,
      ano_inicial: settings.yearBefore,
      ano_final: settings.yearAfter,
      registro_id: recordId,
      produto_id: productId,
      tentativa_id: attempt?.id || null,
    };
    const analysis = {
      id: randomUUID(),
      recordId,
      productId,
      attemptId: attempt?.id || null,
      mode: settings.mode,
      inputHash: evidenceHash(product),
      createdAt: new Date().toISOString(),
      status: 'pending',
      captureLocation: capture,
      analysisLocation: {
        latitude: pedido.latitude,
        longitude: pedido.longitude,
        source: pedido.origem_localizacao,
      },
      request: pedido,
      decisao_token: {
        pode_emitir: false,
        status: 'evidencias_insuficientes',
        motivo: 'Análise ainda não concluída.',
        tipo_token: null,
      },
    };
    this.repository.begin(analysis);
    try {
      if (attempt) {
        const photo = this.repository.photo(recordId, attempt.id);
        if (!photo) throw new HttpError(409, 'Foto da tentativa indisponível.');
        analysis.photoCheck = await this.client.checkPhoto(
          photo,
          product.productType || product.species || 'produto florestal',
        );
        // Verificação de formato não é inferência visual nem aprovação do produto.
      }
      const bundle = await this.client.analyze(settings.mode, pedido);
      const report = bundle.report;
      if (
        !report ||
        report.referencias?.registro_id !== recordId ||
        report.referencias?.produto_id !== productId ||
        (report.referencias?.tentativa_id || null) !== (attempt?.id || null)
      )
        throw new HttpError(502, 'O relatório retornado não corresponde à evidência selecionada.');
      const decision = decideReport(report, settings.mode);
      const pdf =
        typeof bundle.pdf_base64 === 'string' ? Buffer.from(bundle.pdf_base64, 'base64') : null;
      if (!pdf || pdf.subarray(0, 5).toString() !== '%PDF-')
        throw new HttpError(502, 'O GeoAI não retornou um PDF válido.');
      const saved = this.repository.finish(
        {
          ...analysis,
          report: { ...report, decisao_token: decision },
          decisao_token: decision,
          status: 'completed',
        },
        pdf,
      );
      if (saved.stale) {
        const error = new HttpError(
          409,
          'As evidências mudaram durante a análise. Execute uma nova análise.',
        );
        error.staleResult = true;
        throw error;
      }
      return saved;
    } catch (error) {
      if (error.staleResult) throw error;
      this.repository.finish({
        ...analysis,
        status: 'failed',
        error: error.message,
        decisao_token: {
          pode_emitir: false,
          status: 'evidencias_insuficientes',
          motivo: 'Análise não concluída; token bloqueado.',
          tipo_token: null,
        },
      });
      throw error;
    }
  }
}
