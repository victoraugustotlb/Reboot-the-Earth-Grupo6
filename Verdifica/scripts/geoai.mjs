import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const python = resolve(
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const mode = process.argv[2] || 'serve';
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) process.exit(result.status || 1);
}
if (mode === 'setup') {
  if (!existsSync(python)) {
    const candidates = [
      process.env.PYTHON_EXECUTABLE,
      'python',
      'python3',
      ...(process.platform === 'win32' ? ['py'] : []),
      join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'),
    ].filter(Boolean);
    const available = candidates.find(
      (candidate) =>
        spawnSync(
          candidate,
          [
            ...(candidate === 'py' ? ['-3'] : []),
            '-c',
            'import sys; assert sys.version_info >= (3, 10)',
          ],
          { windowsHide: true, stdio: 'ignore' },
        ).status === 0,
    );
    if (!available) throw new Error('Instale Python 3.10+ ou configure PYTHON_EXECUTABLE.');
    run(available, [...(available === 'py' ? ['-3'] : []), '-m', 'venv', '.venv']);
  }
  const requirements = existsSync('geoai/backend/requirements.lock.txt')
    ? 'geoai/backend/requirements.lock.txt'
    : 'geoai/backend/requirements.txt';
  run(python, ['-m', 'pip', 'install', '-r', requirements]);
  process.exit(0);
}
if (!existsSync(python)) throw new Error('Execute npm run setup:geoai antes de iniciar o GeoAI.');
const args =
  mode === 'test'
    ? ['-m', 'unittest', 'discover', '-s', 'testes', '-v']
    : ['-m', 'uvicorn', 'api.main:app', '--host', '127.0.0.1', '--port', '8000'];
const child = spawn(python, args, {
  cwd: resolve('geoai/backend'),
  stdio: 'inherit',
  windowsHide: true,
  env: process.env,
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
