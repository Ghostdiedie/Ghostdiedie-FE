import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MOVE_SPEED, JUMP_FORCE, GRAVITY, GROUND_Y, ARENA_RADIUS, ARENA_BOUNDARY_MARGIN } from '../constants/game'

export function usePlayerMovement(keysRef, opponentPosRef) {
  const position = useRef([0, GROUND_Y, 6])
  const velocity = useRef([0, 0, 0])
  const isGrounded = useRef(true)
  const facing = useRef(Math.PI)
  const isMoving = useRef(false)
  const movingBackward = useRef(false)

  useFrame(() => {
    const k = keysRef.current
    const pos = position.current
    const vel = velocity.current

    // Compute facing FIRST so movement is relative to it
    const opponentPos = opponentPosRef?.current ?? [0, 0, -5]
    const dx = opponentPos[0] - pos[0]
    const dz = opponentPos[2] - pos[2]
    facing.current = Math.atan2(dx, dz)

    const f = facing.current
    // Forward/backward = along facing axis
    // Left/right = perpendicular (strafe)
    let moveX = 0
    let moveZ = 0
    if (k.forward)   { moveX += Math.sin(f);              moveZ += Math.cos(f) }
    if (k.backward)  { moveX -= Math.sin(f);              moveZ -= Math.cos(f) }
    if (k.left)      { moveX += Math.sin(f + Math.PI / 2); moveZ += Math.cos(f + Math.PI / 2) }
    if (k.right)     { moveX += Math.sin(f - Math.PI / 2); moveZ += Math.cos(f - Math.PI / 2) }

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ)
    if (len > 0) {
      moveX = (moveX / len) * MOVE_SPEED
      moveZ = (moveZ / len) * MOVE_SPEED
    }
    isMoving.current = len > 0
    movingBackward.current = k.backward && !k.forward

    // Apply horizontal movement
    pos[0] += moveX
    pos[2] += moveZ

    // Jump
    if (k.jump && isGrounded.current) {
      vel[1] = JUMP_FORCE
      isGrounded.current = false
    }

    // Gravity
    vel[1] -= GRAVITY
    pos[1] += vel[1]

    // Ground collision
    if (pos[1] <= GROUND_Y) {
      pos[1] = GROUND_Y
      vel[1] = 0
      isGrounded.current = true
    }

    // Circular arena boundary clamping
    const limit = ARENA_RADIUS - ARENA_BOUNDARY_MARGIN
    const dist = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2])
    if (dist > limit) {
      const scale = limit / dist
      pos[0] *= scale
      pos[2] *= scale
    }
  })

  return { position, velocity, facing, isGrounded, isMoving, movingBackward }
}
