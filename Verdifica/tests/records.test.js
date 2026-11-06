import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, unlinkSync, existsSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordRepository } from '../server/features/records/repositories/recordRepository.js';
import { createApp } from '../server/app.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
const attempt = () => ({
  id: randomUUID(),
  imageSource: 'camera',
  capturedAt: new Date().toISOString(),
  location: {
    source: 'demo',
    latitude: -3.119,
    longitude: -60.0217,
    accuracy: 0,
    timestamp: new Date().toISOString(),
  },
});
const record = () => ({
  id: randomUUID(),
  name: 'Área do Rio',
  producer: 'Ana',
  products: [{ id: randomUUID(), species: 'Ipê', before: [attempt()], after: [] }],
});
function form(record) {
  const body = new FormData();
  body.set('record', JSON.stringify(record));
  for (const p of record.products)
    for (const a of [...p.before, ...p.after])
      body.append('photos', new Blob([png], { type: 'image/png' }), a.id);
  return body;
}
async function setup(t, repository, authEnabled = true) {
  const server = createApp({
    repository: {},
    recordRepository: repository,
    writeToken: 'records-test',
    authEnabled,
    publicBaseUrl: 'http://127.0.0.1:5173',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    headers: { Authorization: 'Bearer records-test' },
  };
}

test('MVP sem login lista, cadastra e renomeia registros sem cabeçalho Authorization', async (t) => {
  const repo = new RecordRepository(':memory:');
  t.after(() => repo.close());
  const { base } = await setup(t, repo, false);
  assert.equal((await fetch(base + '/api/records')).status, 200);
  const response = await fetch(base + '/api/records', { method: 'POST', body: form(record()) });
  assert.equal(response.status, 201);
  const saved = await response.json();
  const rename = await fetch(`${base}/api/records/${saved.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sem login' }),
  });
  assert.equal(rename.status, 200);
  assert.equal((await rename.json()).name, 'Sem login');
});
test('registro do frontend: autorização, múltiplos produtos, fotos, rename e consulta pública', async (t) => {
  const repo = new RecordRepository(':memory:');
  t.after(() => repo.close());
  const { base, headers } = await setup(t, repo);
  assert.equal((await fetch(base + '/api/records')).status, 401);
  const input = record();
  input.products.push({ id: randomUUID(), species: 'Eucalipto', before: [], after: [] });
  const create = await fetch(base + '/api/records', { method: 'POST', headers, body: form(input) });
  assert.equal(create.status, 201);
  const saved = await create.json();
  assert.equal(saved.products.length, 2);
  assert.equal(saved.code, 1);
  assert.equal(saved.producer, 'Ana');
  assert.match(saved.hash, /^[0-9a-f]{64}$/);
  assert.equal(saved.tracking_url, `http://127.0.0.1:5173/rastreio/${saved.id}`);
  const image = await fetch(base + saved.products[0].before[0].photo);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const trace = await (await fetch(`${base}/api/records/${saved.id}/trace`)).json();
  assert.equal('producer' in trace, false);
  assert.equal('name' in trace, false);
  assert.equal(trace.products[0].before[0].location.latitude, -3.12);
  assert.equal(trace.products[0].before[0].location.source, 'demo');
  const rename = await fetch(`${base}/api/records/${saved.id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Área atualizada' }),
  });
  const renamed = await rename.json();
  assert.equal(renamed.name, 'Área atualizada');
  assert.equal(renamed.products[0].before[0].photo, saved.products[0].before[0].photo);
  assert.notEqual(renamed.hash, saved.hash);
  const repeat = await fetch(base + '/api/records', { method: 'POST', headers, body: form(input) });
  assert.equal((await repeat.json()).code, 1);
  assert.equal((await (await fetch(base + '/api/records', { headers })).json()).length, 1);
});
test('tentativas: até três por etapa, repetição idempotente e histórico sem substituição', async (t) => {
  const repo = new RecordRepository(':memory:');
  t.after(() => repo.close());
  const { base, headers } = await setup(t, repo);
  const input = record();
  const saved = await (
    await fetch(base + '/api/records', { method: 'POST', headers, body: form(input) })
  ).json();
  const path = `${base}/api/records/${saved.id}/products/${saved.products[0].id}/attempts/after`;
  const send = (a) => {
    const body = new FormData();
    body.set('attempt', JSON.stringify(a));
    body.set('photo', new Blob([png], { type: 'image/png' }), a.id);
    return fetch(path, { method: 'POST', headers, body });
  };
  const a = attempt();
  const first = await (await send(a)).json();
  assert.equal(first.products[0].after.length, 1);
  assert.equal((await (await send(a)).json()).products[0].after.length, 1);
  await send(attempt());
  const third = await (await send(attempt())).json();
  assert.equal(third.products[0].after.length, 3);
  assert.equal(third.products[0].before.length, 1);
  assert.equal((await send(attempt())).status, 409);
  assert.notEqual(first.hash, saved.hash);
});
test('validação e transação: rejeita fotos inválidas e desfaz uma gravação parcial', async (t) => {
  const repo = new RecordRepository(':memory:');
  t.after(() => repo.close());
  const { base, headers } = await setup(t, repo);
  const input = record();
  const invalid = form(input);
  invalid.delete('photos');
  invalid.append(
    'photos',
    new Blob(['falsa'], { type: 'image/png' }),
    input.products[0].before[0].id,
  );
  assert.equal(
    (await fetch(base + '/api/records', { method: 'POST', headers, body: invalid })).status,
    400,
  );
  assert.equal(repo.list().length, 0);
  const valid = {
    id: randomUUID(),
    name: 'Teste',
    producer: 'Ana',
    products: [],
    createdAt: new Date().toISOString(),
  };
  assert.throws(() =>
    repo.transaction(() => {
      repo.insert(valid, []);
      throw new Error('Interrompido');
    }),
  );
  assert.equal(repo.find(valid.id), null);
});
test('registros e bytes das fotos persistem após reabrir o SQLite', () => {
  const directory = mkdtempSync(join(tmpdir(), 'forest-records-'));
  const filename = join(directory, 'test.sqlite');
  let repo = new RecordRepository(filename);
  try {
    const data = { id: randomUUID(), name: 'Persistente', producer: 'Ana', products: [] };
    const photoId = randomUUID();
    repo.transaction(() =>
      repo.insert(data, [{ id: photoId, file: { mimetype: 'image/png', buffer: png } }]),
    );
    repo.close();
    repo = new RecordRepository(filename);
    assert.equal(repo.find(data.id).name, 'Persistente');
    assert.deepEqual(repo.photo(data.id, photoId).buffer, png);
  } finally {
    repo.close();
    for (const suffix of ['', '-wal', '-shm'])
      if (existsSync(filename + suffix)) unlinkSync(filename + suffix);
    rmdirSync(directory);
  }
});
