import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAM_OFFSET, CAM_LOOK_AHEAD, CAM_LERP_SPEED } from '../constants/game'

const _targetPos = new THREE.Vector3()
const _lookAt = new THREE.Vector3()

/**
 * Third-person diagonal back-follow camera.
 *
 * Sits behind and above the player at a fixed offset,
 * producing a stable over-the-shoulder / diagonal-back view.
 * Since the player always faces the opponent (-Z), the camera
 * stays consistently behind (+Z side) with a slight right offset.
 */
export function FollowCamera({ targetPosition }) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useFrame(() => {
    if (!initialized.current) {
      camera.position.set(8, 8, 12)
      initialized.current = true
    }

    // Look at the center of the arena
    _lookAt.set(0, 1, 0)
    camera.lookAt(_lookAt)
  })

  return null
}
