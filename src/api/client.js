const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.ghostdiedie.club'
const API_KEY  = import.meta.env.VITE_API_KEY || ''

function authHeaders() {
  return { 'X-API-Key': API_KEY }
}

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Face ──────────────────────────────────────

export async function uploadFace(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/face`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY },
    body: form,
  })
  if (!res.ok) throw new Error('Face processing failed')
  return res.json() // { face_id, face_url }
}

// ── User ──────────────────────────────────────

export async function registerUser(name, faceId) {
  const params = new URLSearchParams({ name, face_id: faceId })
  return get(`/api/user/register?${params}`)
  // → { status, user_id, name, profile_image_url }
}

// ── Room ──────────────────────────────────────

export async function createRoom(userId, characterId = 1) {
  const params = new URLSearchParams({ user_id: userId, character_id: characterId })
  return get(`/api/room/create?${params}`)
  // → { code, owner, expires_in }
}

export async function joinRoom(code, userId, characterId = 1) {
  const params = new URLSearchParams({ code, user_id: userId, character_id: characterId })
  return get(`/api/room/join?${params}`)
  // → { success, code, owner, guest }
}

export async function confirmRoom(code, userId) {
  const params = new URLSearchParams({ code, user_id: userId })
  return get(`/api/room/confirm?${params}`)
  // → { confirmed, both_confirmed }
}

export async function setRoomArena(code, userId, arenaKey) {
  const params = new URLSearchParams({ code, user_id: userId, arena_key: arenaKey })
  return get(`/api/room/arena?${params}`)
  // → { updated, arena_key }
}

export async function setRoomCharacter(code, userId, characterId) {
  const params = new URLSearchParams({
    code,
    user_id: userId,
    character_id: characterId,
  })
  return get(`/api/room/character?${params}`)
  // → { updated, character_id }
}

export async function getRoomStatus(code) {
  const params = new URLSearchParams({ code })
  return get(`/api/room/status?${params}`)
  // → { code, status, owner, guest, both_confirmed, expires_in }
}

// ── WebSocket ─────────────────────────────────

export function createWebSocket(roomCode, userId) {
  const wsBase = API_BASE.replace(/^https/, 'wss').replace(/^http/, 'ws')
  const userParam = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
  return new WebSocket(`${wsBase}/ws/${roomCode}${userParam}`)
}
