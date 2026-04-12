import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook to capture the user's webcam feed.
 * Returns a videoRef to attach to a <video> element and the raw MediaStream.
 */
export function useWebcam(enabled = true) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [stream, setStream] = useState(null)

  const attachVideoRef = useCallback((node) => {
    videoRef.current = node
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current
      node.play?.().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }
        streamRef.current = stream
        setStream(stream)
        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream
          videoRef.current.play?.().catch(() => {})
        }
      } catch (err) {
        console.warn('Webcam not available:', err.message)
      }
    }

    init()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      setStream(null)
    }
  }, [enabled])

  return { videoRef, attachVideoRef, streamRef, stream }
}
