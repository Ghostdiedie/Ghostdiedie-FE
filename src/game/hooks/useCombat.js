import { useRef, useCallback } from 'react'
import {
  ATTACKS,
  DEFAULT_ATTACK,
  MAX_HP,
  HIT_ANGLE_TOLERANCE,
  HIT_STUN_DURATION,
} from '../constants/combat'

/**
 * Manages combat state for two fighters (player & opponent).
 *
 * Each fighter state:
 *   hp, attackName, attackTimer, attackDuration, attackHitTime, attackRange,
 *   attackDamage, attackResolved, cooldownTimer, hitStunTimer, isHit
 *
 * Returns refs and methods consumed by character components and HUD.
 */
export function useCombat() {
  const player = useRef({
    hp: MAX_HP,
    attackName: null,
    attackTimer: 0,
    attackDuration: 0,
    attackHitTime: 0,
    attackRange: DEFAULT_ATTACK.range,
    attackDamage: DEFAULT_ATTACK.damage,
    attackResolved: false,
    cooldownTimer: 0,
    hitStunTimer: 0,
    isHit: false,
  })

  const opponent = useRef({
    hp: MAX_HP,
    attackName: null,
    attackTimer: 0,
    attackDuration: 0,
    attackHitTime: 0,
    attackRange: DEFAULT_ATTACK.range,
    attackDamage: DEFAULT_ATTACK.damage,
    attackResolved: false,
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
   * Try to start an attack for a fighter.
   * Returns true if the attack started, false if on cooldown or already attacking.
   */
  const tryAttack = useCallback((fighter, attackName) => {
    const f = fighter.current
    const attack = ATTACKS[attackName]
    if (!attack) return false
    if (f.attackName !== null) return false // already attacking
    if (f.cooldownTimer > 0) return false // on cooldown
    f.attackName = attack.name
    f.attackTimer = attack.duration
    f.attackDuration = attack.duration
    f.attackHitTime = attack.hitTime
    f.attackRange = attack.range
    f.attackDamage = attack.damage
    f.attackResolved = false
    return true
  }, [])

  /**
   * Check if attacker's punch hits the defender.
   * attackerPos, defenderPos: [x,y,z] arrays
   * attackerFacing: radian angle the attacker is facing (y-axis rotation)
   */
  const checkHit = useCallback((attackerPos, defenderPos, attackerFacing, attackRange) => {
    const dx = defenderPos[0] - attackerPos[0]
    const dz = defenderPos[2] - attackerPos[2]
    const distance = Math.sqrt(dx * dx + dz * dz)

    if (distance > attackRange) return false

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
  const applyHit = useCallback((defender, attacker, damage) => {
    const d = defender.current
    d.hp = Math.max(0, d.hp - damage)
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
  const update = useCallback((playerPos, opponentPos, playerFacing, opponentFacing, delta) => {
    const dt = delta || 1 / 60

    for (const [fighter, pos, targetPos, facing] of [
      [player, playerPos, opponentPos, playerFacing],
      [opponent, opponentPos, playerPos, opponentFacing],
    ]) {
      const f = fighter.current
      const defender = fighter === player ? opponent : player

      // Tick cooldown
      if (f.cooldownTimer > 0) f.cooldownTimer -= dt

      // Tick attack
      if (f.attackName !== null) {
        f.attackTimer -= dt

        const elapsed = f.attackDuration - f.attackTimer
        if (!f.attackResolved && elapsed >= f.attackHitTime) {
          f.attackResolved = true
          if (checkHit(pos, targetPos, facing, f.attackRange)) {
            applyHit(defender, fighter, f.attackDamage)
          }
        }

        if (f.attackTimer <= 0) {
          const endedAttack = ATTACKS[f.attackName] ?? DEFAULT_ATTACK
          f.attackName = null
          f.attackTimer = 0
          f.attackDuration = 0
          f.attackHitTime = 0
          f.attackRange = DEFAULT_ATTACK.range
          f.attackDamage = DEFAULT_ATTACK.damage
          f.attackResolved = false
          f.cooldownTimer = endedAttack.cooldown
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

  // Convenience: trigger player attacks from keyboard events
  const playerPunch = useCallback((hand) => {
    tryAttack(player, hand === 'left' ? 'left_punch' : 'right_punch')
  }, [tryAttack])

  const playerKick = useCallback(() => {
    tryAttack(player, 'kick')
  }, [tryAttack])

  const opponentPunch = useCallback((hand) => {
    tryAttack(opponent, hand === 'left' ? 'left_punch' : 'right_punch')
  }, [tryAttack])

  const opponentKick = useCallback(() => {
    tryAttack(opponent, 'kick')
  }, [tryAttack])

  return {
    player,
    opponent,
    playerHp,
    opponentHp,
    playerSkill,
    opponentSkill,
    playerPunch,
    playerKick,
    opponentPunch,
    opponentKick,
    update,
  }
}
