import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARENA_RADIUS } from '../constants/game'

const ROOM_HALF = 22
const WALL_H    = 10
const CELL      = 2   // grid cell size (world units)

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  floor:     '#04040e',
  panel:     '#06061a',
  gridPink:  '#ff2d78',
  gridCyan:  '#00e5ff',
  neonPink:  '#ff006a',
  neonCyan:  '#00ffff',
  neonPurp:  '#9900ff',
}

// ─── Neon Grid Floor ──────────────────────────────────────────────────────────
function NeonGridFloor() {
  const half  = ROOM_HALF
  const count = Math.floor((half * 2) / CELL) + 1

  const pinkRef = useRef()
  const cyanRef = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!pinkRef.current || !cyanRef.current) return
    for (let i = 0; i < count; i++) {
      const pos = -half + i * CELL

      // pink lines run along Z (depth lines — disappear into distance)
      dummy.position.set(pos, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      pinkRef.current.setMatrixAt(i, dummy.matrix)

      // cyan lines run along X (horizontal cross-lines)
      dummy.position.set(0, 0, pos)
      dummy.updateMatrix()
      cyanRef.current.setMatrixAt(i, dummy.matrix)
    }
    pinkRef.current.instanceMatrix.needsUpdate = true
    cyanRef.current.instanceMatrix.needsUpdate = true
  }, [dummy, count, half])

  return (
    <group position={[0, 0.008, 0]}>
      <instancedMesh ref={pinkRef} args={[null, null, count]}>
        <boxGeometry args={[0.045, 0.006, half * 2]} />
        <meshStandardMaterial color={C.gridPink} emissive={C.gridPink} emissiveIntensity={2.8} />
      </instancedMesh>
      <instancedMesh ref={cyanRef} args={[null, null, count]}>
        <boxGeometry args={[half * 2, 0.006, 0.045]} />
        <meshStandardMaterial color={C.gridCyan} emissive={C.gridCyan} emissiveIntensity={2.8} />
      </instancedMesh>
    </group>
  )
}

// ─── Fight Ring markers ───────────────────────────────────────────────────────
function FightRing() {
  return (
    <group position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* outer glowing ring - pink */}
      <mesh>
        <ringGeometry args={[ARENA_RADIUS - 0.06, ARENA_RADIUS + 0.06, 64]} />
        <meshStandardMaterial color={C.gridPink} emissive={C.gridPink} emissiveIntensity={3.5} />
      </mesh>
      {/* inner accent ring - cyan */}
      <mesh>
        <ringGeometry args={[ARENA_RADIUS - 0.34, ARENA_RADIUS - 0.12, 64]} />
        <meshStandardMaterial color={C.gridCyan} emissive={C.gridCyan} emissiveIntensity={2.5} />
      </mesh>
      {/* small inner ring */}
      <mesh>
        <ringGeometry args={[1.8, 2.0, 32]} />
        <meshStandardMaterial color={C.gridPink} emissive={C.gridPink} emissiveIntensity={3} />
      </mesh>
      {/* centre cross */}
      <mesh>
        <planeGeometry args={[6, 0.055]} />
        <meshStandardMaterial color={C.gridCyan} emissive={C.gridCyan} emissiveIntensity={2.5} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.055, 6]} />
        <meshStandardMaterial color={C.gridCyan} emissive={C.gridCyan} emissiveIntensity={2.5} />
      </mesh>
    </group>
  )
}

// ─── Floor ────────────────────────────────────────────────────────────────────
function SynthwaveFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color={C.floor} roughness={0.95} metalness={0.05} />
      </mesh>
      <NeonGridFloor />
      <FightRing />
    </group>
  )
}

// ─── Reusable neon bar ────────────────────────────────────────────────────────
function Neon({ pos, size, color, intensity = 3 }) {
  return (
    <mesh position={pos}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} />
    </mesh>
  )
}

