const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

const APP_DIR = path.resolve(__dirname, '..')
const RENDERER_PORT = Number.parseInt(process.env.FE_DEV_PORT || '5173', 10)
const RENDERER_URL = process.env.ELECTRON_RENDERER_URL || `http://127.0.0.1:${RENDERER_PORT}`
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const ELECTRON_BIN = path.join(
  APP_DIR,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron.cmd' : 'electron'
)

let viteProcess = null
let electronProcess = null

function waitForPort(host, port, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    function tryConnect() {
      const socket = net.createConnection({ host, port })

      const cleanup = () => {
        socket.removeAllListeners()
        socket.destroy()
      }

      socket.setTimeout(500)
      socket.once('connect', () => {
        cleanup()
        resolve()
      })
      socket.once('timeout', () => {
        cleanup()
        retry()
      })
      socket.once('error', () => {
        cleanup()
        retry()
      })
    }

    function retry() {
      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for renderer on ${host}:${port}`))
        return
      }
      setTimeout(tryConnect, 250)
    }

    tryConnect()
  })
}

function shutdown(code = 0) {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGINT')
  }
  if (viteProcess && !viteProcess.killed) {
    viteProcess.kill('SIGINT')
  }
  process.exit(code)
}

async function main() {
  viteProcess = spawn(NPM_BIN, ['run', 'vite:dev'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: process.env,
  })

  viteProcess.once('exit', (code) => {
    if (!electronProcess) {
      process.exit(code || 0)
      return
    }
    shutdown(code || 0)
  })

  await waitForPort('127.0.0.1', RENDERER_PORT)

  electronProcess = spawn(ELECTRON_BIN, ['.'], {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: RENDERER_URL,
    },
  })

  electronProcess.once('exit', (code) => {
    shutdown(code || 0)
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

main().catch((err) => {
  console.error('[electron:dev]', err.message)
  shutdown(1)
})
