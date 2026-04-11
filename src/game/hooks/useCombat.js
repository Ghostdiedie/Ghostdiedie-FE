import { useRef, useCallback } from 'react'
import {
  MAX_HP,
  PUNCH_DAMAGE,
  PUNCH_DURATION,
  PUNCH_COOLDOWN,
  HIT_RANGE,
  HIT_ANGLE_TOLERANCE,
  HIT_STUN_DURATION,
} from '../constants/combat'

/**
 * Manages combat state for two fighters (player & opponent).
 *
 * Each fighter state:
 *   hp, punchHand (null|'left'|'right'), punchTimer, cooldownTimer,
 *   hitStunTimer, isHit
 *
 * Returns refs and methods consumed by character components and HUD.
 */
export function useCombat() {
  const player = useRef({
    hp: MAX_HP,
    punchHand: null, // 'left' | 'right' | null
    punchTimer: 0,
    cooldownTimer: 0,
    hitStunTimer: 0,
    isHit: false,
  })

  const opponent = useRef({
    hp: MAX_HP,
    punchHand: null,
    punchTimer: 0,
    cooldownTimer: 0,
    hitStunTimer: 0,
    isHit: false,
  })

  // Reactive HP for HUD (updated each frame)
  const playerHp = useRef(MAX_HP)
  const opponentHp = useRef(MAX_HP)

  // Skill gauge (0–100): charges on hit dealt/received, drains on use
  const playerSkill = useRef(0)
  const opponentSkill = useRef(0)

  /**
   * Try to start a punch for a fighter.
   * Returns true if the punch started, false if on cooldown or already punching.
   */
  const tryPunch = useCallback((fighter, hand) => {
    const f = fighter.current
    if (f.punchHand !== null) return false // already punching
    if (f.cooldownTimer > 0) return false // on cooldown
    f.punchHand = hand
    f.punchTimer = PUNCH_DURATION
    return true
  }, [])

  /**
   * Check if attacker's punch hits the defender.
   * attackerPos, defenderPos: [x,y,z] arrays
   * attackerFacing: radian angle the attacker is facing (y-axis rotation)
   */
  const checkHit = useCallback((attackerPos, defenderPos, attackerFacing) => {
    const dx = defenderPos[0] - attackerPos[0]
    const dz = defenderPos[2] - attackerPos[2]
    const distance = Math.sqrt(dx * dx + dz * dz)

    if (distance > HIT_RANGE) return false

    // Check if attacker is facing the defender within tolerance
    const angleToDefender = Math.atan2(dx, dz)
    let angleDiff = angleToDefender - attackerFacing
    // Normalize to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    return Math.abs(angleDiff) < HIT_ANGLE_TOLERANCE
  }, [])

  /**
   * Apply damage to a fighter and trigger hit stun.
   */
  const applyHit = useCallback((defender, attacker) => {
    const d = defender.current
    d.hp = Math.max(0, d.hp - PUNCH_DAMAGE)
    d.isHit = true
    d.hitStunTimer = HIT_STUN_DURATION
    // Charge skill gauge on hit
    if (defender === player) {
      playerSkill.current = Math.min(100, playerSkill.current + 15)
    } else {
      opponentSkill.current = Math.min(100, opponentSkill.current + 15)
    }
    // Attacker also charges slightly on successful hit
    if (attacker === player) {
      playerSkill.current = Math.min(100, playerSkill.current + 8)
    } else {
      opponentSkill.current = Math.min(100, opponentSkill.current + 8)
    }
  }, [])

  // Per-frame update: tick timers, detect hits
  // positionRefs: { player: ref([x,y,z]), opponent: ref([x,y,z]) }
  // facingRefs: { player: ref(angle), opponent: ref(angle) }
  const update = useCallback((playerPos, opponentPos, playerFacing, opponentFacing) => {
    const dt = 1 / 60 // fixed timestep approximation

    for (const [fighter, pos, targetPos, facing] of [
      [player, playerPos, opponentPos, playerFacing],
      [opponent, opponentPos, playerPos, opponentFacing],
    ]) {
      const f = fighter.current
      const defender = fighter === player ? opponent : player

      // Tick cooldown
      if (f.cooldownTimer > 0) f.cooldownTimer -= dt

      // Tick punch
      if (f.punchHand !== null) {
        f.punchTimer -= dt

        // Check hit at the midpoint of the punch
        if (f.punchTimer <= PUNCH_DURATION * 0.5 && f.punchTimer > PUNCH_DURATION * 0.5 - dt) {
          if (checkHit(pos, targetPos, facing)) {
            applyHit(defender, fighter)
          }
        }

        if (f.punchTimer <= 0) {
          f.punchHand = null
          f.punchTimer = 0
          f.cooldownTimer = PUNCH_COOLDOWN
        }
      }

      // Tick hit stun
      if (f.hitStunTimer > 0) {
        f.hitStunTimer -= dt
        if (f.hitStunTimer <= 0) {
          f.isHit = false
          f.hitStunTimer = 0
        }
      }
    }

    // Passive skill gauge charge over time
    playerSkill.current = Math.min(100, playerSkill.current + 0.03)
    opponentSkill.current = Math.min(100, opponentSkill.current + 0.03)

    // Sync HP refs for HUD
    playerHp.current = player.current.hp
    opponentHp.current = opponent.current.hp
  }, [checkHit, applyHit])

  // Convenience: trigger player punch from keyboard events
  const playerPunch = useCallback((hand) => {
    tryPunch(player, hand)
  }, [tryPunch])

  const opponentPunch = useCallback((hand) => {
    tryPunch(opponent, hand)
  }, [tryPunch])

  return {
    player,
    opponent,
    playerHp,
    opponentHp,
    playerSkill,
    opponentSkill,
    playerPunch,
    opponentPunch,
    update,
  }
}
