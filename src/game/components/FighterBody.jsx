import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  PUNCH_DURATION,
  PUNCH_ARM_ROTATION_X,
  PUNCH_ARM_ROTATION_SPEED,
  HIT_ROCK_ANGLE,
  HIT_KNOCKBACK,
} from '../constants/combat'

/**
 * Shared procedural fighter body used by both Player and Opponent.
 *
 * Props:
 *   groupRef       — ref attached to the root <group> (caller positions this)
 *   color          — body color
 *   scale          — [x,y,z] scale
 *   fighterState   — ref to combat state { punchHand, punchTimer, isHit, hitStunTimer }
 *   isMoving       — ref<boolean> whether the character is walking
 *   facingTarget   — ref<[x,z]> world position this fighter should face
 *   positionRef    — ref<[x,y,z]> current world position (for body group facing)
 *
 * Animation-ready: each limb has its own ref so you can later replace the
 * default procedural animation with custom keyframe/spring animations.
 */
export function FighterBody({
  groupRef,
  color,
  scale,
  fighterState,
  isMoving,
  facingTarget,
  positionRef,
}) {
  const bodyGroupRef = useRef()
  const leftArmRef = useRef()
  const rightArmRef = useRef()
  const leftLegRef = useRef()
  const rightLegRef = useRef()
  const headRef = useRef()

  useFrame((state) => {
    if (!bodyGroupRef.current) return
    const pos = positionRef.current
    const f = fighterState.current

    // ─── Face target ───
    if (facingTarget) {
      const target = facingTarget.current ?? facingTarget
      const dx = target[0] - pos[0]
      const dz = target[2] - pos[2]
      const targetAngle = Math.atan2(dx, dz)
      const targetQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        targetAngle,
      )
      bodyGroupRef.current.quaternion.slerp(targetQ, 0.15)
    }

    // ─── Hit reaction ───
    if (f.isHit) {
      const stun = f.hitStunTimer
      const intensity = Math.min(stun * 5, 1) // fade out
      bodyGroupRef.current.position.z = HIT_KNOCKBACK * intensity
      if (headRef.current) {
        headRef.current.rotation.x = -HIT_ROCK_ANGLE * intensity
      }
    } else {
      bodyGroupRef.current.position.z = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.z, 0, 0.15,
      )
      if (headRef.current) {
        headRef.current.rotation.x = THREE.MathUtils.lerp(
          headRef.current.rotation.x, 0, 0.15,
        )
      }
    }

    // ─── Arm animation ───
    const t = state.clock.elapsedTime

    // Default idle / walk swing
    let leftArmTargetX = 0
    let rightArmTargetX = 0

    if (isMoving.current) {
      const swing = Math.sin(t * 15)
      leftArmTargetX = swing * 0.5
      rightArmTargetX = -swing * 0.5
    }

    // Override with punch animation
    if (f.punchHand === 'left') {
      const progress = 1 - f.punchTimer / PUNCH_DURATION // 0→1
      // Quick forward, slow return
      const curve = progress < 0.4
        ? progress / 0.4 // extend
        : 1 - (progress - 0.4) / 0.6 // retract
      leftArmTargetX = PUNCH_ARM_ROTATION_X * curve
    }
    if (f.punchHand === 'right') {
      const progress = 1 - f.punchTimer / PUNCH_DURATION
      const curve = progress < 0.4
        ? progress / 0.4
        : 1 - (progress - 0.4) / 0.6
      rightArmTargetX = PUNCH_ARM_ROTATION_X * curve
    }

    leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
      leftArmRef.current.rotation.x, leftArmTargetX, PUNCH_ARM_ROTATION_SPEED * 0.016,
    )
    rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
      rightArmRef.current.rotation.x, rightArmTargetX, PUNCH_ARM_ROTATION_SPEED * 0.016,
    )

    // ─── Leg animation ───
    if (isMoving.current) {
      const swing = Math.sin(t * 15)
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
        leftLegRef.current.rotation.x, -swing * 0.5, 0.2,
      )
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
        rightLegRef.current.rotation.x, swing * 0.5, 0.2,
      )
    } else {
      leftLegRef.current.rotation.x = THREE.MathUtils.lerp(leftLegRef.current.rotation.x, 0, 0.1)
      rightLegRef.current.rotation.x = THREE.MathUtils.lerp(rightLegRef.current.rotation.x, 0, 0.1)
    }
  })

  return (
    <group ref={groupRef} scale={scale}>
      <group ref={bodyGroupRef}>
        {/* Head */}
        <mesh ref={headRef} castShadow position={[0, 1.15, 0]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial color="#f5deb3" roughness={0.5} />
        </mesh>

        {/* Torso */}
        <mesh castShadow position={[0, 0.75, 0]}>
          <capsuleGeometry args={[0.25, 0.4, 8, 16]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
        </mesh>

        {/* Left arm — pivot at shoulder */}
        <group ref={leftArmRef} position={[-0.38, 0.9, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.08, 0.35, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Fist */}
          <mesh castShadow position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        </group>

        {/* Right arm — pivot at shoulder */}
        <group ref={rightArmRef} position={[0.38, 0.9, 0]}>
          <mesh castShadow position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.08, 0.35, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          {/* Fist */}
          <mesh castShadow position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color={color} roughness={0.5} />
          </mesh>
        </group>

        {/* Left leg */}
        <group ref={leftLegRef} position={[-0.12, 0.45, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.1, 0.3, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>

        {/* Right leg */}
        <group ref={rightLegRef} position={[0.12, 0.45, 0]}>
          <mesh castShadow position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.1, 0.3, 6, 12]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
