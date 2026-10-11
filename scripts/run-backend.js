const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';
const backendDir = path.resolve(__dirname, '..', 'backend');

const pythonExe = isWindows
  ? path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  : path.join(backendDir, '.venv', 'bin', 'python');

if (!fs.existsSync(pythonExe)) {
  console.error('\x1b[31m[Backend Error] No se encontró el entorno virtual en:\x1b[0m', pythonExe);
  console.error('Por favor ejecute: py -3.12 -m venv backend/.venv && ./backend/.venv/Scripts/python -m pip install -r ./backend/requirements.txt');
  process.exit(1);
}

console.log('\x1b[32m[Backend] Iniciando servidor FastAPI con Uvicorn en http://127.0.0.1:8000 ...\x1b[0m');

const uvicornProcess = spawn(
  pythonExe,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--host', '127.0.0.1', '--port', '8000'],
  {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  }
);

uvicornProcess.on('error', (err) => {
  console.error('\x1b[31m[Backend Error] Fallo al iniciar el proceso:\x1b[0m', err.message);
  process.exit(1);
});

uvicornProcess.on('exit', (code, signal) => {
  if (code !== 0 && code !== null) {
    console.error(`\x1b[31m[Backend] Proceso finalizado con código: ${code}\x1b[0m`);
    process.exit(code);
  }
  process.exit(0);
});

// Manejo limpio de señales de interrupción (Ctrl + C)
['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((sig) => {
  process.on(sig, () => {
    if (uvicornProcess && !uvicornProcess.killed) {
      uvicornProcess.kill(sig);
    }
  });
});
