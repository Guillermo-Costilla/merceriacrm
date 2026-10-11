const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const backendDir = path.resolve(__dirname, '..', 'backend');

const pythonExe = isWindows
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

if (!fs.existsSync(pythonExe)) {
  console.error('\x1b[31m[Migration Error] No se encontró el entorno virtual en:\x1b[0m', pythonExe);
  process.exit(1);
}

const args = ['migrations/runner.py', ...process.argv.slice(2)];

const migrationProcess = spawn(pythonExe, args, {
  cwd: backendDir,
  stdio: 'inherit',
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
});

migrationProcess.on('exit', (code) => {
  process.exit(code || 0);
});
