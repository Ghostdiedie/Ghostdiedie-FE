import { useCallback, useEffect, useRef, useState } from 'react'
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// ─── Constants (ported from detect.py) ───
const PUNCH_COOLDOWN = 0.4 // seconds
const MIN_SPEED = 12 // pixels/frame threshold for punch
const MIN_VISIBILITY = 0.6

// MediaPipe Pose landmark indices
const LEFT_SHOULDER = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW = 13
const RIGHT_ELBOW = 14
const LEFT_WRIST = 15
const RIGHT_WRIST = 16
const LEFT_HIP = 23
const RIGHT_HIP = 24
const POSE_CONNECTIONS = [
  [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
]

/**
 * Browser-based pose detection using MediaPipe Tasks Vision.
 * Detects left/right punches from webcam feed.
 *
 * @param {React.RefObject} videoRef - ref to the <video> element
 * @param {boolean} enabled - whether CV mode is active
 * @param {object} callbacks - { onLeftPunch, onRightPunch }
 */
export function usePoseDetection(videoRef, enabled, callbacks) {
  const landmarkerRef = useRef(null)
  const rafRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const lastPunchTime = useRef({ left: 0, right: 0 })
  const prevWristPos = useRef({ left: null, right: null })
  const prevInZone = useRef({ left: false, right: false })
  const [status, setStatus] = useState('idle')
  const [lastDetected, setLastDetected] = useState(null)

  const attachOverlayCanvasRef = useCallback((node) => {
    overlayCanvasRef.current = node
  }, [])

  // Initialize PoseLandmarker
  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    console.log('[CV] init start')

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
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
      setStatus('idle')
      console.log('[CV] stopped')
    }
  }, [enabled])

  // Detection loop
  useEffect(() => {
    if (!enabled) return

    let lastTimestamp = -1

    function detect() {
      rafRef.current = requestAnimationFrame(detect)

      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker || video.readyState < 2) return

      // Run at ~15fps to save CPU
      const now = performance.now()
      if (now - lastTimestamp < 66) return // ~15fps
      lastTimestamp = now

      let results
      try {
        results = landmarker.detectForVideo(video, now)
      } catch { return }

      drawOverlay(video, overlayCanvasRef.current, results?.landmarks?.[0], status)

      if (!results?.landmarks?.[0]) return
      const lm = results.landmarks[0]

      const w = video.videoWidth
      const h = video.videoHeight

      processPunch(lm, w, h, callbacks, {
        lastPunchTime: lastPunchTime.current,
        prevWristPos: prevWristPos.current,
        prevInZone: prevInZone.current,
      }, setLastDetected)
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [callbacks, enabled, status, videoRef])
  return { status, lastDetected, attachOverlayCanvasRef }
}

