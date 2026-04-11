// ─────────────────────────────────────────────
// MOCK MODE  (swap for real fetch when BE is ready)
// ─────────────────────────────────────────────

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

class MockWebSocket {
  constructor() {
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    // Simulate opponent connecting after 2.5 s
    this._timer = setTimeout(() => {
      this.onmessage?.({ data: JSON.stringify({ type: 'GAME_START' }) })
    }, 2500)
  }
  close() {
    clearTimeout(this._timer)
  }
}

export async function createRoom(playerName) {
  await delay(700)
  const code = Math.random().toString(36).slice(2, 6).toUpperCase()
  return { room_code: code, status: 'WAITING' }
}

export async function joinRoom(roomCode) {
  await delay(500)
  return { room_code: roomCode.toUpperCase(), status: 'READY' }
}

export function createWebSocket(_roomCode) {
  return new MockWebSocket()
}


// ─────────────────────────────────────────────
// REAL IMPLEMENTATION (uncomment when ready)
// ─────────────────────────────────────────────
/*
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://api.ghostdiedie.club'
const API_KEY  = import.meta.env.VITE_API_KEY || ''

function headers() {
  return { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }
}

export async function createRoom(playerName, characterId = 1) {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ player_name: playerName, character_id: characterId }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Failed to create room') }
  return res.json()
}

export async function joinRoom(roomCode, playerName, characterId = 1) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode.toUpperCase()}/join`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ player_name: playerName, character_id: characterId }),
  })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || 'Room not found or already full') }
  return res.json()
}

export function createWebSocket(roomCode) {
  const wsBase = API_BASE.replace(/^https/, 'wss').replace(/^http/, 'ws')
  return new WebSocket(`${wsBase}/ws/${roomCode.toUpperCase()}`)
}
*/
