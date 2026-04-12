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
      drawOverlay(video, overlayCanvasRef.current, lm, detectorsRef.current, gameReadyRef.current)

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

function drawOverlay(video, canvas, landmarks, detectors, gameReady) {
  if (!canvas || !video?.videoWidth) return

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height
  const walk = detectors?.walk

  // ── Draw mirrored video ──
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, w, h)
  ctx.restore()

  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.fillRect(0, 0, w, h)

  // Mirror helper: raw landmark x → screen x
  const mx = (lx) => w - lx * w
  const sy = (ly) => ly * h

  if (landmarks) {
    // ── Walk zone overlays (behind everything) ──
    if (walk?.calibrated) {
      const threshold = walk.calShoulderW * 0.6
      const centerX = w - walk.calNoseX
      const leftLine = Math.max(0, centerX - threshold)
      const rightLine = Math.min(w, centerX + threshold)

      // Left zone (blue — Python BGR (255,100,0))
      if (leftLine > 0) {
        ctx.fillStyle = 'rgba(0, 100, 255, 0.2)'
        ctx.fillRect(0, 0, leftLine, h)
        ctx.strokeStyle = 'rgba(0, 100, 255, 0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(0, 0, leftLine, h)
      }
      // Right zone (red — Python BGR (0,100,255))
      if (rightLine < w) {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.2)'
        ctx.fillRect(rightLine, 0, w - rightLine, h)
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(rightLine, 0, w - rightLine, h)
      }
    }

    // ── Pose connections (cyan) ──
    ctx.strokeStyle = 'rgba(0,255,255,0.9)'
    ctx.lineWidth = 3
    for (const [a, b] of POSE_CONNECTIONS) {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if (!p1 || !p2) continue
      ctx.beginPath()
      ctx.moveTo(mx(p1.x), sy(p1.y))
      ctx.lineTo(mx(p2.x), sy(p2.y))
      ctx.stroke()
    }

    // ── Body box (torso area) ──
    const ls = landmarks[11]
    const rs = landmarks[12]
    const lh = landmarks[23]
    const rh = landmarks[24]
    if (ls && rs && lh && rh) {
      const shoulderY = Math.min(sy(ls.y), sy(rs.y))
      const hipY = Math.max(sy(lh.y), sy(rh.y))
      const xs = [mx(ls.x), mx(rs.x), mx(lh.x), mx(rh.x)]
      const bx1 = Math.min(...xs)
      const bx2 = Math.max(...xs)
      const by1 = shoulderY
      const by2 = shoulderY + (hipY - shoulderY) * 0.55
      const bcx = (bx1 + bx2) / 2

      ctx.fillStyle = 'rgba(220, 220, 220, 0.2)'
      ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1)
      ctx.beginPath()
      ctx.moveTo(bcx, by1)
      ctx.lineTo(bcx, by2)
      ctx.stroke()
    }

    // ── Joint dots (cyan) ──
    for (const idx of [11, 12, 13, 14, 23, 24, 25, 26]) {
      const p = landmarks[idx]
      if (!p) continue
      ctx.fillStyle = '#00ffff'
      ctx.beginPath()
      ctx.arc(mx(p.x), sy(p.y), 6, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── Nose highlight (green circle) ──
    const nose = landmarks[0]
    if (nose) {
      const nx = mx(nose.x), ny = sy(nose.y)
      ctx.fillStyle = '#00ff00'
      ctx.beginPath()
      ctx.arc(nx, ny, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(nx, ny, 14, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ── Wrist circles (colored, like Python punch.draw) ──
    const wrists = [
      { idx: 15, color: 'rgb(255, 100, 0)' },  // right hand (orange-red)
      { idx: 16, color: 'rgb(0, 150, 255)' },   // left hand (blue)
    ]
    for (const { idx, color } of wrists) {
      const p = landmarks[idx]
      if (!p) continue
      const px = mx(p.x), py = sy(p.y)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px, py, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(px, py, 18, 0, Math.PI * 2)
      ctx.stroke()
    }

    // ── Joint labels ──
    const JOINT_LABELS = [
      ['R.Shoulder', 11], ['L.Shoulder', 12],
      ['R.Elbow', 13],    ['L.Elbow', 14],
      ['R.Wrist', 15],    ['L.Wrist', 16],
      ['R.Hip', 23],       ['L.Hip', 24],
      ['R.Knee', 25],      ['L.Knee', 26],
    ]
    ctx.font = '10px sans-serif'
    for (const [jLabel, idx] of JOINT_LABELS) {
      const p = landmarks[idx]
      if (!p) continue
      ctx.fillStyle = (p.visibility ?? 0) > 0.4 ? '#00ff00' : '#ff0000'
      ctx.fillText(jLabel, mx(p.x) + 8, sy(p.y) - 8)
    }
  }

  // ── Calibration progress bar (yellow) OR Depth gauge bar ──
  if (walk && !walk.calibrated) {
    const calLen = walk.calBuf?.length ?? 0
    const progress = (calLen / 60) * w

    ctx.fillStyle = 'rgb(255, 255, 0)'
    ctx.fillRect(0, h - 10, progress, 10)
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText('Calibrating...', 10, h - 15)
  } else if (walk?.calibrated) {
    const barH = 18
    const barY = h - barH - 2
    const calW = walk.calShoulderW
    const minW = calW * 0.5
    const maxW = calW * 1.7
    const total = maxW - minW

    const bwdX = ((calW * 0.80 - minW) / total) * w
    const fwdX = ((calW * 1.40 - minW) / total) * w

    const buf = walk.shoulderWBuf
    const swNow = buf.length > 0 ? buf.reduce((a, b) => a + b, 0) / buf.length : calW
    const curX = Math.max(0, Math.min(w - 1, ((swNow - minW) / total) * w))

    ctx.fillStyle = 'rgb(0, 100, 255)'
    ctx.fillRect(0, barY, bwdX, barH)
    ctx.fillStyle = 'rgb(50, 180, 50)'
    ctx.fillRect(bwdX, barY, fwdX - bwdX, barH)
    ctx.fillStyle = 'rgb(255, 100, 0)'
    ctx.fillRect(fwdX, barY, w - fwdX, barH)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(curX - 3, barY - 2, 6, barH + 4)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 9px sans-serif'
    ctx.fillText('BACK', 4, barY + 13)
    ctx.fillText('NEUTRAL', bwdX + 4, barY + 13)
    ctx.fillText('FORWARD', fwdX + 4, barY + 13)
  }

  // ── "BEFORE GAME START" text (calibrated but game not started) ──
  if (walk?.calibrated && !gameReady) {
    ctx.font = 'bold 18px sans-serif'
    ctx.fillStyle = 'rgba(0, 200, 255, 0.9)'
    const txt = 'BEFORE GAME START'
    const tw = ctx.measureText(txt).width
    ctx.fillText(txt, (w - tw) / 2, h / 2)
  }

  // ── Status label (top-left) ──
  const statusLabel = walk?.calibrated ? 'CV READY' : 'CALIBRATING'
  const statusColor = walk?.calibrated ? '#4ade80' : '#facc15'
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(10, 10, 130, 26)
  ctx.fillStyle = statusColor
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(statusLabel, 18, 28)
}
