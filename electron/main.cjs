const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const net = require('node:net')
const path = require('node:path')
const { spawn } = require('node:child_process')

const APP_DIR = path.resolve(__dirname, '..')
const PROJECT_DIR = path.resolve(APP_DIR, '..')
const DIST_INDEX = path.join(APP_DIR, 'dist', 'index.html')
const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL
const CV_HOST = process.env.CV_BRIDGE_HOST || '127.0.0.1'
const CV_PORT = Number.parseInt(process.env.CV_BRIDGE_PORT || '8765', 10)
const CV_BRIDGE_URL = `ws://${CV_HOST}:${CV_PORT}`
const PYTHON_BUNDLE_DIR = path.join(process.resourcesPath, 'python')

let mainWindow = null
let cvProcess = null

function readBundledPythonManifest() {
  const manifestPath = path.join(PYTHON_BUNDLE_DIR, 'ghostdiedie-python.json')
  if (!app.isPackaged || !fs.existsSync(manifestPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    console.warn('[electron] failed to read bundled Python manifest', error.message)
    return null
  }
}

function resolveBundledPython() {
  const manifest = readBundledPythonManifest()
  if (!manifest) return null

  const executablePath = path.join(PYTHON_BUNDLE_DIR, manifest.executable)
  if (!fs.existsSync(executablePath)) {
    console.warn('[electron] bundled Python executable missing', executablePath)
    return null
  }

  const sitePackages = Array.isArray(manifest.sitePackages)
    ? manifest.sitePackages.map(rel => path.join(PYTHON_BUNDLE_DIR, rel))
    : []

  const pathEntries = [
    path.dirname(executablePath),
    path.join(PYTHON_BUNDLE_DIR, 'bin'),
    path.join(PYTHON_BUNDLE_DIR, 'Scripts'),
    process.env.PATH || '',
  ].filter(Boolean)

  return {
    command: executablePath,
    home: PYTHON_BUNDLE_DIR,
    sitePackages,
    env: {
      PYTHONHOME: PYTHON_BUNDLE_DIR,
      PYTHONPATH: sitePackages.join(path.delimiter),
      PATH: pathEntries.join(path.delimiter),
    },
  }
}

function canConnect(host, port, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })

    const finish = (result) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function waitForPort(host, port, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await canConnect(host, port)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  return false
}

function resolvePythonCommand() {
  if (process.env.CV_PYTHON) return process.env.CV_PYTHON
  return process.platform === 'win32' ? 'python' : 'python3'
}

function resolveCvLaunch() {
  const binaryName = process.platform === 'win32' ? 'ghostdiedie-cv.exe' : 'ghostdiedie-cv'
  const packagedBinary = path.join(process.resourcesPath, 'cv', binaryName)
  if (app.isPackaged && fs.existsSync(packagedBinary)) {
    return {
      command: packagedBinary,
      args: [],
      cwd: path.dirname(packagedBinary),
      mode: 'bundled-binary',
    }
  }

  const packagedScript = path.join(process.resourcesPath, 'cv', 'main.py')
  const bundledPython = resolveBundledPython()
  if (app.isPackaged && bundledPython && fs.existsSync(packagedScript)) {
    return {
      command: bundledPython.command,
      args: [packagedScript],
      cwd: path.dirname(packagedScript),
      env: bundledPython.env,
      mode: 'packaged-python-runtime',
    }
  }

  const localScript = path.join(PROJECT_DIR, 'Ghostdiedie-CV', 'main.py')
  if (fs.existsSync(localScript)) {
    return {
      command: resolvePythonCommand(),
      args: [localScript],
      cwd: path.dirname(localScript),
      mode: 'local-python',
    }
  }

  return null
}

async function startCvBridge() {
  if (await canConnect(CV_HOST, CV_PORT)) {
    console.log('[electron] using existing CV bridge', CV_BRIDGE_URL)
    return
  }

  const launch = resolveCvLaunch()
  if (!launch) {
    console.warn('[electron] CV bridge not found; continuing without local CV')
    return
  }

  cvProcess = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: {
      ...process.env,
      ...(launch.env || {}),
      CV_BRIDGE_HOST: CV_HOST,
      CV_BRIDGE_PORT: String(CV_PORT),
      CV_SHOW_WINDOW: process.env.CV_SHOW_WINDOW || '0',
    },
    stdio: 'inherit',
  })

  cvProcess.once('exit', (code, signal) => {
    console.log('[electron] CV bridge exited', { code, signal })
    cvProcess = null
  })

  const ready = await waitForPort(CV_HOST, CV_PORT)
  if (!ready) {
    console.warn('[electron] CV bridge did not come up in time', {
      command: launch.command,
      mode: launch.mode,
      url: CV_BRIDGE_URL,
    })
  } else {
    console.log('[electron] CV bridge ready', { mode: launch.mode, url: CV_BRIDGE_URL })
  }
}

function stopCvBridge() {
  if (!cvProcess || cvProcess.killed) return
  cvProcess.kill('SIGINT')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--ghostdiedie-cv-bridge-url=${CV_BRIDGE_URL}`],
    },
  })

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`Missing renderer build at ${DIST_INDEX}. Run "npm run build" first.`)
  }

  mainWindow.loadFile(DIST_INDEX)
}

app.whenReady().then(async () => {
  await startCvBridge()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopCvBridge()
})
