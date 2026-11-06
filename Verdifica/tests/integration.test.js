import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config/env.js';

const env = {
  AUTH_ENABLED: 'true',
  API_WRITE_TOKEN: 'token-de-teste-com-24-caracteres',
  PUBLIC_BASE_URL: 'https://frontend.example',
};

test('MVP sem login aceita configuração sem senha e restringe a execução ao computador local', () => {
  const config = loadConfig({ PUBLIC_BASE_URL: 'http://127.0.0.1:5173' });
  assert.equal(config.authEnabled, false);
  assert.equal(config.host, '127.0.0.1');
  assert.throws(
    () => loadConfig({ PUBLIC_BASE_URL: 'http://127.0.0.1:5173', HOST: '0.0.0.0' }),
    /loopback/,
  );
});

test('configuração aceita frontend externo, origens explícitas e host configurável', () => {
  const config = loadConfig({
    ...env,
    HOST: '0.0.0.0',
    PORT: '8080',
    CORS_ORIGINS: 'https://frontend.example, http://localhost:5173,https://frontend.example/',
  });
  assert.equal(config.publicBaseUrl, env.PUBLIC_BASE_URL);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.port, 8080);
  assert.deepEqual(config.corsOrigins, ['https://frontend.example', 'http://localhost:5173']);
  assert.deepEqual(loadConfig(env).corsOrigins, [env.PUBLIC_BASE_URL]);
  assert.deepEqual(loadConfig({ ...env, CORS_ORIGINS: '' }).corsOrigins, []);
});

test('configuração rejeita URLs inválidas, curingas, caminhos, credenciais e portas inválidas', () => {
  for (const patch of [
    { PUBLIC_BASE_URL: 'invalido' },
    { PUBLIC_BASE_URL: 'ftp://frontend.example' },
    { PUBLIC_BASE_URL: 'https://user:password@frontend.example' },
    { PUBLIC_BASE_URL: 'https://frontend.example/app' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://frontend.example?teste=1' },
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: 'abc' },
  ])
    assert.throws(() => loadConfig({ ...env, ...patch }));
});

test('API independente: CORS, preflight, autenticação e ausência de páginas HTML', async (t) => {
  const app = createApp({ ...loadConfig(env), repository: {} });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const origin = env.PUBLIC_BASE_URL;
  const health = await fetch(`${base}/api/health`, { headers: { Origin: origin } });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), origin);
  assert.match(health.headers.get('vary'), /Origin/);

  for (const method of ['POST', 'PATCH']) {
    const preflight = await fetch(`${base}/api/products`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': method,
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods'), new RegExp(method));
    assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
  }
  for (const headers of [
    { Origin: 'https://unknown.example', 'Access-Control-Request-Method': 'POST' },
    { Origin: origin, 'Access-Control-Request-Method': 'DELETE' },
    {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'X-Unknown',
    },
  ]) {
    const response = await fetch(`${base}/api/products`, { method: 'OPTIONS', headers });
    assert.equal(response.status, 403);
  }
  const denied = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://unknown.example' },
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.has('access-control-allow-origin'), false);
  const unauthorized = await fetch(`${base}/api/products`, {
    method: 'POST',
    headers: { Origin: origin },
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get('access-control-allow-origin'), origin);
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  for (const path of ['/', '/rastreio/produto', '/index.html', '/api/unknown']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await response.json(), { error: 'Rota não encontrada.' });
  }
});
