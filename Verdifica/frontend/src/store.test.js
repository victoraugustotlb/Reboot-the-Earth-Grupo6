import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listRecords,
  createRecord,
  renameRecord,
  addAttempt,
  uid,
  appendAttempt,
  isComplete,
  discrepancies,
} from './store.js';
import { setApiToken } from './api.js';
import { environmentalApproved } from './domain/record.js';
import { analyzeProduct } from './services/geoai.js';

test('triagem visual bloqueia referência/erro e adaptador envia a evidência selecionada', async (t) => {
  const product = {
    environmentalAnalysis: {
      status: 'completed',
      mode: 'reference',
      decisao_token: { pode_emitir: true, status: 'sem_alertas_detectados' },
    },
  };
  assert.equal(environmentalApproved({ products: [product] }), false);
  product.environmentalAnalysis.mode = 'live';
  product.environmentalAnalysis.stale = true;
  assert.equal(environmentalApproved({ products: [product] }), false);
  const previous = globalThis.fetch;
  let call;
  globalThis.fetch = async (path, options) => {
    call = { path, ...options };
    return new Response('{}');
  };
  t.after(() => {
    globalThis.fetch = previous;
  });
  await analyzeProduct('registro', 'produto', { mode: 'reference', attemptId: 'foto' });
  assert.equal(call.path, '/api/geoai/records/registro/products/produto/analyze');
  assert.equal(JSON.parse(call.body).attemptId, 'foto');
});
import {
  startDemoFinalization,
  expediteDemoFinalization,
  issueDemoToken,
  setProductType,
  canFinalizeDemo,
  demoStatus,
  DEMO_WAIT_MS,
} from './store.js';

test('atualização usa API para tipo, solicitação, antecipação e emissão de etiqueta', async (t) => {
  const calls = [],
    previous = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return new Response('{}');
  };
  t.after(() => {
    globalThis.fetch = previous;
  });
  await setProductType('r', 'p', 'Tábua');
  await startDemoFinalization('r');
  await expediteDemoFinalization('r');
  await issueDemoToken('r');
  assert.equal(calls[0].path, '/api/records/r/products/p/type');
  assert.deepEqual(JSON.parse(calls[0].body), { productType: 'Tábua' });
  assert.deepEqual(
    calls.slice(1).map((c) => c.path),
    ['request', 'expedite', 'issue'].map((action) => `/api/records/r/finalization/${action}`),
  );
});
test('elegibilidade visual aceita fotos por URL da API e calcula os cinco dias', () => {
  const attempt = {
    photo: '/api/foto',
    photoHash: 'hash',
    location: { latitude: -3, longitude: -60 },
  };
  const record = {
    products: [{ productType: 'Tora', species: 'Ipê', before: [attempt], after: [attempt] }],
  };
  assert.ok(canFinalizeDemo(record));
  assert.equal(demoStatus(record), 'ready');
  const start = Date.parse('2026-11-06T12:00:00Z');
  record.demoFinalization = {
    startedAt: new Date(start).toISOString(),
    availableAt: new Date(start + DEMO_WAIT_MS).toISOString(),
  };
  assert.equal(demoStatus(record, start + DEMO_WAIT_MS - 1), 'waiting');
  assert.equal(demoStatus(record, start + DEMO_WAIT_MS), 'eligible');
});

test('adaptador envia registros, nomes e fotos à API sem armazenar a senha no navegador', async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (path, options) => {
    calls.push({ path, ...options });
    return new Response(JSON.stringify({ id: 'saved' }), { status: 200 });
  };
  t.after(() => {
    globalThis.fetch = original;
    setApiToken('');
  });
  setApiToken('senha-teste');
  const attempt = { id: uid(), photo: new Blob(['foto'], { type: 'image/png' }), location: null };
  await listRecords();
  await createRecord({
    id: uid(),
    name: 'Área',
    producer: 'Ana',
    products: [{ id: uid(), species: 'Ipê', before: [attempt], after: [] }],
  });
  await renameRecord('registro', 'Novo nome');
  await addAttempt('registro', 'produto', 'after', attempt);
  assert.equal(calls[0].path, '/api/records');
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer senha-teste');
  assert.ok(calls[1].body instanceof FormData);
  const metadata = JSON.parse(calls[1].body.get('record'));
  assert.equal('photo' in metadata.products[0].before[0], false);
  assert.equal(calls[1].body.get('photos').name, attempt.id);
  assert.equal(calls[1].headers.has('Content-Type'), false);
  assert.equal(calls[2].method, 'PATCH');
  assert.equal(calls[3].path, '/api/records/registro/products/produto/attempts/after');
});
test('adaptador mantém erros da API para a interface preservar o rascunho', async (t) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: 'Senha inválida.' }), { status: 401 });
  t.after(() => {
    globalThis.fetch = original;
  });
  await assert.rejects(listRecords(), { message: 'Senha inválida.', status: 401 });
});
test('regras originais mantêm o limite e os alertas identificados de demonstração', () => {
  let product = { id: uid(), species: 'Ipê', before: [], after: [] };
  const location = { source: 'demo', latitude: -3.119, longitude: -60.0217, accuracy: 0 };
  for (let i = 0; i < 3; i++) product = appendAttempt(product, 'before', { id: uid(), location });
  assert.throws(() => appendAttempt(product, 'before', { id: uid() }), /Limite/);
  product = appendAttempt(product, 'after', {
    id: uid(),
    location: { ...location, latitude: -3.124 },
  });
  assert.equal(isComplete({ products: [product] }), true);
  assert.equal(discrepancies(product, 'after').length, 3);
});
