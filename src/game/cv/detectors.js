/**
 * JS ports of Python CV detectors.
 * Landmark indices follow MediaPipe Pose (same as Python).
 *
 * NOTE on coordinate system:
 *   Python detect.py flips the frame with cv2.flip() BEFORE MediaPipe, so in Python
 *   LEFT landmarks correspond to the screen-right side and vice versa.
 *   In JS the raw (non-flipped) webcam stream is fed into MediaPipe, and mirroring is
 *   applied only at draw time (mx = w - x*w).  Therefore:
 *     - RIGHT_* landmarks  →  screen-right (person's right hand appears on right when mirrored)
 *     - LEFT_*  landmarks  →  screen-left
 *   This is OPPOSITE to Python, so every R/L index usage is swapped vs. the Python source.
 */

const NOSE           = 0
const LEFT_SHOULDER  = 11
const RIGHT_SHOULDER = 12
const LEFT_ELBOW     = 13
const RIGHT_ELBOW    = 14
const LEFT_WRIST     = 15
const RIGHT_WRIST    = 16
const LEFT_HIP       = 23
const RIGHT_HIP      = 24
const LEFT_KNEE      = 25
const RIGHT_KNEE     = 26

const MIN_VIS = 0.4

// Exported so usePoseDetection.js can keep the calibration bar in sync
export const CAL_FRAMES = 75   // match Python walk.py

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function pushCapped(arr, val, maxLen) {
  if (arr.length >= maxLen) arr.shift()
  arr.push(val)
}

// ─── JumpDetector ─────────────────────────────────────────────────────────────
const JUMP_COOLDOWN       = 0.8
const JUMP_THRESHOLD      = 0.04
const JUMP_SHOULDER_RATIO = 1.15
const BASELINE_FRAMES     = 20   // match Python jump.py (was 15)

export class JumpDetector {
  constructor() {
    this.baselineBuf  = []
    this.shoulderBuf  = []
    this.inAir        = false
    this.lastJumpTime = 0
  }

  detect(lm, now) {
    const lh = lm[LEFT_HIP]
    const rh = lm[RIGHT_HIP]
    const ls = lm[LEFT_SHOULDER]
    const rs = lm[RIGHT_SHOULDER]

    if ((lh.visibility ?? 0) < MIN_VIS || (rh.visibility ?? 0) < MIN_VIS) return null

    const hipY        = (lh.y + rh.y) / 2
    const shoulderVis = (ls.visibility ?? 0) >= MIN_VIS && (rs.visibility ?? 0) >= MIN_VIS
    const shoulderW   = shoulderVis ? Math.abs(ls.x - rs.x) : null

    if (!this.inAir) {
      pushCapped(this.baselineBuf, hipY, BASELINE_FRAMES)
      if (shoulderW !== null) pushCapped(this.shoulderBuf, shoulderW, BASELINE_FRAMES)
    }

    if (this.baselineBuf.length < BASELINE_FRAMES) return null

    const baseline = avg(this.baselineBuf)

    let leaningForward = false
    if (shoulderW !== null && this.shoulderBuf.length >= 5) {
      leaningForward = shoulderW > avg(this.shoulderBuf) * JUMP_SHOULDER_RATIO
    }

    if (!this.inAir && hipY < baseline - JUMP_THRESHOLD && !leaningForward) {
      this.inAir = true
    } else if (this.inAir && hipY >= baseline - JUMP_THRESHOLD * 0.3) {
      this.inAir = false
      if ((now - this.lastJumpTime) >= JUMP_COOLDOWN) {
        this.lastJumpTime = now
        return 'jump'
      }
    }

    return null
  }
}

// ─── KickDetector ─────────────────────────────────────────────────────────────
const KICK_COOLDOWN   = 0.6
const HIP_DIFF_THRESH = 0.06

export class KickDetector {
  constructor() {
    this.lastKickTime = { right: 0, left: 0 }
    this.kickState    = { right: 'grounded', left: 'grounded' }
  }

