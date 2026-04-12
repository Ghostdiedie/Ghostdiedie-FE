import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadFace } from '../api/client'

export default function FaceUpload({ faceUrl, onFaceUploaded, readOnly = false, helperText }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => stopCamera, [stopCamera])

  // Attach stream to video element after React commits the DOM
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOpen])

  async function openCamera() {
    if (readOnly) return
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      })
      streamRef.current = stream
      setCameraOpen(true)
      // srcObject is set in the useEffect above, after React re-renders the <video> element
    } catch {
      setError('Camera access is unavailable.')
    }
  }

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    // Center-crop to square, mirror horizontally for selfie
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.translate(size, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size)

    stopCamera()
    setLoading(true)

    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9))
      const file = new File([blob], 'face.jpg', { type: 'image/jpeg' })
      const data = await uploadFace(file)
      onFaceUploaded(data.face_id, data.face_url)
    } catch {
      setError('Face detection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera viewfinder */}
      {!readOnly && cameraOpen && (
        <div className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          {/* Capture button */}
          <button
            type="button"
            onClick={capture}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border-4 border-white/60 shadow-lg hover:scale-110 active:scale-95 transition-transform"
          />
        </div>
      )}

      {/* Preview / open camera trigger */}
      {(readOnly || !cameraOpen) && (
        <button
          type="button"
          onClick={readOnly ? undefined : openCamera}
          disabled={loading || readOnly}
          className={[
            'relative w-24 h-24 rounded-full overflow-hidden border-2 bg-white/10 flex items-center justify-center shrink-0 transition-colors duration-150',
            readOnly
              ? 'border-white/20 cursor-default'
              : 'border-white/30 hover:border-white/70',
          ].join(' ')}
        >
          {faceUrl ? (
            <img src={faceUrl} alt="Your face" className="w-full h-full object-cover" />
          ) : loading ? (
            <svg className="w-7 h-7 text-white/60 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
          )}
          {faceUrl && !loading && !readOnly && (
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            </div>
          )}
        </button>
      )}

      <p className="text-xs text-gray-400 text-center">
        {helperText || (
          readOnly
            ? 'Your profile photo can only be changed on the start screen.'
            : cameraOpen
              ? 'Press the button to capture.'
              : faceUrl
                ? 'Tap to retake.'
                : 'Capture your face.'
        )}
      </p>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
    </div>
  )
}
