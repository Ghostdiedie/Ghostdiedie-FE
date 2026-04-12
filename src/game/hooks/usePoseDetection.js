import { useCallback, useEffect, useRef, useState } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { PunchDetector, WalkDetector, JumpDetector, KickDetector, HeadbuttDetector } from '../cv/detectors'

const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26],
]

/**
 * Browser-based pose detection using MediaPipe Tasks Vision.
 * Detects all actions (punch, kick, jump, headbutt, walk) from webcam.
 *
 * @param {React.RefObject} videoRef - ref to the <video> element
 * @param {boolean} enabled
 * @param {function} onAction - called with action string (e.g. 'left punch', 'jump')
 */
export function usePoseDetection(videoRef, enabled, onAction) {
  const landmarkerRef    = useRef(null)
  const rafRef           = useRef(null)
  const overlayCanvasRef = useRef(null)
  const onActionRef      = useRef(onAction)
  const detectorsRef     = useRef(null)
  const gameReadyRef     = useRef(false)
  const recalibPendingRef= useRef(false)

  const [status, setStatus]       = useState('idle')
  const [lastAction, setLastAction] = useState(null)
  const [gameReady, setGameReady] = useState(false)

  useEffect(() => { onActionRef.current = onAction }, [onAction])

  // Detectors 초기화
  useEffect(() => {
    detectorsRef.current = {
      punch:    new PunchDetector(),
      walk:     new WalkDetector(),
      jump:     new JumpDetector(),
      kick:     new KickDetector(),
      headbutt: new HeadbuttDetector(),
    }
    gameReadyRef.current    = false
    recalibPendingRef.current = false
    setGameReady(false)
  }, [enabled])

  const recalibrate = useCallback(() => {
    if (detectorsRef.current) {
      detectorsRef.current.walk.recalibrate()
      gameReadyRef.current     = false
      recalibPendingRef.current= true
      setGameReady(false)
    }
  }, [])

  const attachOverlayCanvasRef = useCallback((node) => {
    overlayCanvasRef.current = node
  }, [])

  // MediaPipe 초기화
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        setStatus('loading')
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
        )
        if (cancelled) return

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        if (cancelled) { landmarker.close(); return }
        landmarkerRef.current = landmarker
        setStatus('ready')
        console.log('[CV] pose landmarker ready')
      } catch (err) {
        setStatus('error')
        console.warn('[CV] PoseLandmarker init failed:', err)
      }
    }

    init()
    return () => {
      cancelled = true
      landmarkerRef.current?.close()
      landmarkerRef.current = null
      setStatus('idle')
    }
  }, [enabled])

  // Detection 루프
  useEffect(() => {
    if (!enabled) return

    let lastTimestamp = -1

    function detect() {
      rafRef.current = requestAnimationFrame(detect)

      const video     = videoRef.current
      const landmarker= landmarkerRef.current
      const detectors = detectorsRef.current
      if (!video || !landmarker || !detectors || video.readyState < 2) return

      // ~20fps
      const now = performance.now()
      if (now - lastTimestamp < 50) return
      lastTimestamp = now

      const nowSec = now / 1000

      let results
      try {
        results = landmarker.detectForVideo(video, now)
      } catch { return }

      const lm = results?.landmarks?.[0]
      drawOverlay(video, overlayCanvasRef.current, lm, gameReadyRef.current)

      if (!lm) return

      const w = video.videoWidth
      const h = video.videoHeight

      // walk.detect()는 항상 호출 — 캘리브레이션 진행
      const walkAction = detectors.walk.detect(lm, w, nowSec)

      // recalibrate 후 캘리브레이션 완료 시 game_ready 전환
      if (recalibPendingRef.current && detectors.walk.calibrated) {
        gameReadyRef.current      = true
        recalibPendingRef.current = false
        setGameReady(true)
        console.log('[CV] game ready!')
      }

      if (!gameReadyRef.current) return

      // ── 우선순위: headbutt > jump > kick > punch > lateral walk > depth walk
      const headbuttAction = detectors.headbutt.detect(lm, nowSec)
      const jumpAction     = detectors.jump.detect(lm, nowSec)
      const kickAction     = detectors.kick.detect(lm, nowSec)
      const punchAction    = detectors.punch.detect(lm, w, h, nowSec)

      const lateralWalk = walkAction === 'walk left' || walkAction === 'walk right' ? walkAction : null
      const depthWalk   = (!headbuttAction && !jumpAction && !kickAction && !punchAction && !lateralWalk)
        ? (walkAction === 'walk forward' || walkAction === 'walk backward' ? walkAction : null)
        : null

      const action = headbuttAction ?? jumpAction ?? kickAction ?? punchAction ?? lateralWalk ?? depthWalk
      if (action) {
        onActionRef.current?.(action)
        setLastAction({ action, at: Date.now() })
      }
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, videoRef])

  return { status, lastAction, gameReady, recalibrate, attachOverlayCanvasRef }
}

function drawOverlay(video, canvas, landmarks, gameReady) {
  if (!canvas || !video?.videoWidth) return

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  ctx.save()
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, w, h)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(0, 0, w, h)

  if (landmarks) {
    ctx.strokeStyle = 'rgba(0,255,255,0.9)'
    ctx.lineWidth   = 3
    for (const [a, b] of POSE_CONNECTIONS) {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if (!p1 || !p2) continue
      ctx.beginPath()
      ctx.moveTo(p1.x * w, p1.y * h)
      ctx.lineTo(p2.x * w, p2.y * h)
      ctx.stroke()
    }

    for (const idx of [11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = landmarks[idx]
      if (!p) continue
      ctx.fillStyle = (idx === 15 || idx === 16) ? '#f97316' : '#ffffff'
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, idx === 15 || idx === 16 ? 10 : 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // 상태 표시
  ctx.scale(-1, 1)
  const label = gameReady ? 'CV READY' : 'CALIBRATING'
  const color = gameReady ? '#4ade80' : '#facc15'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(-w + 10, 10, 130, 26)
  ctx.fillStyle = color
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(label, -w + 18, 28)
  ctx.restore()
}
