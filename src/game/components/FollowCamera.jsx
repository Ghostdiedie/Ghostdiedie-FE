import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAM_BACK_DIST, CAM_HEIGHT, CAM_LOOK_AHEAD, CAM_LERP_SPEED } from '../constants/game'

const _camTarget = new THREE.Vector3()
const _lookAt    = new THREE.Vector3()

/**
 * Always stays directly behind the player, showing the player's back.
 * Camera position is derived from the player's facing angle every frame,
 * so it rotates with the player as they turn toward the opponent.
 */
export function FollowCamera({ targetPosition, playerFacing }) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useFrame(() => {
    const [px, py, pz] = targetPosition.current
    const facing = playerFacing.current   // angle player faces (toward opponent)

    // Behind = opposite of facing direction
    const behindX = -Math.sin(facing) * CAM_BACK_DIST
    const behindZ = -Math.cos(facing) * CAM_BACK_DIST

    _camTarget.set(
      px + behindX,
      py + CAM_HEIGHT,
      pz + behindZ,
    )

    if (!initialized.current) {
      camera.position.copy(_camTarget)
      initialized.current = true
    } else {
      camera.position.lerp(_camTarget, CAM_LERP_SPEED)
    }

    // Look slightly ahead of the player (toward the opponent side)
    _lookAt.set(
      px + Math.sin(facing) * CAM_LOOK_AHEAD,
      py + 1.5,
      pz + Math.cos(facing) * CAM_LOOK_AHEAD,
    )
    camera.lookAt(_lookAt)
  })

  return null
}
