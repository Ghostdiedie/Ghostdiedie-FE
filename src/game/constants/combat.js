// ─── Combat — tweak these values directly ───

// Punch reach: how far the fist extends (world units, scaled)
export const PUNCH_REACH = 1.2

// Hit detection: max distance between attacker and target for a hit to register
export const HIT_RANGE = 1.8

// Hit detection: angle tolerance in radians (punch must face target within this cone)
export const HIT_ANGLE_TOLERANCE = Math.PI / 4 // 45°

// Max HP for fighters (must stay in sync with backend DEFAULT_HP baseline)
export const MAX_HP = 200

// Attack definitions
export const ATTACKS = {
  left_punch: {
    name: 'left_punch',
    damage: 10,
    duration: 0.32,
    cooldown: 0.22,
    hitTime: 0.12,
    range: 1.8,
  },
  right_punch: {
    name: 'right_punch',
    damage: 10,
    duration: 0.32,
    cooldown: 0.22,
    hitTime: 0.12,
    range: 1.8,
  },
  kick: {
    name: 'kick',
    damage: 16,
    duration: 0.7,
    cooldown: 0.3,
    hitTime: 0.25,
    range: 2.2,
  },
}

export const DEFAULT_ATTACK = ATTACKS.left_punch

// Hit stun (seconds) — how long the defender is stunned after being hit
export const HIT_STUN_DURATION = 0.3

// ─── Default animation params (override when custom animations are added) ───

// Punch arm rotation target (radians) — arm swings forward by this much
export const PUNCH_ARM_ROTATION_X = -Math.PI / 2 // arm extends straight forward
export const PUNCH_ARM_ROTATION_SPEED = 12 // lerp speed for punch animation

// Hit reaction: how far the body rocks back on hit
export const HIT_KNOCKBACK = 0.3
export const HIT_ROCK_ANGLE = 0.2 // radians

// ─── Opponent AI ───

export const BOT_MOVE_SPEED = 0.06
export const BOT_PREFERRED_DISTANCE = 1.5 // bot tries to stay this far from player
export const BOT_PUNCH_CHANCE = 0.02 // per-frame probability of punching when in range
export const BOT_PUNCH_RANGE = 2.0 // distance at which bot will try to punch