// ─── Back wall with synthwave screen ─────────────────────────────────────────
function BackWallScreen() {
  const texture = useMemo(() => {
    const W = 512, H = 256
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')

    // Background
    ctx.fillStyle = '#020214'
    ctx.fillRect(0, 0, W, H)

    // Scan-lines effect
    ctx.strokeStyle = 'rgba(0,229,255,0.06)'
    ctx.lineWidth = 1
    for (let y = 0; y < H; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Synthwave sun (half-circle, bottom-center)
    const sx = W / 2, sy = H * 0.72, sr = 58
    const sunGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr)
    sunGrad.addColorStop(0,   '#ff8c00')
    sunGrad.addColorStop(0.4, '#ff2d78')
    sunGrad.addColorStop(1,   'transparent')
    ctx.fillStyle = sunGrad
    ctx.beginPath()
    ctx.arc(sx, sy, sr, Math.PI, 0)
    ctx.fill()

    // Horizontal cut lines across sun
    ctx.fillStyle = '#020214'
    for (let i = 0; i < 9; i++) {
      const ly = sy - sr * 0.95 + i * ((sr * 0.95) / 8)
      if (ly > sy - sr) ctx.fillRect(sx - sr, ly, sr * 2, 2.5 + i * 0.4)
    }

    // Mountain silhouettes
    ctx.fillStyle = '#08081c'
    ctx.beginPath()
    ctx.moveTo(0, H * 0.76)
    ctx.lineTo(W * 0.12, H * 0.50)
    ctx.lineTo(W * 0.26, H * 0.66)
    ctx.lineTo(W * 0.40, H * 0.42)
    ctx.lineTo(W * 0.50, H * 0.36)
    ctx.lineTo(W * 0.60, H * 0.42)
    ctx.lineTo(W * 0.74, H * 0.66)
    ctx.lineTo(W * 0.88, H * 0.50)
    ctx.lineTo(W, H * 0.76)
    ctx.lineTo(W, H); ctx.lineTo(0, H)
    ctx.fill()

    // Bottom grid perspective lines from horizon
    ctx.strokeStyle = 'rgba(255,45,120,0.25)'
    ctx.lineWidth = 1
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath()
      ctx.moveTo(sx + i * (W / 6), H * 0.76)
      ctx.lineTo(i < 0 ? 0 : i > 0 ? W : sx, H)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(0,229,255,0.2)'
    for (let y = H * 0.76; y <= H; y += (H - H * 0.76) / 5) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    // Title
    ctx.shadowColor = '#00e5ff'
    ctx.shadowBlur = 18
    ctx.fillStyle = '#00e5ff'
    ctx.font = 'bold 30px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('SYNTHWAVE', W / 2, 52)
    ctx.fillText('GRID ARENA', W / 2, 86)

    ctx.shadowColor = '#ff2d78'
    ctx.shadowBlur = 12
    ctx.fillStyle = '#ff2d78'
    ctx.font = '13px monospace'
    ctx.fillText('◆  FIGHT  ◆', W / 2, 116)

    return new THREE.CanvasTexture(canvas)
  }, [])

  const Z = -(ROOM_HALF - 0.3)
  const SW = 24, SH = 8.5   // screen width / height
  const SY = WALL_H * 0.58   // screen vertical centre

  return (
    <group position={[0, 0, Z]}>
      {/* Wall slab */}
      <mesh>
        <boxGeometry args={[ROOM_HALF * 2, WALL_H, 0.5]} />
        <meshStandardMaterial color={C.panel} roughness={1} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, SY, 0.28]}>
        <planeGeometry args={[SW, SH]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={1.3}
        />
      </mesh>

      {/* Screen neon frame — cyan */}
      <Neon pos={[0,       SY + SH / 2 + 0.07, 0.3]} size={[SW + 0.2, 0.08, 0.08]} color={C.gridCyan} />
      <Neon pos={[0,       SY - SH / 2 - 0.07, 0.3]} size={[SW + 0.2, 0.08, 0.08]} color={C.gridCyan} />
      <Neon pos={[-SW / 2 - 0.07, SY, 0.3]}          size={[0.08, SH + 0.2, 0.08]} color={C.gridCyan} />
      <Neon pos={[ SW / 2 + 0.07, SY, 0.3]}          size={[0.08, SH + 0.2, 0.08]} color={C.gridCyan} />

      {/* Screen point light */}
      <pointLight position={[0, SY, 2]} intensity={8} color="#00ccff" distance={18} decay={2} />

      {/* Wall neon strips — bottom pink, top pink */}
      <Neon pos={[0, 0.07,       0.3]} size={[ROOM_HALF * 2, 0.08, 0.08]} color={C.gridPink} />
      <Neon pos={[0, WALL_H - 0.05, 0.3]} size={[ROOM_HALF * 2, 0.08, 0.08]} color={C.gridPink} />

      {/* Vertical decorative bars */}
      {[-16, -8, 8, 16].map((x, i) => (
        <Neon
          key={i}
          pos={[x, WALL_H / 2, 0.3]}
          size={[0.06, WALL_H, 0.06]}
          color={i % 2 === 0 ? C.gridPink : C.gridCyan}
          intensity={1.6}
        />
      ))}
    </group>
  )
}

