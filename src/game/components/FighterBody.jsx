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
  jump: ['jump', 'jumping', 'jump_up', 'jump_start'],
  hit: ['hit', 'damage', 'hurt', 'get_hit', 'take_hit', 'react'],
  kick: ['kick', 'kicking'],
  left_punch: ['left_punch', 'left-punch', 'left punch', 'leftpunch'],
  right_punch: ['right_punch', 'right-punch', 'right punch', 'rightpunch'],
  head_attack: ['head_attack', 'headattack', 'head attack'],
  win: ['win', 'victory', 'winning'],
  lose: ['lose', 'defeat', 'losing', 'loss'],
}

const ONESHOT_CLIPS = new Set(['jump', 'hit', 'kick', 'left_punch', 'right_punch', 'head_attack'])
// Game-end clips override everything and loop until the scene unmounts
const GAME_END_CLIPS = new Set(['win', 'lose'])
// These clips must start instantly, no blending delay
const INSTANT_CLIPS = new Set(['jump', 'hit'])
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

function pickAnimation(fighterState, isMoving, isGrounded, gameResult) {
  // Game-end state overrides everything
  if (gameResult === 'win') return 'win'
  if (gameResult === 'lose') return 'lose'

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
  movingBackward,
  isGrounded,
  facingTarget,
  positionRef,
  faceImageUrl,
  gameResult = null, // null | 'win' | 'lose'
}) {
  const facingGroupRef = useRef()
  const bodyGroupRef = useRef()
  const activeActionRef = useRef(null)
  const warnedMissingClipsRef = useRef(false)
  const defaultGroundedRef = useRef(true)
  const gameResultRef = useRef(gameResult)

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
    head_attack: resolveClipName(sanitizedAnimations, 'head_attack'),
    win: resolveClipName(sanitizedAnimations, 'win'),
    lose: resolveClipName(sanitizedAnimations, 'lose'),
  }), [sanitizedAnimations])

  // Keep gameResult ref in sync with prop for useFrame access
  useEffect(() => { gameResultRef.current = gameResult }, [gameResult])

  useEffect(() => {
    clonedScene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true
        node.receiveShadow = false
      }
    })
  }, [clonedScene])

  // Apply face texture directly onto the GLB's FacePlate mesh
  useEffect(() => {
    const facePlate = clonedScene.getObjectByName('FacePlate')
    if (!facePlate) {
      console.warn('[FighterBody] FacePlate mesh not found in model', { modelPath })
      return
    }

    if (!faceImageUrl) {
      facePlate.visible = false
      return
    }

    const texture = new THREE.TextureLoader().load(faceImageUrl)
    texture.colorSpace = THREE.SRGBColorSpace

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0,
    })

    const prevMaterial = facePlate.material
    facePlate.material = mat
    facePlate.visible = true
    console.log('[FighterBody] face texture applied to FacePlate', { modelPath, faceLength: faceImageUrl.length })

    return () => {
      facePlate.material = prevMaterial
      mat.dispose()
      texture.dispose()
    }
  }, [clonedScene, faceImageUrl, modelPath])

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

    const logicalClip = pickAnimation(fighterState, isMoving, grounded, gameResultRef.current)
    const nextClipName = clipNames[logicalClip] ?? clipNames.idle ?? names[0]
    if (!nextClipName) return

    const isSameClip = activeActionRef.current === nextClipName

    // Game-end clips: once triggered, loop forever — never interrupt them
    if (GAME_END_CLIPS.has(logicalClip)) {
      if (isSameClip) return // already playing win/lose
      // Override whatever was playing
      const previousAction = activeActionRef.current ? actions[activeActionRef.current] : null
      if (previousAction) previousAction.fadeOut(FADE_DURATION)
      const nextAction = actions[nextClipName]
      if (!nextAction) return
      nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1)
      nextAction.fadeIn(FADE_DURATION)
      nextAction.setLoop(THREE.LoopRepeat, Infinity)
      nextAction.play()
      activeActionRef.current = nextClipName
      return
    }

    // Block normal animations once a game-end clip is active
    if (activeActionRef.current && GAME_END_CLIPS.has(
      Object.entries(clipNames).find(([, v]) => v === activeActionRef.current)?.[0] ?? ''
    )) return

    // Update walk direction every frame (reverse when moving backward)
    if (isSameClip && logicalClip === 'walk') {
      const currentAction = actions[activeActionRef.current]
      if (currentAction) {
        const backward = movingBackward?.current ?? false
        currentAction.setEffectiveTimeScale(backward ? -1 : 1)
      }
      return
    }

    if (isSameClip && !ONESHOT_CLIPS.has(logicalClip)) return

    // Don't interrupt a playing one-shot with idle/walk,
    // but DO allow hit, new attacks, and jump to interrupt
    if (isSameClip && ONESHOT_CLIPS.has(logicalClip)) {
      const currentAction = actions[activeActionRef.current]
      if (currentAction?.isRunning()) return // still playing, don't restart
    }
    if (!isSameClip && activeActionRef.current) {
      const currentAction = actions[activeActionRef.current]
      const currentLogical = Object.entries(clipNames).find(([, v]) => v === activeActionRef.current)?.[0]
      if (
        currentLogical && ONESHOT_CLIPS.has(currentLogical) && currentAction?.isRunning()
        && !fighter.isHit
        && !fighter.attackName
        && grounded.current
      ) {
        return
      }
    }

    const nextAction = actions[nextClipName]
    if (!nextAction) return

    const previousAction = activeActionRef.current ? actions[activeActionRef.current] : null
    if (previousAction && !isSameClip) {
      previousAction.fadeOut(FADE_DURATION)
    }

    const walkBackward = logicalClip === 'walk' && (movingBackward?.current ?? false)
    nextAction.reset().setEffectiveTimeScale(walkBackward ? -1 : 1).setEffectiveWeight(1)

    // Jump and hit start instantly — no fade delay
    if (INSTANT_CLIPS.has(logicalClip)) {
      nextAction.fadeIn(0)
    } else {
      nextAction.fadeIn(FADE_DURATION)
    }

    if (ONESHOT_CLIPS.has(logicalClip)) {
      nextAction.setLoop(THREE.LoopOnce, 1)
      // three.js AnimationAction config is intentionally mutable.
      // eslint-disable-next-line react-hooks/immutability
      nextAction.clampWhenFinished = true
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

// Preload removed — models loaded on demand after character selection
