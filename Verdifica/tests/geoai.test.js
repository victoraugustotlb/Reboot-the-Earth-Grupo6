import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RecordRepository } from '../server/features/records/repositories/recordRepository.js';
import { RecordService } from '../server/features/records/services/recordService.js';
import { GeoaiRepository } from '../server/features/geoai/repositories/geoaiRepository.js';
import { GeoaiService } from '../server/features/geoai/services/geoaiService.js';
import { GeoaiClient } from '../server/features/geoai/services/geoaiClient.js';
import { assertEnvironmentalApproval } from '../server/shared/utils/environmentalEvidence.js';
import { HttpError } from '../server/shared/errors/HttpError.js';
import { createApp } from '../server/app.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const attempt = () => ({
  id: randomUUID(),
  capturedAt: new Date().toISOString(),
  imageSource: 'camera',
  location: { source: 'device', latitude: -23.55, longitude: -46.63, accuracy: 12 },
});
const file = (id) => ({ originalname: id, mimetype: 'image/png', buffer: png });
function bundle(pedido, changes = {}) {
  return {
    pdf_base64: Buffer.from('%PDF-1.4 unit-test').toString('base64'),
    report: {
      id_relatorio: 'TEST-MOCK',
      ambiente: 'DEMONSTRACAO',
      referencias: {
        registro_id: pedido.registro_id,
        produto_id: pedido.produto_id,
        tentativa_id: pedido.tentativa_id,
      },
      status: 'sem_divergencia_detectada_nesta_analise',
      permissao: { fonte: 'BASE FICTICIA - NAO OFICIAL' },
      localizacao: { origem: 'device', verificacao: { situacao: 'compativel_geograficamente' } },
      indicadores: {
        mudanca_arborea_total_ha: 0,
        mudanca_arborea_dentro_ha: 0,
        mudanca_arborea_fora_ha: 0,
      },
      evidencias: {
        analise_satelite: {
          status: 'experimental',
          cenas_sentinel: [3, 4],
          cenas_dynamic_world: [4, 5],
        },
      },
      ...changes,
    },
  };
}
function setup(t, client = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'verdefica-geoai-'));
  const filename = join(directory, 'test.sqlite');
  const records = new RecordRepository(filename),
    repository = new GeoaiRepository(filename),
    service = new RecordService(records);
  t.after(() => {
    repository.close();
    records.close();
    for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
    rmdirSync(directory);
  });
  const before = attempt(),
    after = attempt();
  const saved = service.create(
    {
      id: randomUUID(),
      name: 'Registro',
      producer: 'Pessoa de teste',
      products: [
        { id: randomUUID(), species: 'Ipê', productType: 'Tora', before: [before], after: [after] },
      ],
    },
    [file(before.id), file(after.id)],
  );
  const gateway = {
    catalog: async () => ({ status: 'ok' }),
    checkPhoto: async () => ({
      modo: 'simulado_sem_ia',
      produto_aparentemente_compativel: null,
      pode_emitir_token: false,
    }),
    analyze: async (mode, pedido) => bundle(pedido),
    ...client,
  };
  return {
    records,
    repository,
    service,
    gateway,
    geoai: new GeoaiService(repository, gateway),
    saved,
    id: saved.id,
    productId: saved.products[0].id,
  };
}
test('GeoAI associa relatório e PDF aos bytes/evidências e libera só decisão favorável atual', async (t) => {
  const { geoai, id, productId, repository, service } = setup(t);
  const result = await geoai.analyze(id, productId, { mode: 'live' });
  assert.equal(result.decisao_token.pode_emitir, true);
  assert.equal(result.attemptId, result.report.referencias.tentativa_id);
  assert.match(repository.find(result.id).pdf.toString(), /^%PDF/);
  assert.doesNotThrow(() => assertEnvironmentalApproval(service.requireRecord(id)));
  service.finalize(id, 'request');
  service.finalize(id, 'expedite');
  assert.match(service.finalize(id, 'issue').demoFinalization.token, /^DEMO-/);
});
test('referência mantém GPS da foto separado da área fictícia e nunca aprova token', async (t) => {
  const { geoai, id, productId, service } = setup(t);
  const result = await geoai.analyze(id, productId, { mode: 'reference' });
  assert.equal(result.captureLocation.latitude, -23.55);
  assert.equal(result.analysisLocation.latitude, -12.5);
  assert.equal(result.analysisLocation.source, 'demo');
  assert.equal(result.decisao_token.pode_emitir, false);
  service.finalize(id, 'request');
  service.finalize(id, 'expedite');
  assert.throws(() => service.finalize(id, 'issue'), { status: 409 });
});
test('alerta, resultado desconhecido ou indicadores incompletos bloqueiam emissão', async (t) => {
  for (const changes of [
    { status: 'divergencia_para_conferir' },
    { status: 'desconhecido' },
    { indicadores: {} },
  ]) {
    const { geoai, id, productId, service } = setup(t, {
      analyze: async (mode, pedido) => bundle(pedido, changes),
    });
    const result = await geoai.analyze(id, productId, { mode: 'live' });
    assert.equal(result.decisao_token.pode_emitir, false);
    assert.throws(() => assertEnvironmentalApproval(service.requireRecord(id)), { status: 409 });
  }
});
test('erro em nova análise retira aprovação anterior e deixa estado de falha persistido', async (t) => {
  const { geoai, gateway, id, productId, service } = setup(t);
  await geoai.analyze(id, productId, { mode: 'live' });
  gateway.analyze = async () => {
    throw new HttpError(503, 'Earth Engine indisponível');
  };
  await assert.rejects(geoai.analyze(id, productId, { mode: 'live' }), { status: 503 });
  const a = service.requireRecord(id).products[0].environmentalAnalysis;
  assert.equal(a.status, 'failed');
  assert.equal(a.decisao_token.pode_emitir, false);
  assert.throws(() => assertEnvironmentalApproval(service.requireRecord(id)), { status: 409 });
});
test('foto nova durante a consulta torna o resultado histórico, sem sobrescrever evidências', async (t) => {
  const state = setup(t);
  state.gateway.analyze = async (mode, pedido) => {
    const a = attempt();
    state.service.addAttempt(state.id, state.productId, 'before', a, file(a.id));
    return bundle(pedido);
  };
  await assert.rejects(state.geoai.analyze(state.id, state.productId, { mode: 'live' }), {
    status: 409,
  });
  const product = state.service.requireRecord(state.id).products[0];
  assert.equal(product.before.length, 2);
  assert.equal(product.environmentalAnalysis.stale, true);
  assert.throws(() => assertEnvironmentalApproval(state.service.requireRecord(state.id)), {
    status: 409,
  });
});
test('contrato HTTP entrega relatório/PDF e omite os metadados privados no rastreio', async (t) => {
  const state = setup(t);
  const server = createApp({
    repository: {},
    recordRepository: state.records,
    geoaiRepository: state.repository,
    geoaiClient: state.gateway,
    authEnabled: false,
    publicBaseUrl: 'http://localhost:5173',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(
    `${base}/api/geoai/records/${state.id}/products/${state.productId}/analyze`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'reference' }),
    },
  );
  assert.equal(response.status, 201);
  const report = await response.json();
  const pdf = await fetch(base + report.pdfUrl);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  const detail = await (await fetch(`${base}/api/geoai/analyses/${report.id}`)).json();
  assert.equal(detail.report.id_relatorio, 'TEST-MOCK');
  assert.equal('pdf' in detail, false);
  const trace = await (await fetch(`${base}/api/records/${state.id}/trace`)).json();
  assert.equal('environmentalAnalysis' in trace.products[0], false);
});
test('GPS simulado ou tentativa de outro produto não chega à consulta real de satélite', async (t) => {
  const state = setup(t, {
    analyze: async () => {
      throw new Error('Não deveria consultar');
    },
  });
  const row = state.records.find(state.id);
  row.products[0].after[0].location.source = 'demo';
  state.records.update(row);
  await assert.rejects(state.geoai.analyze(state.id, state.productId, { mode: 'live' }), {
    status: 400,
  });
  await assert.rejects(
    state.geoai.analyze(state.id, state.productId, { mode: 'reference', attemptId: randomUUID() }),
    { status: 400 },
  );
});

test('gateway não aceita destinos externos ou URLs com credenciais', () => {
  for (const url of [
    'https://example.com',
    'http://user:password@127.0.0.1:8000',
    'http://127.0.0.1:8000/path',
  ])
    assert.throws(() => new GeoaiClient(url));
});