  detect(lm, now) {
    const lh = lm[LEFT_HIP]
    const rh = lm[RIGHT_HIP]

    if ((lh.visibility ?? 0) < MIN_VIS || (rh.visibility ?? 0) < MIN_VIS) return null

    // JS (non-flipped): RIGHT_HIP = person's right hip.
    // Right foot raised  → RIGHT_HIP goes up (rh.y decreases) → lh.y - rh.y > 0
    // Left  foot raised  → LEFT_HIP  goes up (lh.y decreases) → rh.y - lh.y > 0
    // (Python had this inverted because it used a flipped frame)
    const sides = {
      right: lh.y - rh.y,
      left:  rh.y - lh.y,
    }

    for (const [side, diff] of Object.entries(sides)) {
      if (diff > HIP_DIFF_THRESH) {
        if (this.kickState[side] === 'grounded') {
          this.kickState[side] = 'raised'
          if ((now - this.lastKickTime[side]) >= KICK_COOLDOWN) {
            this.lastKickTime[side] = now
            return 'kick'
          }
        }
      } else {
        this.kickState[side] = 'grounded'
      }
    }

    return null
  }
}

// ─── HeadbuttDetector ─────────────────────────────────────────────────────────
const HEADBUTT_COOLDOWN       = 0.8
const NOSE_VEL_THRESH         = 0.025
const STRAIGHT_RATIO          = 0.4
const HEADBUTT_SHOULDER_RATIO = 1.12
const SHOULDER_BUF_FRAMES     = 20

export class HeadbuttDetector {
  constructor() {
    this.lastHeadbuttTime = 0
    this.prevNoseY        = null
    this.prevNoseX        = null
    this.shoulderBuf      = []
  }

  detect(lm, now) {
    const nose = lm[NOSE]
    const ls   = lm[LEFT_SHOULDER]
    const rs   = lm[RIGHT_SHOULDER]

    if ((ls.visibility ?? 0) >= MIN_VIS && (rs.visibility ?? 0) >= MIN_VIS) {
      pushCapped(this.shoulderBuf, Math.abs(ls.x - rs.x), SHOULDER_BUF_FRAMES)
    }

    if ((nose.visibility ?? 0) < MIN_VIS) {
      this.prevNoseY = null
      this.prevNoseX = null
      return null
    }

    const currY = nose.y
    const currX = nose.x
    const prevY = this.prevNoseY
    const prevX = this.prevNoseX
    this.prevNoseY = currY
    this.prevNoseX = currX

    if (prevY === null) return null

    const deltaY = currY - prevY
    const deltaX = Math.abs(currX - prevX)

    if (deltaY <= NOSE_VEL_THRESH) return null
    if (deltaX > deltaY * STRAIGHT_RATIO) return null

    if (this.shoulderBuf.length >= 5) {
      const shoulderBaseline = avg(this.shoulderBuf)
      const currentW = (ls.visibility ?? 0) >= MIN_VIS && (rs.visibility ?? 0) >= MIN_VIS
        ? Math.abs(ls.x - rs.x) : 0
      if (currentW > shoulderBaseline * HEADBUTT_SHOULDER_RATIO) return null
    }

    if ((now - this.lastHeadbuttTime) >= HEADBUTT_COOLDOWN) {
      this.lastHeadbuttTime = now
      return 'headbutt'
    }

    return null
  }
}

// ─── WalkDetector ─────────────────────────────────────────────────────────────
const WALK_COOLDOWN       = 1.0
const WALK_COOLDOWN_DEPTH = 0.4
const GRID_COL_RATIO      = 0.6
const FORWARD_RATIO       = 1.40
const BACKWARD_RATIO      = 0.80
const SHOULDER_W_BUF_LEN  = 14
const HIP_JUMP_THRESH     = 0.03

export class WalkDetector {
  constructor() {
    this.lastWalkTime   = { right: 0, left: 0 }
    this.lastDepthTime  = { forward: 0, backward: 0 }
    this.movingLateral  = null
    this.movingDepth    = null

    this.calBuf         = []
    this.calibrated     = false
    this.calNoseX       = null   // neutral nose x in raw (non-mirrored) coords (px)
    this.calShoulderW   = null   // neutral shoulder width (px)

    this.shoulderWBuf   = []
    this.hipBaselineBuf = []
  }

