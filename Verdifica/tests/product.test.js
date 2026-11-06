// Testes das regras de negócio, contrato HTTP e persistência SQLite real.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductService } from '../server/features/products/services/productService.js';
import { hashProduct } from '../server/features/products/utils/hash.js';
import {
  validateProduct,
  validateImage,
} from '../server/features/products/validators/productValidator.js';
import { HttpError } from '../server/shared/errors/HttpError.js';
import { createApp } from '../server/app.js';
import { createRepository } from '../server/features/products/repositories/productRepository.js';
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fields = {
  producer_name: '  Ana Silva  ',
  tree_species: 'Eucalipto',
  latitude: '-23.5',
  longitude: '-46.6',
  extraction_date: '2026-11-05',
};
const photo = {
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  ),
  mimetype: 'image/png',
};
function fakeRepository() {
  // Dublê em memória para testar falhas e regras sem depender de arquivos de banco.
  const rows = new Map();
  const objects = new Map();
  const removed = [];
  return {
    rows,
    objects,
    removed,
    async upload(path, file) {
      objects.set(path, file.buffer);
      return path;
    },
    async remove(paths) {
      removed.push(...paths);
      paths.forEach((p) => objects.delete(p));
    },
    async insert(row) {
      rows.set(row.id, row);
      return row;
    },
    async find(id) {
      return rows.get(id) || null;
    },
    async complete(id, row) {
      if (rows.get(id).photo_after) throw new HttpError(409, 'Conflito');
      rows.set(id, row);
      return row;
    },
  };
}
test('valida coordenadas, campos vazios e datas reais', () => {
  assert.equal(validateProduct(fields).producer_name, 'Ana Silva');
  for (const patch of [
    { latitude: '' },
    { latitude: '91' },
    { longitude: '-181' },
    { latitude: 'NaN' },
    { latitude: ['1'] },
    { extraction_date: '2026-02-30' },
    { producer_name: ' ' },
    { tree_species: 'x' },
  ]) {
    assert.throws(() => validateProduct({ ...fields, ...patch }), { status: 400 });
  }
  assert.throws(() => validateImage({ ...photo, buffer: Buffer.from('<script/>') }), {
    status: 400,
  });
});
test('SQLite real: cadastro HTTP, fotos, conclusão e persistência após reabrir o banco', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'reboot-sqlite-'));
  const filename = join(directory, 'test.sqlite');
  let repo = createRepository(filename);
  let server;
  t.after(async () => {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    repo?.close();
    for (const suffix of ['', '-wal', '-shm'])
      if (existsSync(filename + suffix)) unlinkSync(filename + suffix);
    rmdirSync(directory);
  });
  server = createApp({
    repository: repo,
    writeToken: 'local-test',
    publicBaseUrl: 'http://127.0.0.1:5173',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  form.set('photo_before', new Blob([photo.buffer], { type: photo.mimetype }), 'before.png');
  const headers = { Authorization: 'Bearer local-test' };
  const response = await fetch(`${base}/api/products`, { method: 'POST', headers, body: form });
  assert.equal(response.status, 201);
  const receipt = await response.json();
  const lookup = await fetch(`${base}/api/products/${receipt.id}`);
  const publicRow = await lookup.json();
  assert.equal(publicRow.hash, receipt.hash);
  assert.equal('producer_name' in publicRow, false);
  const image = await fetch(base + publicRow.photo_before);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), photo.buffer);
  assert.equal((await fetch(`${base}/api/products/${receipt.id}/photos/after`)).status, 404);
  assert.equal((await fetch(`${base}/api/products/${receipt.id}/photos/secret`)).status, 404);
  const after = new FormData();
  after.set('photo_after', new Blob([photo.buffer], { type: photo.mimetype }), 'after.png');
  const completion = await fetch(`${base}/api/products/${receipt.id}/photo-after`, {
    method: 'PATCH',
    headers,
    body: after,
  });
  assert.equal(completion.status, 200);
  const completed = await completion.json();
  assert.notEqual(completed.hash, receipt.hash);
  assert.equal(
    (
      await fetch(`${base}/api/products/${receipt.id}/photo-after`, {
        method: 'PATCH',
        headers,
        body: after,
      })
    ).status,
    409,
  );
  await new Promise((resolve) => server.close(resolve));
  repo.close();
  repo = null;
  repo = createRepository(filename);
  const persisted = await repo.find(receipt.id);
  assert.equal(persisted.status, 'completed');
  assert.equal(persisted.hash, completed.hash);
  assert.equal(persisted.hash, hashProduct(persisted));
  assert.deepEqual((await repo.readPhoto(persisted.photo_before)).buffer, photo.buffer);
  assert.deepEqual((await repo.readPhoto(persisted.photo_after)).buffer, photo.buffer);
});
test('cadastra produto pendente e conclui com novo hash', async () => {
  const repo = fakeRepository();
  const service = createProductService(repo);
  const row = await service.register(fields, { photo_before: [photo] });
  assert.match(row.id, /^[0-9a-f-]{36}$/);
  assert.equal(row.status, 'pending');
  assert.equal(row.hash, hashProduct(row));
  assert.equal(repo.objects.size, 1);
  const completed = await service.complete(row.id, photo);
  assert.equal(completed.status, 'completed');
  assert.notEqual(completed.hash, row.hash);
  assert.equal(completed.hash, hashProduct(completed));
  assert.equal(repo.objects.size, 2);
  await assert.rejects(service.complete(row.id, photo), { status: 409 });
});
test('cadastra com duas fotos e o hash detecta alteração de evidência', async () => {
  const row = await createProductService(fakeRepository()).register(fields, {
    photo_before: [photo],
    photo_after: [photo],
  });
  assert.equal(row.status, 'completed');
  assert.notEqual(row.hash, hashProduct({ ...row, photo_before_hash: 'alterado' }));
});
test('remove fotos se a persistência ou o segundo upload falharem', async () => {
  for (const failure of ['database', 'storage']) {
    const repo = fakeRepository();
    if (failure === 'database')
      repo.insert = async () => {
        throw new Error('Banco indisponível');
      };
    else {
      const upload = repo.upload;
      repo.upload = async (path, file) => {
        if (path.endsWith('/after')) throw new Error('Storage indisponível');
        return upload(path, file);
      };
    }
    await assert.rejects(
      createProductService(repo).register(fields, { photo_before: [photo], photo_after: [photo] }),
    );
    assert.equal(repo.objects.size, 0);
    assert.ok(repo.removed.length > 0);
  }
});
test('HTTP: autorização, multipart, consulta pública e foto posterior', async (t) => {
  const repo = fakeRepository();
  const app = createApp({
    repository: repo,
    writeToken: 'test-secret',
    publicBaseUrl: 'http://192.168.0.10:5173',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: 'Bearer test-secret' };
  assert.equal((await fetch(`${base}/api/products`, { method: 'POST' })).status, 401);
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.set(key, value));
  form.set('photo_before', new Blob([photo.buffer], { type: 'image/png' }), 'before.png');
  const response = await fetch(`${base}/api/products`, { method: 'POST', headers, body: form });
  assert.equal(response.status, 201);
  const receipt = await response.json();
  assert.equal(receipt.tracking_url, `http://192.168.0.10:5173/rastreio/${receipt.id}`);
  const publicResponse = await fetch(`${base}/api/products/${receipt.id}`);
  const publicRow = await publicResponse.json();
  assert.equal(publicResponse.status, 200);
  assert.equal(publicRow.tree_species, fields.tree_species);
  assert.equal('producer_name' in publicRow, false);
  assert.equal('latitude' in publicRow, false);
  assert.equal(publicRow.photo_before, `/api/products/${receipt.id}/photos/before`);
  const after = new FormData();
  after.set('photo_after', new Blob([photo.buffer], { type: 'image/png' }), 'after.png');
  assert.equal(
    (
      await fetch(`${base}/api/products/${receipt.id}/photo-after`, {
        method: 'PATCH',
        headers,
        body: after,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${base}/api/products/${receipt.id}/photo-after`, {
        method: 'PATCH',
        headers,
        body: after,
      })
    ).status,
    409,
  );
  assert.equal((await fetch(`${base}/api/products/not-a-uuid`)).status, 400);
  assert.equal(
    (await fetch(`${base}/api/products/00000000-0000-4000-8000-000000000000`)).status,
    404,
  );
});
test('HTTP: recusa cadastro sem foto ou imagem com conteúdo inválido', async (t) => {
  const repo = fakeRepository();
  const server = createApp({
    repository: repo,
    writeToken: 'test',
    publicBaseUrl: 'http://localhost',
  }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  for (const invalid of [false, true]) {
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.set(k, v));
    if (invalid)
      form.set('photo_before', new Blob(['not-an-image'], { type: 'image/png' }), 'fake.png');
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/products`, {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
      body: form,
    });
    assert.equal(res.status, 400);
    assert.equal(repo.rows.size, 0);
    assert.equal(repo.objects.size, 0);
  }
});