// ─── Side walls ───────────────────────────────────────────────────────────────
function SideWalls() {
  const X = ROOM_HALF - 0.3
  const D = ROOM_HALF * 2

  return (
    <>
      {[-1, 1].map((side) => {
        const px = side * X
        return (
          <group key={side} position={[px, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.5, WALL_H, D]} />
              <meshStandardMaterial color={C.panel} roughness={1} />
            </mesh>
            {/* horizontal strips */}
            <Neon pos={[side * 0.28, 0.07,       0]} size={[0.08, 0.08, D]} color={C.gridCyan} />
            <Neon pos={[side * 0.28, WALL_H - 0.05, 0]} size={[0.08, 0.08, D]} color={C.gridPink} />
            <Neon pos={[side * 0.28, WALL_H * 0.5,  0]} size={[0.08, 0.06, D]} color={C.gridCyan} intensity={1.5} />
            {/* vertical dividers */}
            {[-14, -7, 0, 7, 14].map((z, i) => (
              <Neon
                key={i}
                pos={[side * 0.28, WALL_H / 2, z]}
                size={[0.06, WALL_H, 0.06]}
                color={i % 2 === 0 ? C.gridPink : C.gridCyan}
                intensity={1.5}
              />
            ))}
          </group>
        )
      })}
    </>
  )
}

// ─── Front wall (behind camera — minimal) ────────────────────────────────────
function FrontWall() {
  const Z = ROOM_HALF - 0.3
  return (
    <group position={[0, 0, Z]}>
      <mesh>
        <boxGeometry args={[ROOM_HALF * 2, WALL_H, 0.5]} />
        <meshStandardMaterial color={C.panel} roughness={1} />
      </mesh>
      <Neon pos={[0, 0.07,       -0.28]} size={[ROOM_HALF * 2, 0.08, 0.08]} color={C.gridPink} />
      <Neon pos={[0, WALL_H - 0.05, -0.28]} size={[ROOM_HALF * 2, 0.08, 0.08]} color={C.gridPink} />
    </group>
  )
}

// ─── Ceiling with dimmer grid ─────────────────────────────────────────────────
function SynthwaveCeiling() {
  const half  = ROOM_HALF
  const count = Math.floor((half * 2) / CELL) + 1
  const pinkRef = useRef()
  const cyanRef = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    if (!pinkRef.current || !cyanRef.current) return
    for (let i = 0; i < count; i++) {
      const pos = -half + i * CELL
      dummy.position.set(pos, 0, 0)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      pinkRef.current.setMatrixAt(i, dummy.matrix)
      dummy.position.set(0, 0, pos)
      dummy.updateMatrix()
      cyanRef.current.setMatrixAt(i, dummy.matrix)
    }
    pinkRef.current.instanceMatrix.needsUpdate = true
    cyanRef.current.instanceMatrix.needsUpdate = true
  }, [dummy, count, half])

  return (
    <group position={[0, WALL_H, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[half * 2, half * 2]} />
        <meshStandardMaterial color={C.floor} roughness={1} />
      </mesh>
      <group position={[0, -0.01, 0]}>
        <instancedMesh ref={pinkRef} args={[null, null, count]}>
          <boxGeometry args={[0.03, 0.005, half * 2]} />
          <meshStandardMaterial color={C.gridPink} emissive={C.gridPink} emissiveIntensity={0.9} />
        </instancedMesh>
        <instancedMesh ref={cyanRef} args={[null, null, count]}>
          <boxGeometry args={[half * 2, 0.005, 0.03]} />
          <meshStandardMaterial color={C.gridCyan} emissive={C.gridCyan} emissiveIntensity={0.9} />
        </instancedMesh>
      </group>
    </group>
  )
}

