import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { RecordRepository } from '../server/features/records/repositories/recordRepository.js';
import { RecordService } from '../server/features/records/services/recordService.js';
import { DEMO_WAIT_MS } from '../server/features/records/models/DemoFinalization.js';
import { presentRecord } from '../server/features/records/models/ForestRecord.js';
import { createApp } from '../server/app.js';
import { evidenceHash } from '../server/shared/utils/environmentalEvidence.js';

// Fixtures de unidade: a aprovação é simulada aqui; a integração GeoAI tem testes separados.
function approve(repository, id) {
  repository.transaction(() => {
    const record = repository.find(id);
    for (const product of record.products)
      product.environmentalAnalysis = {
        status: 'completed',
        mode: 'live',
        inputHash: evidenceHash(product),
        stale: false,
        decisao_token: {
          pode_emitir: true,
          status: 'sem_alertas_detectados',
          tipo_token: 'rastro_experimental',
        },
      };
    repository.update(record);
  });
}

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const evidence = () => ({
  id: randomUUID(),
  capturedAt: '2026-11-06T12:00:00.000Z',
  imageSource: 'camera',
  location: { source: 'device', latitude: -3.119123, longitude: -60.021712, accuracy: 12 },
});
const file = (id) => ({ originalname: id, buffer: png, mimetype: 'image/png' });
function setup(t, productType = 'Madeira em tora') {
  let now = Date.parse('2026-11-06T12:00:00Z');
  const repository = new RecordRepository(':memory:');
  t.after(() => repository.close());
  const service = new RecordService(repository, () => now);
  const before = evidence(),
    after = evidence();
  const saved = service.create(
    {
      id: randomUUID(),
      name: 'Área do Rio',
      producer: 'Ana',
      products: [
        { id: randomUUID(), species: 'Ipê', productType, before: [before], after: [after] },
      ],
    },
    [file(before.id), file(after.id)],
  );
  approve(repository, saved.id);
  return {
    repository,
    service,
    saved,
    setNow: (value) => {
      now = value;
    },
  };
}
test('prazo de cinco dias é imposto pelo relógio da API e emissão é idempotente', (t) => {
  const { service, saved, setNow } = setup(t);
  const started = service.finalize(saved.id, 'request');
  const flow = started.demoFinalization;
  assert.equal(Date.parse(flow.availableAt) - Date.parse(flow.startedAt), DEMO_WAIT_MS);
  assert.deepEqual(service.finalize(saved.id, 'request').demoFinalization, flow);
  setNow(Date.parse(flow.availableAt) - 1);
  assert.throws(() => service.finalize(saved.id, 'issue'), { status: 409 });
  setNow(Date.parse(flow.availableAt));
  const issued = service.finalize(saved.id, 'issue');
  assert.match(issued.demoFinalization.token, /^DEMO-/);
  assert.equal(issued.demoFinalization.labels[0].payload.tipo, 'Madeira em tora');
  assert.equal(issued.demoFinalization.labels[0].payload.antecipacaoPitch, null);
  assert.equal(issued.demoFinalization.labels[0].payload.antes[0].local.lat, -3.119123);
  assert.deepEqual(service.finalize(saved.id, 'issue'), issued);
});
test('antecipação é auditável; renomear preserva etiquetas e tipo alterado exige novo ciclo', (t) => {
  const { service, saved } = setup(t);
  const requested = service.finalize(saved.id, 'request');
  const accelerated = service.finalize(saved.id, 'expedite');
  assert.equal(accelerated.demoFinalization.availableAt, requested.demoFinalization.availableAt);
  const issued = service.finalize(saved.id, 'issue');
  assert.ok(issued.demoFinalization.labels[0].payload.antecipacaoPitch);
  const renamed = service.rename(saved.id, 'Outro nome');
  assert.deepEqual(renamed.demoFinalization, issued.demoFinalization);
  const same = service.setProductType(saved.id, saved.products[0].id, 'Madeira em tora');
  assert.deepEqual(same.demoFinalization, issued.demoFinalization);
  const changed = service.setProductType(saved.id, saved.products[0].id, 'Tábua');
  assert.equal(changed.demoFinalization, undefined);
  assert.equal(changed.demoFinalizationHistory[0].reason, 'product-type-changed');
  assert.equal(changed.demoFinalizationHistory[0].token, issued.demoFinalization.token);
  const next = service.finalize(saved.id, 'request');
  assert.notEqual(next.demoFinalization.id, issued.demoFinalization.id);
  assert.throws(() => service.finalize(saved.id, 'issue'), { status: 409 });
});
test('nova foto invalida o ciclo; repetição e tentativa acima do limite o preservam', (t) => {
  const { service, saved } = setup(t);
  const id = saved.products[0].id;
  service.finalize(saved.id, 'request');
  service.finalize(saved.id, 'expedite');
  const issued = service.finalize(saved.id, 'issue');
  const repeated = service.addAttempt(
    saved.id,
    id,
    'before',
    saved.products[0].before[0],
    file('repeat'),
  );
  assert.deepEqual(repeated.demoFinalization, issued.demoFinalization);
  const next = evidence();
  const updated = service.addAttempt(saved.id, id, 'before', next, file(next.id));
  assert.equal(updated.demoFinalization, undefined);
  assert.equal(updated.demoFinalizationHistory[0].attemptId, next.id);
  assert.equal(updated.products[0].before.length, 2);
  const third = evidence();
  service.addAttempt(saved.id, id, 'before', third, file(third.id));
  const requested = service.finalize(saved.id, 'request');
  assert.throws(() => service.addAttempt(saved.id, id, 'before', evidence(), file('extra')), {
    status: 409,
  });
  assert.deepEqual(service.requireRecord(saved.id).demoFinalization, requested.demoFinalization);
});
test('registros anteriores podem receber tipo e snapshots privados não vazam no rastreio', (t) => {
  const { service, saved, repository } = setup(t, '');
  assert.throws(() => service.finalize(saved.id, 'request'), { status: 409 });
  service.setProductType(saved.id, saved.products[0].id, 'Tábua');
  approve(repository, saved.id);
  service.finalize(saved.id, 'request');
  service.finalize(saved.id, 'expedite');
  const issued = service.finalize(saved.id, 'issue');
  const privateData = presentRecord(issued, 'http://localhost:5173');
  const publicData = presentRecord(issued, 'http://localhost:5173', true);
  assert.ok(privateData.demoFinalization.labels.length);
  assert.equal(publicData.demoFinalization, undefined);
  assert.equal(publicData.producer, undefined);
  assert.equal(publicData.products[0].before[0].location.latitude, -3.12);
});
test('novos endpoints aceitam tipo e ciclo sem login e usam snapshots persistidos', async (t) => {
  const { repository, saved } = setup(t);
  const server = createApp({
    repository: {},
    recordRepository: repository,
    authEnabled: false,
    publicBaseUrl: 'http://localhost:5173',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/records/${saved.id}`;
  const patch = await fetch(`${base}/products/${saved.products[0].id}/type`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productType: 'Viga' }),
  });
  assert.equal(patch.status, 200);
  approve(repository, saved.id);
  for (const action of ['request', 'expedite', 'issue']) {
    const response = await fetch(`${base}/finalization/${action}`, { method: 'POST' });
    assert.equal(response.status, 200);
    const record = await response.json();
    if (action === 'issue') assert.equal(record.demoFinalization.labels[0].payload.tipo, 'Viga');
  }
  assert.equal((await fetch(`${base}/finalization/toString`, { method: 'POST' })).status, 400);
});
