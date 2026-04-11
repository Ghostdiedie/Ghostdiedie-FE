// Arena — circular colosseum
export const ARENA_RADIUS = 12
export const WALL_HEIGHT = 4
export const STAND_ROWS = 5
export const STAND_ROW_HEIGHT = 1.2
export const STAND_ROW_DEPTH = 1.5

// Player physics
export const MOVE_SPEED = 0.12
export const JUMP_FORCE = 0.18
export const GRAVITY = 0.008
export const GROUND_Y = 0

// Camera
export const CAM_OFFSET = [5, 5, 7] // diagonal back offset from player
export const CAM_LOOK_AHEAD = 2
export const CAM_LERP_SPEED = 0.08

// Opponent position (static placeholder)
export const OPPONENT_POS = [0, 0, -5]

// Player colors
export const PLAYER_COLORS = {
  1: '#3b82f6',
  2: '#ef4444',
}

// Scale settings
export const PLAYER_SCALE = [1.5, 1.5, 1.5]
export const OPPONENT_SCALE = [2.5, 2.5, 2.5]
export const AUDIENCE_SCALE = [1.5, 1.5, 1.5]
