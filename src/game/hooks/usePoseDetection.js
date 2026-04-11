import { useEffect, useRef } from 'react'
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
  const lastPunchTime = useRef({ left: 0, right: 0 })
  const prevWristPos = useRef({ left: null, right: null })
  const prevInZone = useRef({ left: false, right: false })

  // Initialize PoseLandmarker
  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
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
      } catch (err) {
        console.warn('PoseLandmarker init failed:', err)
      }
    }

    init()
    return () => {
      cancelled = true
      if (landmarkerRef.current) {
        landmarkerRef.current.close()
        landmarkerRef.current = null
      }
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

      if (!results?.landmarks?.[0]) return
      const lm = results.landmarks[0]

      const w = video.videoWidth
      const h = video.videoHeight

      processPunch(lm, w, h, callbacks)
    }

    rafRef.current = requestAnimationFrame(detect)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled, videoRef, callbacks])
}

function processPunch(landmarks, frameW, frameH, callbacks) {
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
    const justEntered = inZone && !callbacks._prevInZone?.[side]

    // Calculate speed
    const prev = callbacks._prevWristPos?.[side]
    let speed = 0
    if (prev) {
      const dx = wx - prev[0]
      const dy = wy - prev[1]
      speed = Math.sqrt(dx * dx + dy * dy)
    }

    // Store for next frame
    if (!callbacks._prevWristPos) callbacks._prevWristPos = { left: null, right: null }
    if (!callbacks._prevInZone) callbacks._prevInZone = { left: false, right: false }
    callbacks._prevWristPos[side] = [wx, wy]
    callbacks._prevInZone[side] = inZone

    // Cooldown check
    if (!callbacks._lastPunchTime) callbacks._lastPunchTime = { left: 0, right: 0 }
    const inCooldown = (now - callbacks._lastPunchTime[side]) < PUNCH_COOLDOWN

    // Punch!
    if (justEntered && speed > MIN_SPEED && !inCooldown && cb) {
      callbacks._lastPunchTime[side] = now
      cb()
    }
  }
}
