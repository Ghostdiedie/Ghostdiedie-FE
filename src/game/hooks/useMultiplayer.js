import { useCallback, useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { ATTACKS, DEFAULT_ATTACK, HIT_STUN_DURATION } from '../constants/combat'
import { GROUND_Y, CHARACTER_ID_TO_KEY } from '../constants/game'

/**
 * Map local attack names to server-expected action strings.
 */
function toServerAction(name) {
  if (name === 'left_punch') return 'left punch'
  if (name === 'right_punch') return 'right punch'
  return name
}

function makeFighterState() {
  return {
    attackName: null,
    attackTimer: 0,
    attackDuration: 0,
    attackHitTime: 0,
    attackRange: 0,
    attackDamage: 0,
    attackResolved: false,
    cooldownTimer: 0,
    hitStunTimer: 0,
    isHit: false,
  }
}

function tickFighter(f, dt) {
  if (f.cooldownTimer > 0) f.cooldownTimer -= dt
  if (f.attackName !== null) {
    f.attackTimer -= dt
    if (f.attackTimer <= 0) {
      const ended = ATTACKS[f.attackName] ?? DEFAULT_ATTACK
      f.attackName = null
      f.attackTimer = 0
      f.attackDuration = 0
      f.cooldownTimer = ended.cooldown
    }
  }
  if (f.hitStunTimer > 0) {
    f.hitStunTimer -= dt
    if (f.hitStunTimer <= 0) {
      f.isHit = false
      f.hitStunTimer = 0
    }
  }
}

/**
 * Multiplayer hook — replaces useCombat + useOpponentAI.
 *
 * Must be used inside Canvas (uses useFrame).
 *
 * @param {WebSocket|null} ws - WebSocket connection
 * @param {object} playerMovement - from usePlayerMovement
 */
export function useMultiplayer(ws, playerMovement) {
  // ── Opponent position (replaces useOpponentAI) ──
  const opponentPosition = useRef([0, GROUND_Y, -5])
  const opponentFacing = useRef(0)
  const opponentIsMoving = useRef(false)
  const opponentMovingBackward = useRef(false)

  // ── Fighter animation states ──
  const playerState = useRef(makeFighterState())
  const opponentState = useRef(makeFighterState())

  // ── Opponent character key ──
  const opponentCharacterKey = useRef('red')

  // ── HP / gauge from server ──
  const playerHp = useRef(200)
  const opponentHp = useRef(200)
  const playerMaxHp = useRef(200)
  const opponentMaxHp = useRef(200)
  const playerGauge = useRef(0)
  const opponentGauge = useRef(0)

  // ── Game over ──
  const gameOver = useRef(null) // null or { winner_name, loser_name, ... }

  const frameCount = useRef(0)
  const lastPositionLogAt = useRef(0)

  // ── WebSocket message handler ──
  useEffect(() => {
    if (!ws) return

    function onMessage(e) {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'game_start':
          console.log('[Multiplayer] game_start', msg)
          if (msg.opponent?.character_id) {
            opponentCharacterKey.current = CHARACTER_ID_TO_KEY[msg.opponent.character_id] || 'red'
          }
          if (msg.me?.hp) {
            playerHp.current = msg.me.hp
            playerMaxHp.current = msg.me.max_hp ?? msg.me.hp
          }
          if (msg.opponent?.hp) {
            opponentHp.current = msg.opponent.hp
            opponentMaxHp.current = msg.opponent.max_hp ?? msg.opponent.hp
          }
          break

        case 'character_select':
          // Opponent sent their selected character key
          if (msg.characterKey) {
            opponentCharacterKey.current = msg.characterKey
            console.log('[Multiplayer] opponent character updated', msg.characterKey)
          }
          break

        case 'position_sync':
          opponentPosition.current = msg.position
          opponentFacing.current = msg.facing
          opponentIsMoving.current = msg.isMoving ?? false
          opponentMovingBackward.current = msg.movingBackward ?? false
          break

        case 'attack_anim': {
          // Opponent started an attack → play their animation
          const attack = ATTACKS[msg.action] ?? DEFAULT_ATTACK
          const opp = opponentState.current
          if (!opp.attackName) {
            opp.attackName = attack.name
            opp.attackTimer = attack.duration
            opp.attackDuration = attack.duration
          }
          break
        }

        case 'action_result':
          // I attacked → server confirmed damage
          playerHp.current = msg.my_hp
          opponentHp.current = msg.opponent_hp
          playerGauge.current = msg.my_gauge
          opponentGauge.current = msg.opponent_gauge
          // Opponent got hit
          if (msg.damage > 0 && !msg.blocked) {
            opponentState.current.isHit = true
            opponentState.current.hitStunTimer = HIT_STUN_DURATION
          }
          break

        case 'hit_received':
          // I got hit by opponent
          playerHp.current = msg.my_hp
          opponentHp.current = msg.opponent_hp
          playerGauge.current = msg.my_gauge
          opponentGauge.current = msg.opponent_gauge
          if (msg.damage > 0 && !msg.blocked) {
            playerState.current.isHit = true
            playerState.current.hitStunTimer = HIT_STUN_DURATION
          }
          break

        case 'round_start':
          // Reset HP/gauge for new round (server is authoritative)
          if (msg.me?.hp) {
            playerHp.current = msg.me.hp
            playerMaxHp.current = msg.me.max_hp ?? msg.me.hp
          }
          if (msg.opponent?.hp) {
            opponentHp.current = msg.opponent.hp
            opponentMaxHp.current = msg.opponent.max_hp ?? msg.opponent.hp
          }
          playerGauge.current = 0
          opponentGauge.current = 0
          // Reset fighter states
          playerState.current = makeFighterState()
          opponentState.current = makeFighterState()
          break

        case 'game_end':
          gameOver.current = msg
          break

        case 'opponent_left':
          gameOver.current = { winner_name: 'You', loser_name: 'Opponent', disconnected: true }
          break

        case 'afk_timeout':
          gameOver.current = { afk_timeout: true, afk_player_index: msg.afk_player_index }
          break
      }
    }

    ws.addEventListener('message', onMessage)
    return () => ws.removeEventListener('message', onMessage)
  }, [ws])

  // ── Per-frame: send position sync + tick animation timers ──
  useFrame((_, delta) => {
    const dt = delta || 1 / 60
    frameCount.current++

    // Send position every 3 frames (~20Hz)
    if (ws && ws.readyState === WebSocket.OPEN && frameCount.current % 3 === 0) {
      const payload = {
        type: 'position_sync',
        position: [...playerMovement.position.current],
        facing: playerMovement.facing.current,
        isMoving: playerMovement.isMoving.current,
        movingBackward: playerMovement.movingBackward?.current ?? false,
      }
      ws.send(JSON.stringify({
        ...payload,
      }))

      const now = Date.now()
      if (now - lastPositionLogAt.current >= 1000) {
        lastPositionLogAt.current = now
        console.log('[Multiplayer] send position_sync', payload)
      }
    }

    // Tick local animation timers
    tickFighter(playerState.current, dt)
    tickFighter(opponentState.current, dt)
  })

  // ── Attack methods ──
  const playerAttack = useCallback((attackName) => {
    const f = playerState.current
    const attack = ATTACKS[attackName]
    if (!attack || f.attackName || f.cooldownTimer > 0 || f.isHit) return

    // Local animation immediately
    f.attackName = attack.name
    f.attackTimer = attack.duration
    f.attackDuration = attack.duration

    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[Multiplayer] send player_action', attackName)
      // Server combat calculation
      ws.send(JSON.stringify({ type: 'player_action', action: toServerAction(attackName) }))
      // Relay animation to opponent
      ws.send(JSON.stringify({ type: 'attack_anim', action: attackName }))
    }
  }, [ws])

  const playerPunch = useCallback(
    (hand) => playerAttack(hand === 'left' ? 'left_punch' : 'right_punch'),
    [playerAttack],
  )

  const playerKick = useCallback(
    () => playerAttack('kick'),
    [playerAttack],
  )

  // Send selected character to opponent via relay
  const sendCharacterSelect = useCallback((characterKey) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[Multiplayer] send character_select', characterKey)
      ws.send(JSON.stringify({ type: 'character_select', characterKey }))
    }
  }, [ws])

  return {
    // Opponent (replaces useOpponentAI)
    opponent: {
      position: opponentPosition,
      facing: opponentFacing,
      isMoving: opponentIsMoving,
      movingBackward: opponentMovingBackward,
    },
    // Fighter states for FighterBody animation
    playerState,
    opponentState,
    // HP / gauge for HUD
    playerHp,
    opponentHp,
    playerMaxHp,
    opponentMaxHp,
    playerGauge,
    opponentGauge,
    // Opponent character
    opponentCharacterKey,
    // Game over
    gameOver,
    // Actions
    playerPunch,
    playerKick,
    sendCharacterSelect,
  }
}