// ─── Corner neon pillars ──────────────────────────────────────────────────────
function NeonPillars() {
  const H = ROOM_HALF - 0.3
  const corners = [[-H, -H], [H, -H], [-H, H], [H, H]]

  return (
    <>
      {corners.map(([px, pz], i) => {
        const color = i % 2 === 0 ? C.gridPink : C.gridCyan
        return (
          <group key={i} position={[px, 0, pz]}>
            <mesh position={[0, WALL_H / 2, 0]}>
              <boxGeometry args={[1.4, WALL_H, 1.4]} />
              <meshStandardMaterial color="#030310" roughness={1} />
            </mesh>
            {/* 4 vertical neon edges */}
            {[[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([ox, oz], j) => (
              <mesh key={j} position={[ox, WALL_H / 2, oz]}>
                <boxGeometry args={[0.07, WALL_H + 0.15, 0.07]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} />
              </mesh>
            ))}
            <pointLight position={[0, WALL_H * 0.6, 0]} intensity={6} color={color} distance={10} decay={2} />
          </group>
        )
      })}
    </>
  )
}

// ─── Perspective arch frames (geometric depth cues) ───────────────────────────
function ArchFrames() {
  const positions = [-14, -7, 0, 7, 14]

  return (
    <>
      {positions.map((z, i) => {
        const t    = 1 - Math.abs(z) / 22    // larger near centre
        const W    = (ROOM_HALF * 2 - 1) * (0.75 + t * 0.25)
        const H    = WALL_H * (0.72 + t * 0.28)
        const color = i % 2 === 0 ? C.gridPink : C.gridCyan
        const T    = 0.06

        return (
          <group key={i} position={[0, 0, z]}>
            {/* top bar */}
            <mesh position={[0, H, 0]}>
              <boxGeometry args={[W, T, T]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>
            {/* left bar */}
            <mesh position={[-W / 2, H / 2, 0]}>
              <boxGeometry args={[T, H, T]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>
            {/* right bar */}
            <mesh position={[W / 2, H / 2, 0]}>
              <boxGeometry args={[T, H, T]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

// ─── Crowd silhouettes ────────────────────────────────────────────────────────
function Crowd() {
  const COUNT   = 100
  const bodyRef = useRef()
  const headRef = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  const figures = useMemo(() => {
    const seed = (n) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
      return x - Math.floor(x)
    }
    return Array.from({ length: COUNT }, (_, i) => {
      const angle  = (i / COUNT) * Math.PI * 2 + (seed(i * 7.3) - 0.5) * 0.2
      const radius = ARENA_RADIUS + 3 + seed(i * 13.7) * 6
      const h      = 0.9 + seed(i * 5.1) * 0.6
      const w      = 0.3 + seed(i * 3.9) * 0.1
      return {
        x: Math.sin(angle) * radius,
        z: Math.cos(angle) * radius,
        bodyY: h / 2,
        headY: h + w * 0.4,
        rotY:  angle + Math.PI,
        sx: w, sy: h, sz: w * 0.45,
        headR: w * 0.4,
      }
    })
  }, [])

  useEffect(() => {
    if (!bodyRef.current || !headRef.current) return
    figures.forEach((f, i) => {
      dummy.position.set(f.x, f.bodyY, f.z)
      dummy.rotation.set(0, f.rotY, 0)
      dummy.scale.set(f.sx, f.sy, f.sz)
      dummy.updateMatrix()
      bodyRef.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(f.x, f.headY, f.z)
      dummy.scale.set(f.headR, f.headR, f.headR)
      dummy.updateMatrix()
      headRef.current.setMatrixAt(i, dummy.matrix)
    })
    bodyRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true
  }, [figures, dummy])

  return (
    <>
      <instancedMesh ref={bodyRef} args={[null, null, COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#06061a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[null, null, COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial color="#08081e" roughness={1} />
      </instancedMesh>
    </>
  )
}

// ─── Scene lights ─────────────────────────────────────────────────────────────
function SynthwaveLights() {
  return (
    <>
      {/* cool purple ambient override */}
      <ambientLight intensity={0.18} color="#1a0040" />
      {/* deep blue fill from above */}
      <pointLight position={[0, 12, 0]} intensity={15} color="#0033aa" distance={40} decay={2} />
      {/* pink rim lights from sides */}
      <pointLight position={[-18, 3, 0]}  intensity={12} color="#ff006a" distance={30} decay={2} />
      <pointLight position={[ 18, 3, 0]}  intensity={12} color="#ff006a" distance={30} decay={2} />
      {/* cyan glow from floor level */}
      <pointLight position={[0, 0.5, -10]} intensity={10} color="#00e5ff" distance={22} decay={2} />
      <pointLight position={[0, 0.5,  10]} intensity={10} color="#00e5ff" distance={22} decay={2} />
    </>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────────
export function Arena2() {
  return (
    <group>
      <SynthwaveLights />
      <SynthwaveFloor />
      <BackWallScreen />
      <SideWalls />
      <FrontWall />
      <SynthwaveCeiling />
      <NeonPillars />
      <ArchFrames />
      <Crowd />
    </group>
  )
}