  recalibrate() {
    this.calBuf       = []
    this.calibrated   = false
    this.calNoseX     = null
    this.calShoulderW = null
    console.log('[WalkDetector] recalibrating...')
  }

  _tryCalibrate(noseX, shoulderW) {
    this.calBuf.push([noseX, shoulderW])
    if (this.calBuf.length >= CAL_FRAMES) {
      this.calNoseX     = avg(this.calBuf.map(v => v[0]))
      this.calShoulderW = avg(this.calBuf.map(v => v[1]))
      this.calibrated   = true
      this.shoulderWBuf = Array(SHOULDER_W_BUF_LEN).fill(this.calShoulderW)
      console.log(`[WalkDetector] calibrated! nose=${this.calNoseX.toFixed(1)} shoulderW=${this.calShoulderW.toFixed(1)}`)
    }
  }

  detect(lm, w, now) {
    const lateral = this._detectLateral(lm, w, now)
    if (lateral) return lateral
    return this._detectDepth(lm, w, now)
  }

  _detectLateral(lm, w, now) {
    const ls   = lm[LEFT_SHOULDER]
    const rs   = lm[RIGHT_SHOULDER]
    const nose = lm[NOSE]

    if ((ls.visibility ?? 0) < MIN_VIS || (rs.visibility ?? 0) < MIN_VIS || (nose.visibility ?? 0) < MIN_VIS) return null

    const noseX    = nose.x * w
    const shoulderW = Math.abs(ls.x - rs.x) * w

    if (!this.calibrated) {
      this._tryCalibrate(noseX, shoulderW)
      return null
    }

    const threshold = this.calShoulderW * GRID_COL_RATIO

    // JS uses raw (non-mirrored) coords: person moves screen-right → nose.x DECREASES.
    // Negate delta to match Python's flipped-frame convention:
    //   delta > 0 → person moved to screen-right → "walk right"
    const delta = this.calNoseX - noseX

    if (delta > threshold) {
      this.movingLateral = 'right'
      if ((now - this.lastWalkTime.right) >= WALK_COOLDOWN) {
        this.lastWalkTime.right = now
        return 'walk right'
      }
    } else if (delta < -threshold) {
      this.movingLateral = 'left'
      if ((now - this.lastWalkTime.left) >= WALK_COOLDOWN) {
        this.lastWalkTime.left = now
        return 'walk left'
      }
    } else {
      this.movingLateral = null
    }

    return null
  }

  _detectDepth(lm, w, now) {
    const ls = lm[LEFT_SHOULDER]
    const rs = lm[RIGHT_SHOULDER]

    if ((ls.visibility ?? 0) < MIN_VIS || (rs.visibility ?? 0) < MIN_VIS) return null
    if (!this.calibrated) return null

    pushCapped(this.shoulderWBuf, Math.abs(ls.x - rs.x) * w, SHOULDER_W_BUF_LEN)
    const shoulderW = avg(this.shoulderWBuf)

    const lh = lm[LEFT_HIP]
    const rh = lm[RIGHT_HIP]
    const hipY = (lh.y + rh.y) / 2
    pushCapped(this.hipBaselineBuf, hipY, CAL_FRAMES)
    const hipBaseline = avg(this.hipBaselineBuf)
    const isJumping   = hipY < hipBaseline - HIP_JUMP_THRESH

    if (shoulderW > this.calShoulderW * FORWARD_RATIO && !isJumping) {
      this.movingDepth = 'forward'
      if ((now - this.lastDepthTime.forward) >= WALK_COOLDOWN_DEPTH) {
        this.lastDepthTime.forward = now
        return 'walk forward'
      }
    } else if (shoulderW < this.calShoulderW * BACKWARD_RATIO) {
      this.movingDepth = 'backward'
      if ((now - this.lastDepthTime.backward) >= WALK_COOLDOWN_DEPTH) {
        this.lastDepthTime.backward = now
        return 'walk backward'
      }
    } else {
      this.movingDepth = null
    }

    return null
  }
}

