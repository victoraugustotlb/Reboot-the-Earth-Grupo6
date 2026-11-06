import { HttpError } from '../../../shared/errors/HttpError.js';

export class GeoaiClient {
  constructor(baseUrl = 'http://127.0.0.1:8000') {
    const url = new URL(baseUrl);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('GEOAI_BASE_URL deve apontar para a origem do serviço local.');
    this.baseUrl = url.origin;
  }
  async request(path, options = {}, timeout = 180000) {
    let response;
    try {
      response = await fetch(this.baseUrl + path, {
        ...options,
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
      });
    } catch {
      throw new HttpError(
        503,
        'GeoAI local indisponível ou tempo excedido. Execute npm run setup:geoai e npm run dev.',
      );
    }
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 24 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(502, 'Resposta GeoAI acima do limite.');
      }
      chunks.push(Buffer.from(value));
    }
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      throw new HttpError(502, 'Resposta inválida do GeoAI.');
    }
    if (!response.ok)
      throw new HttpError(
        response.status === 503 ? 503 : response.status < 500 ? 400 : 502,
        response.status === 503
          ? 'Earth Engine não configurado ou indisponível. Configure EE_PROJECT e autentique sua conta; o modo de referência permanece disponível.'
          : typeof body.detail === 'string'
            ? body.detail
            : 'O GeoAI não concluiu a análise.',
      );
    return body;
  }
  async catalog() {
    const [status, permits, reference] = await Promise.all([
      this.request('/integracao/status', {}, 5000),
      this.request('/permissoes/demo', {}, 5000),
      this.request('/amazonia1/resumo', {}, 5000),
    ]);
    return { ...status, permits: permits.permissoes, reference };
  }
  checkPhoto(photo, productName) {
    const form = new FormData();
    form.set('foto', new Blob([photo.buffer], { type: photo.mimetype }), 'evidence');
    form.set('produto_declarado', productName);
    return this.request('/imagem/analisar', { method: 'POST', body: form }, 15000);
  }
  analyze(mode, pedido) {
    return this.request('/integracao/analisar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo: mode, pedido }),
    });
  }
}