function processPunch(landmarks, frameW, frameH, callbacks, state, setLastDetected) {
  const now = performance.now() / 1000

  // Get key landmarks
  const lShoulder = landmarks[LEFT_SHOULDER]
  const rShoulder = landmarks[RIGHT_SHOULDER]
  const lHip = landmarks[LEFT_HIP]
  const rHip = landmarks[RIGHT_HIP]
  const lWrist = landmarks[LEFT_WRIST]
  const rWrist = landmarks[RIGHT_WRIST]

  // Check visibility
  if ((lShoulder.visibility ?? 0) < MIN_VISIBILITY ||
      (rShoulder.visibility ?? 0) < MIN_VISIBILITY) return

  // Build torso bounding box (in pixel coords)
  const shoulders = [
    lShoulder.x * frameW, rShoulder.x * frameW,
    lShoulder.y * frameH, rShoulder.y * frameH,
  ]
  const hips = [
    lHip.x * frameW, rHip.x * frameW,
    lHip.y * frameH, rHip.y * frameH,
  ]

  const boxX1 = Math.min(shoulders[0], shoulders[1], hips[0], hips[1])
  const boxX2 = Math.max(shoulders[0], shoulders[1], hips[0], hips[1])
  const boxY1 = Math.min(shoulders[2], shoulders[3])
  const torsoH = Math.max(hips[2], hips[3]) - boxY1
  const boxY2 = boxY1 + torsoH * 0.55
  const centerX = (boxX1 + boxX2) / 2

  // Check each arm
  const arms = [
    { side: 'right', wrist: rWrist, zoneX1: centerX, zoneX2: boxX2, cb: callbacks.onRightPunch },
    { side: 'left', wrist: lWrist, zoneX1: boxX1, zoneX2: centerX, cb: callbacks.onLeftPunch },
  ]

  for (const { side, wrist, zoneX1, zoneX2, cb } of arms) {
    if ((wrist.visibility ?? 0) < MIN_VISIBILITY) continue

    const wx = wrist.x * frameW
    const wy = wrist.y * frameH

    // Is wrist in the zone?
    const inZone = wx > zoneX1 && wx < zoneX2 && wy > boxY1 && wy < boxY2
    const justEntered = inZone && !state.prevInZone[side]

    // Calculate speed
    const prev = state.prevWristPos[side]
    let speed = 0
    if (prev) {
      const dx = wx - prev[0]
      const dy = wy - prev[1]
      speed = Math.sqrt(dx * dx + dy * dy)
    }

    // Store for next frame
    state.prevWristPos[side] = [wx, wy]
    state.prevInZone[side] = inZone

    // Cooldown check
    const inCooldown = (now - state.lastPunchTime[side]) < PUNCH_COOLDOWN

    // Punch!
    if (justEntered && speed > MIN_SPEED && !inCooldown && cb) {
      state.lastPunchTime[side] = now
      setLastDetected({ side, at: Date.now() })
      console.log('[CV] punch detected', { side, speed: Math.round(speed) })
      cb()
    }
  }
}

function drawOverlay(video, canvas, landmarks, status) {
  if (!canvas || !video?.videoWidth || !video?.videoHeight) return

  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth
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
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.fillRect(0, 0, w, h)

  if (landmarks) {
    const lShoulder = landmarks[LEFT_SHOULDER]
    const rShoulder = landmarks[RIGHT_SHOULDER]
    const lHip = landmarks[LEFT_HIP]
    const rHip = landmarks[RIGHT_HIP]

    const shoulders = [
      lShoulder.x * w, rShoulder.x * w,
      lShoulder.y * h, rShoulder.y * h,
    ]
    const hips = [
      lHip.x * w, rHip.x * w,
      lHip.y * h, rHip.y * h,
    ]

    const boxX1 = Math.min(shoulders[0], shoulders[1], hips[0], hips[1])
    const boxX2 = Math.max(shoulders[0], shoulders[1], hips[0], hips[1])
    const boxY1 = Math.min(shoulders[2], shoulders[3])
    const torsoH = Math.max(hips[2], hips[3]) - boxY1
    const boxY2 = boxY1 + torsoH * 0.55
    const centerX = (boxX1 + boxX2) / 2

    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(boxX1, boxY1, boxX2 - boxX1, boxY2 - boxY1)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 2
    ctx.strokeRect(boxX1, boxY1, boxX2 - boxX1, boxY2 - boxY1)
    ctx.beginPath()
    ctx.moveTo(centerX, boxY1)
    ctx.lineTo(centerX, boxY2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(0,255,255,0.9)'
    ctx.lineWidth = 3
    for (const [a, b] of POSE_CONNECTIONS) {
      const p1 = landmarks[a]
      const p2 = landmarks[b]
      if (!p1 || !p2) continue
      ctx.beginPath()
      ctx.moveTo(p1.x * w, p1.y * h)
      ctx.lineTo(p2.x * w, p2.y * h)
      ctx.stroke()
    }

    for (const index of [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_ELBOW, RIGHT_ELBOW, LEFT_WRIST, RIGHT_WRIST, LEFT_HIP, RIGHT_HIP]) {
      const p = landmarks[index]
      if (!p) continue
      ctx.fillStyle = index === LEFT_WRIST ? '#60a5fa' : index === RIGHT_WRIST ? '#f97316' : '#ffffff'
      ctx.beginPath()
      ctx.arc(p.x * w, p.y * h, index === LEFT_WRIST || index === RIGHT_WRIST ? 10 : 6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.scale(-1, 1)
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  ctx.fillRect(-w + 10, 10, 110, 26)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(`CV ${String(status).toUpperCase()}`, -w + 18, 28)
  ctx.restore()
}
