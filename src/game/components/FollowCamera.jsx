import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAM_BACK_DIST, CAM_HEIGHT, CAM_LERP_SPEED } from '../constants/game'

const _camTarget = new THREE.Vector3()
const _lookAt    = new THREE.Vector3()

/**
 * Camera that smoothly follows behind the player WITHOUT snapping.
 *
 * The key fix: the camera maintains its OWN smoothed facing angle
 * (smoothFacing) that lazily lerps toward the player's actual facing.
 * This decouples the camera rotation from the instant snap-to-opponent
 * facing the player character uses, eliminating the "spinning stage" effect
 * when strafing left/right.
 *
 * lookAt target is a weighted midpoint between player and opponent so both
 * fighters stay visible and the lookat doesn't jerk around.
 */

// How fast camera facing follows player facing.
// 0.03 → camera takes ~35 frames (~0.6 s at 60 fps) to fully catch up.
const CAM_FACING_LERP = 0.03

export function FollowCamera({ targetPosition, playerFacing, opponentPosition }) {
  const { camera } = useThree()
  const initialized  = useRef(false)
  const smoothFacing = useRef(Math.PI)  // camera's own lagged facing angle

  useFrame(() => {
    const [px, py, pz] = targetPosition.current

    // ── 1. Smooth the camera's facing angle (short-arc lerp) ─────────────
    let diff = playerFacing.current - smoothFacing.current
    // Normalize to (−π, π] so we always rotate the short way around
    while (diff >  Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    smoothFacing.current += diff * CAM_FACING_LERP

    const f = smoothFacing.current

    // ── 2. Camera position = behind player using SMOOTHED facing ──────────
    _camTarget.set(
      px - Math.sin(f) * CAM_BACK_DIST,
      py + CAM_HEIGHT,
      pz - Math.cos(f) * CAM_BACK_DIST,
    )

    if (!initialized.current) {
      camera.position.copy(_camTarget)
      initialized.current = true
    } else {
      camera.position.lerp(_camTarget, CAM_LERP_SPEED)
    }

    // ── 3. Look-at: weighted midpoint (player 60 %, opponent 40 %) ────────
    //    Keeps both fighters visible; much more stable than looking only
    //    at the player's forward direction.
    const [ox, , oz] = opponentPosition?.current ?? [px, py, pz - 8]
    _lookAt.set(
      px * 0.6 + ox * 0.4,
      py + 1.5,
      pz * 0.6 + oz * 0.4,
    )
    camera.lookAt(_lookAt)
  })

  return null
}
