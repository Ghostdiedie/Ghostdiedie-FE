import { useCallback, useEffect, useRef, useState } from 'react'

const CV_BRIDGE_URL = import.meta.env.VITE_CV_BRIDGE_URL || 'ws://127.0.0.1:8765'
const FRAME_RATE = 12

function makeCanvas() {
  if (typeof document === 'undefined') return null
  return document.createElement('canvas')
}

export function useLocalCVBridge(onAction) {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const displayCanvasRef = useRef(null)
  const streamCanvasRef = useRef(makeCanvas())
  const imageRef = useRef(null)
  const [status, setStatus] = useState('connecting')
  const [stream, setStream] = useState(null)
  const [lastAction, setLastAction] = useState(null)

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
    let cancelled = false

    function scheduleReconnect() {
      if (cancelled) return
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(connect, 1000)
    }

    function connect() {
      if (cancelled) return

      setStatus('connecting')
      const ws = new WebSocket(CV_BRIDGE_URL)
      socketRef.current = ws

      ws.addEventListener('open', () => {
        console.log('[CVBridge] connected', { url: CV_BRIDGE_URL })
      })

      ws.addEventListener('message', (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (msg.type === 'cv_status') {
          setStatus(msg.status || 'ready')
          return
        }

        if (msg.type === 'cv_event') {
          console.log('[CVBridge] action', msg.action)
          setLastAction({ action: msg.action, at: Date.now() })
          onAction?.(msg.action)
          return
        }

        if (msg.type === 'cv_frame' && msg.image) {
          setStatus('ready')
          if (!imageRef.current) {
            imageRef.current = new Image()
            imageRef.current.onload = () => drawFrame(imageRef.current)
          }
          imageRef.current.src = msg.image
        }
      })

      ws.addEventListener('close', () => {
        if (socketRef.current === ws) socketRef.current = null
        setStatus('offline')
        console.warn('[CVBridge] disconnected')
        scheduleReconnect()
      })

      ws.addEventListener('error', () => {
        console.warn('[CVBridge] connection error')
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
  }, [drawFrame, onAction])

  return {
    status,
    lastAction,
    stream,
    attachDisplayCanvasRef,
  }
}