// ─── PunchDetector ────────────────────────────────────────────────────────────
const PUNCH_COOLDOWN  = 0.25   // match Python punch.py (was 0.4)
const PUNCH_MIN_VIS   = 0.6    // match Python punch.py MIN_VISIBILITY
const MIN_SPEED       = 12
const OVERLAP_DIST_PX = 60     // match Python punch.py

function _isInFrame(lm, margin = 0.02) {
  return lm.x > margin && lm.x < 1 - margin && lm.y > margin && lm.y < 1 - margin
}

export class PunchDetector {
  constructor() {
    this.lastPunchTime = { left: 0, right: 0 }
    this.prevWristPos  = { left: null, right: null }
    this.prevInZone    = { left: false, right: false }
  }

  detect(lm, w, h, now) {
    const ls = lm[LEFT_SHOULDER]
    const rs = lm[RIGHT_SHOULDER]
    const lh = lm[LEFT_HIP]
    const rh = lm[RIGHT_HIP]

    if ((ls.visibility ?? 0) < MIN_VIS || (rs.visibility ?? 0) < MIN_VIS) return null

    // Body box in raw (non-mirrored) coordinates — matches Python _get_body_box()
    const boxX1  = Math.min(ls.x, rs.x, lh.x, rh.x) * w
    const boxX2  = Math.max(ls.x, rs.x, lh.x, rh.x) * w
    const boxY1  = Math.min(ls.y, rs.y) * h
    const torsoH = (Math.max(lh.y, rh.y) - Math.min(ls.y, rs.y)) * h
    const boxY2  = boxY1 + torsoH * 0.55

    // Two-wrist overlap → skip detection (match Python)
    const rwLm = lm[RIGHT_WRIST]
    const lwLm = lm[LEFT_WRIST]
    const dist  = Math.hypot((rwLm.x - lwLm.x) * w, (rwLm.y - lwLm.y) * h)
    if (dist < OVERLAP_DIST_PX) return null

    // JS (non-flipped): person's right → RIGHT_* landmarks (screen-right after mirror)
    //                   person's left  → LEFT_*  landmarks (screen-left  after mirror)
    // Python used the opposite because its frame was flipped before MediaPipe.
    const arms = [
      { side: 'right', shoulder: rs, elbow: lm[RIGHT_ELBOW], wrist: rwLm },
      { side: 'left',  shoulder: ls, elbow: lm[LEFT_ELBOW],  wrist: lwLm },
    ]

    for (const { side, shoulder, elbow, wrist } of arms) {
      // Frame-edge and visibility checks (match Python _is_in_frame + MIN_VISIBILITY)
      if (!_isInFrame(shoulder) || !_isInFrame(elbow) || !_isInFrame(wrist)) continue
      if (Math.min(shoulder.visibility ?? 0, elbow.visibility ?? 0, wrist.visibility ?? 0) < PUNCH_MIN_VIS) continue

      const wx = wrist.x * w
      const wy = wrist.y * h

      // Full body-box zone — matches Python: box_x1 < wx < box_x2 and box_y1 < wy < box_y2
      const inZone     = wx > boxX1 && wx < boxX2 && wy > boxY1 && wy < boxY2
      const justEntered = inZone && !this.prevInZone[side]

      const prev  = this.prevWristPos[side]
      let speed = 0
      if (prev) {
        const dx = wx - prev[0]
        const dy = wy - prev[1]
        speed = Math.sqrt(dx * dx + dy * dy)
      }

      this.prevWristPos[side] = [wx, wy]
      this.prevInZone[side]   = inZone

      if (justEntered && speed > MIN_SPEED && (now - this.lastPunchTime[side]) >= PUNCH_COOLDOWN) {
        this.lastPunchTime[side] = now
        return side === 'left' ? 'left punch' : 'right punch'
      }
    }

    return null
  }
}
