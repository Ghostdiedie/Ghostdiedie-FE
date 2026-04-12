const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')

const APP_DIR = path.resolve(__dirname, '..')
const PROJECT_DIR = path.resolve(APP_DIR, '..')
const CV_DIR = path.join(PROJECT_DIR, 'Ghostdiedie-CV')
const STAGING_DIR = path.join(APP_DIR, '.electron-bundle')
const PYTHON_STAGING_DIR = path.join(STAGING_DIR, 'python')
const MANIFEST_NAME = 'ghostdiedie-python.json'

function exists(target) {
  try {
    fs.accessSync(target)
    return true
  } catch {
    return false
  }
}

function resolveSourcePython() {
  if (process.env.CV_PYTHON && exists(process.env.CV_PYTHON)) {
    return process.env.CV_PYTHON
  }

  const bundledVenvPython = process.platform === 'win32'
    ? path.join(CV_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(CV_DIR, '.venv', 'bin', 'python')

  if (exists(bundledVenvPython)) {
    return bundledVenvPython
  }

  throw new Error(`CV Python runtime not found. Expected ${bundledVenvPython} or CV_PYTHON.`)
}

function readPythonInfo(pythonExecutable) {
  const script = `
import json
import os
import site
import sys

major = sys.version_info.major
minor = sys.version_info.minor

if sys.platform == "win32":
    default_site = os.path.join(sys.base_prefix, "Lib", "site-packages")
else:
    default_site = os.path.join(sys.base_prefix, "lib", f"python{major}.{minor}", "site-packages")

print(json.dumps({
    "version": f"{major}.{minor}",
    "platform": sys.platform,
    "basePrefix": sys.base_prefix,
    "venvSitePackages": site.getsitepackages(),
    "defaultSitePackages": default_site,
}))
`.trim()

  return JSON.parse(execFileSync(pythonExecutable, ['-c', script], {
    cwd: CV_DIR,
    encoding: 'utf8',
  }))
}

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    dereference: false,
  })
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function resolveExecutableRelative(pythonHome, version) {
  const candidates = process.platform === 'win32'
    ? ['python.exe']
    : [`bin/python${version}`, 'bin/python3', 'bin/python']

  for (const relativePath of candidates) {
    if (exists(path.join(pythonHome, relativePath))) {
      return relativePath
    }
  }

  throw new Error(`Bundled Python executable not found under ${pythonHome}`)
}

function toRelativePaths(baseDir, paths) {
  return paths
    .filter(target => exists(target))
    .map(target => path.relative(baseDir, target))
}

function main() {
  if (!exists(CV_DIR)) {
    throw new Error(`Ghostdiedie-CV not found next to Ghostdiedie-FE under ${PROJECT_DIR}`)
  }

  const sourcePython = resolveSourcePython()
  const pythonInfo = readPythonInfo(sourcePython)

  if (!exists(pythonInfo.basePrefix)) {
    throw new Error(`Base Python home not found: ${pythonInfo.basePrefix}`)
  }

  fs.rmSync(PYTHON_STAGING_DIR, { recursive: true, force: true })
  ensureDir(STAGING_DIR)

  console.log('[prepare:cv-runtime] copying base Python home from', pythonInfo.basePrefix)
  copyDirectory(pythonInfo.basePrefix, PYTHON_STAGING_DIR)

  const sourceSitePackages = pythonInfo.venvSitePackages.filter(target => exists(target))
  const destinationSitePackages = path.join(PYTHON_STAGING_DIR, path.relative(pythonInfo.basePrefix, pythonInfo.defaultSitePackages))
  ensureDir(destinationSitePackages)

  for (const sourceSitePackage of sourceSitePackages) {
    console.log('[prepare:cv-runtime] merging site-packages from', sourceSitePackage)
    copyDirectory(sourceSitePackage, destinationSitePackages)
  }

  const manifest = {
    version: pythonInfo.version,
    executable: resolveExecutableRelative(PYTHON_STAGING_DIR, pythonInfo.version),
    sitePackages: toRelativePaths(PYTHON_STAGING_DIR, [destinationSitePackages]),
  }

  fs.writeFileSync(
    path.join(PYTHON_STAGING_DIR, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  )

  console.log('[prepare:cv-runtime] bundled Python runtime ready at', PYTHON_STAGING_DIR)
}

try {
  main()
} catch (error) {
  console.error('[prepare:cv-runtime]', error.message)
  process.exit(1)
}
