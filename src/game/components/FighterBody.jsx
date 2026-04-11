import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_MODEL_PATHS } from '../constants/game'
import { HIT_KNOCKBACK, HIT_ROCK_ANGLE } from '../constants/combat'

const CLIP_ALIASES = {
  idle: ['idle'],
  walk: ['walk', 'run'],
  jump: ['jump'],
  hit: ['hit'],
  kick: ['kick'],
  left_punch: ['left_punch', 'left-punch', 'left punch', 'leftpunch'],
  right_punch: ['right_punch', 'right-punch', 'right punch', 'rightpunch'],
}

const ONESHOT_CLIPS = new Set(['jump', 'hit', 'kick', 'left_punch', 'right_punch'])
const FADE_DURATION = 0.12

function normalizeClipName(name) {
  return name.toLowerCase().replace(/[\s-]+/g, '_')
}

function resolveClipName(animations, logicalName) {
  const normalizedNames = new Map(
    animations.map((clip) => [normalizeClipName(clip.name), clip.name]),
  )

  for (const alias of CLIP_ALIASES[logicalName] ?? [logicalName]) {
    const match = normalizedNames.get(normalizeClipName(alias))
    if (match) return match
  }

  return null
}

function pickAnimation(fighterState, isMoving, isGrounded) {
  const fighter = fighterState.current

  if (fighter.isHit) return 'hit'
  if (fighter.attackName) return fighter.attackName
  if (isGrounded && !isGrounded.current) return 'jump'
  if (isMoving.current) return 'walk'

  return 'idle'
}

/**
 * Shared animated fighter body used by both Player and Opponent.
 *
 * Props:
 *   groupRef     — ref attached to the root <group> (caller positions this)
 *   modelPath    — GLB URL for this fighter model
 *   scale        — [x,y,z] scale
 *   fighterState — ref to combat state { attackName, attackDuration, isHit, hitStunTimer }
 *   isMoving     — ref<boolean> whether the character is walking
 *   isGrounded   — ref<boolean> whether the character is on the ground
 *   facingTarget — ref<[x,y,z]> world position this fighter should face
 *   positionRef  — ref<[x,y,z]> current world position (for body group facing)
 */
export function FighterBody({
  groupRef,
  modelPath,
  scale,
  fighterState,
  isMoving,
  isGrounded,
  facingTarget,
  positionRef,
}) {
  const facingGroupRef = useRef()
  const bodyGroupRef = useRef()
  const activeActionRef = useRef(null)
  const warnedMissingClipsRef = useRef(false)
  const defaultGroundedRef = useRef(true)

  const { scene, animations } = useGLTF(modelPath)
  const clonedScene = useMemo(() => clone(scene), [scene])
  const sanitizedAnimations = useMemo(() => (
    animations.map((clip) => {
      const nextClip = clip.clone()
      // Character world motion is controlled by gameplay refs, not by GLB root motion.
      // Removing position tracks prevents visible teleports when looping walk/run clips.
      nextClip.tracks = nextClip.tracks.filter((track) => !track.name.endsWith('.position'))
      return nextClip
    })
  ), [animations])
  const { actions, names } = useAnimations(sanitizedAnimations, clonedScene)

  const clipNames = useMemo(() => ({
    idle: resolveClipName(sanitizedAnimations, 'idle'),
    walk: resolveClipName(sanitizedAnimations, 'walk'),
    jump: resolveClipName(sanitizedAnimations, 'jump'),
    hit: resolveClipName(sanitizedAnimations, 'hit'),
    kick: resolveClipName(sanitizedAnimations, 'kick'),
    left_punch: resolveClipName(sanitizedAnimations, 'left_punch'),
    right_punch: resolveClipName(sanitizedAnimations, 'right_punch'),
  }), [sanitizedAnimations])

  useEffect(() => {
    clonedScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
        node.receiveShadow = false
      }
    })
  }, [clonedScene])

  useEffect(() => {
    const missing = Object.entries(clipNames)
      .filter(([, value]) => !value)
      .map(([key]) => key)

    if (missing.length > 0 && !warnedMissingClipsRef.current) {
      warnedMissingClipsRef.current = true
      console.warn(
        `[FighterBody] Missing animation clips in ${modelPath}: ${missing.join(', ')}`,
      )
    }
  }, [clipNames, modelPath])

  useFrame(() => {
    if (!facingGroupRef.current || !bodyGroupRef.current) return

    const pos = positionRef.current
    const fighter = fighterState.current
    const grounded = isGrounded ?? defaultGroundedRef

    if (facingTarget) {
      const target = facingTarget.current ?? facingTarget
      const dx = target[0] - pos[0]
      const dz = target[2] - pos[2]
      const targetAngle = Math.atan2(dx, dz)
      const targetQ = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        targetAngle,
      )
      facingGroupRef.current.quaternion.slerp(targetQ, 0.15)
    }

    if (fighter.isHit) {
      const intensity = Math.min(fighter.hitStunTimer * 5, 1)
      bodyGroupRef.current.position.z = HIT_KNOCKBACK * intensity
      bodyGroupRef.current.rotation.x = -HIT_ROCK_ANGLE * intensity
    } else {
      bodyGroupRef.current.position.z = THREE.MathUtils.lerp(
        bodyGroupRef.current.position.z,
        0,
        0.15,
      )
      bodyGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        bodyGroupRef.current.rotation.x,
        0,
        0.15,
      )
    }

    const logicalClip = pickAnimation(fighterState, isMoving, grounded)
    const nextClipName = clipNames[logicalClip] ?? clipNames.idle ?? names[0]

    if (!nextClipName || activeActionRef.current === nextClipName) return

    const nextAction = actions[nextClipName]
    if (!nextAction) return

    const previousAction = activeActionRef.current ? actions[activeActionRef.current] : null
    previousAction?.fadeOut(FADE_DURATION)

    nextAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(FADE_DURATION)

    if (fighter.attackName === logicalClip && fighter.attackDuration > 0) {
      nextAction.setDuration(fighter.attackDuration)
    }

    if (ONESHOT_CLIPS.has(logicalClip)) {
      nextAction.setLoop(THREE.LoopOnce, 1)
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity)
    }

    nextAction.play()
    activeActionRef.current = nextClipName
  })

  return (
    <group ref={groupRef} scale={scale}>
      <group ref={facingGroupRef}>
        <group ref={bodyGroupRef}>
          <primitive object={clonedScene} />
        </group>
      </group>
    </group>
  )
}

Object.values(CHARACTER_MODEL_PATHS).forEach((path) => {
  useGLTF.preload(path)
})
