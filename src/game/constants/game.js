import characterBlack from '../../assets/characters/character_black.glb?url'
import characterBlue from '../../assets/characters/character_blue.glb?url'
import characterRed from '../../assets/characters/character_red.glb?url'
import characterWhite from '../../assets/characters/character_white.glb?url'

// Arena — circular colosseum
export const ARENA_RADIUS = 12
export const WALL_HEIGHT = 4
export const STAND_ROWS = 5
export const STAND_ROW_HEIGHT = 1.2
export const STAND_ROW_DEPTH = 1.5

// ─── Player movement — tweak these ───────────────────
export const MOVE_SPEED          = 0.10   // units per frame (WASD)
export const JUMP_FORCE          = 0.18   // initial upward velocity
export const GRAVITY             = 0.008  // downward acceleration per frame
export const GROUND_Y            = 0      // y-level of the ground

// ─── Collision ────────────────────────────────────────
export const FIGHTER_MIN_DISTANCE  = 1.8  // minimum distance between two fighters
export const ARENA_BOUNDARY_MARGIN = 1.5  // how far from arena edge fighters are clamped
// Max units each fighter can be pushed apart per frame — keeps separation smooth
export const SEPARATION_MAX_PUSH   = 0.06

// Camera — third-person behind-player
export const CAM_BACK_DIST = 5      // how far behind the player (world units)
export const CAM_HEIGHT = 3.5       // how high above the player
export const CAM_LOOK_AHEAD = 2     // how far ahead (toward opponent) the lookAt is offset
export const CAM_LERP_SPEED = 0.1   // position lerp speed (higher = snappier)

// Opponent position (static placeholder)
export const OPPONENT_POS = [0, 0, -5]

// Character models
export const CHARACTER_MODEL_PATHS = {
  black: characterBlack,
  blue: characterBlue,
  red: characterRed,
  white: characterWhite,
}

// Player colors
export const PLAYER_COLORS = {
  1: '#3b82f6',
  2: '#ef4444',
}

// Scale settings
export const PLAYER_SCALE = [1.5, 1.5, 1.5]
export const OPPONENT_SCALE = [2.5, 2.5, 2.5]
export const AUDIENCE_SCALE = [1.5, 1.5, 1.5]
