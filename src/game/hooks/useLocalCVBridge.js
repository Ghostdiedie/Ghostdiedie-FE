import { useCallback, useEffect, useRef, useState } from 'react'

const FRAME_RATE = 12
const DEFAULT_PORTS = Array.from({ length: 10 }, (_, index) => 8765 + index)

function getBridgeUrls() {
  const runtimeUrl = typeof window !== 'undefined'
    ? window?.ghostdiedieRuntime?.cvBridgeUrl
    : null
  if (runtimeUrl) {
    return [runtimeUrl]
  }

  const envUrl = import.meta.env.VITE_CV_BRIDGE_URL
  if (envUrl) {
    return [envUrl]
  }

  const envPorts = import.meta.env.VITE_CV_BRIDGE_PORTS
  const ports = envPorts
    ? envPorts.split(',').map(value => Number.parseInt(value.trim(), 10)).filter(Number.isFinite)
    : DEFAULT_PORTS

  return ports.map(port => `ws://127.0.0.1:${port}`)
}

function makeCanvas() {
  if (typeof document === 'undefined') return null
  return document.createElement('canvas')
}

export function useLocalCVBridge(onAction, options = {}) {
  const { enabled = true } = options
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const displayCanvasRef = useRef(null)
  const streamCanvasRef = useRef(makeCanvas())
  const imageRef = useRef(null)
  const onActionRef = useRef(onAction)
  const urlsRef = useRef(getBridgeUrls())
  const urlIndexRef = useRef(0)
  const statusRef = useRef(enabled ? 'connecting' : 'idle')
  const [status, setStatus] = useState(enabled ? 'connecting' : 'idle')
  const [stream, setStream] = useState(null)
  const [lastAction, setLastAction] = useState(null)

  useEffect(() => {
    onActionRef.current = onAction
  }, [onAction])

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus
    setStatus(nextStatus)
  }, [])

  const attachDisplayCanvasRef = useCallback((node) => {
    displayCanvasRef.current = node
  }, [])

  const drawFrame = useCallback((img) => {
    const canvases = [streamCanvasRef.current, displayCanvasRef.current].filter(Boolean)
    for (const canvas of canvases) {
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width
        canvas.height = img.height
      }
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
  }, [])

  useEffect(() => {
    if (!streamCanvasRef.current) return
    const nextStream = streamCanvasRef.current.captureStream(FRAME_RATE)
    const timer = setTimeout(() => setStream(nextStream), 0)
    return () => {
      clearTimeout(timer)
      nextStream.getTracks().forEach(track => track.stop())
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
      updateStatus('idle')
      return undefined
    }

    let cancelled = false
    let connectAttempt = 0

    function scheduleReconnect() {
      if (cancelled) return
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        if (cancelled) return
        urlIndexRef.current = 0
        connect()
      }, 1000)
    }

    function connect() {
      if (cancelled) return
      const urls = urlsRef.current
      if (urls.length === 0) {
        updateStatus('offline')
        return
      }

      const attemptId = ++connectAttempt
      const currentIndex = urlIndexRef.current
      const currentUrl = urls[currentIndex]

      updateStatus('connecting')
      const ws = new WebSocket(currentUrl)
      socketRef.current = ws

      ws.addEventListener('open', () => {
        if (cancelled || attemptId !== connectAttempt) return
        urlIndexRef.current = currentIndex
        console.log('[CVBridge] connected', { url: currentUrl })
      })

      ws.addEventListener('message', (event) => {
        if (cancelled || attemptId !== connectAttempt) return
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (msg.type === 'cv_status') {
          updateStatus(msg.status || 'ready')
          return
        }

        if (msg.type === 'cv_event') {
          console.log('[CVBridge] action', msg.action)
          setLastAction({ action: msg.action, at: Date.now() })
          onActionRef.current?.(msg.action)
          return
        }

        if (msg.type === 'cv_frame' && msg.image) {
          updateStatus('ready')
          if (!imageRef.current) {
            imageRef.current = new Image()
            imageRef.current.onload = () => {
              imageRef.current._pending = false
              drawFrame(imageRef.current)
            }
          }
          // Skip frame if previous decode is still in progress (prevents queue buildup)
          if (!imageRef.current._pending) {
            imageRef.current._pending = true
            imageRef.current.src = msg.image
          }
        }
      })

      ws.addEventListener('close', () => {
        if (cancelled || attemptId !== connectAttempt) return
        if (socketRef.current === ws) socketRef.current = null

        const hasNextUrl = currentIndex + 1 < urls.length
        if (hasNextUrl && statusRef.current !== 'ready') {
          urlIndexRef.current = currentIndex + 1
          connect()
          return
        }

        updateStatus('offline')
        console.warn('[CVBridge] disconnected', { url: currentUrl })
        scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        if (cancelled || attemptId !== connectAttempt) return
        console.warn('[CVBridge] connection error', { url: currentUrl })
        ws.close()
      })
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimerRef.current)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [drawFrame, enabled, updateStatus])

  return {
    status,
    lastAction,
    stream,
    attachDisplayCanvasRef,
  }
}
