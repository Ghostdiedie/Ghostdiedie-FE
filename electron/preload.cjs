const { contextBridge } = require('electron')

function readArg(prefix) {
  const match = process.argv.find(value => value.startsWith(prefix))
  return match ? match.slice(prefix.length) : null
}

contextBridge.exposeInMainWorld('ghostdiedieRuntime', {
  isDesktop: true,
  cvBridgeUrl: readArg('--ghostdiedie-cv-bridge-url='),
})
