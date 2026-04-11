// ─── Combat — tweak these values directly ───

// Punch reach: how far the fist extends (world units, scaled)
export const PUNCH_REACH = 1.2

// Hit detection: max distance between attacker and target for a hit to register
export const HIT_RANGE = 1.8

// Hit detection: angle tolerance in radians (punch must face target within this cone)
export const HIT_ANGLE_TOLERANCE = Math.PI / 4 // 45°

// Damage per punch
export const PUNCH_DAMAGE = 10

// Max HP for fighters
export const MAX_HP = 100

// Punch timing (seconds)
export const PUNCH_DURATION = 0.35 // how long the punch animation plays
export const PUNCH_COOLDOWN = 0.5 // minimum time between punches

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
