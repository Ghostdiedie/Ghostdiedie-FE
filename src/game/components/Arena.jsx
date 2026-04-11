import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARENA_RADIUS } from '../constants/game'

// ─── Octagon geometry constants ───────────────────────────────────────────────
//   APOTHEM  = distance from center to the flat face of each panel
//   PANEL_W  = width of each flat panel (chord)
//   VERTEX_R = distance from center to corner vertex
const APOTHEM  = ARENA_RADIUS                               // 12
const PANEL_W  = 2 * APOTHEM * Math.tan(Math.PI / 8)       // ≈ 9.94
const VERTEX_R = APOTHEM / Math.cos(Math.PI / 8)           // ≈ 12.98

const CAGE_H    = 5       // fence height
const ROOM_HALF = 22      // room extends ±22
const WALL_H    = 9       // ceiling height

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  floor      : '#282724',
  mat        : '#201e1b',   // canvas inside cage
  concrete   : '#2a2826',
  wall       : '#242220',
  metal      : '#1c1c1e',
  metalLight : '#2e2e30',
  yellow     : '#ffcc00',
  yellowDim  : '#cc9900',
  black      : '#111111',
  crowd      : '#1c1a18',
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Canvas mat (fight floor inside cage) ────────────────────────────────────
function OctagonMat() {
  return (
    <group>
      {/* Dark canvas mat — flush with floor */}
      <mesh rotation={[0, Math.PI / 8, 0]} position={[0, 0.004, 0]} receiveShadow>
        <cylinderGeometry args={[VERTEX_R + 0.05, VERTEX_R + 0.05, 0.008, 8]} />
        <meshStandardMaterial color={C.mat} roughness={0.92} />
      </mesh>

      {/* White outer ring on canvas (like real MMA mats) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.06, ARENA_RADIUS + 0.06, 64]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.5} />
      </mesh>

      {/* Yellow boundary ring (just inside white) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.32, ARENA_RADIUS - 0.08, 64]} />
        <meshStandardMaterial color={C.yellow} roughness={0.3} />
      </mesh>

      {/* White inner ring (inner boundary marker) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <ringGeometry args={[5.5, 5.7, 48]} />
        <meshStandardMaterial color="#d0c8b8" roughness={0.5} />
      </mesh>

      {/* Centre cross — player alignment mark */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <planeGeometry args={[8, 0.12]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
        <planeGeometry args={[0.12, 8]} />
        <meshStandardMaterial color="#c8c0b0" roughness={0.5} />
      </mesh>
    </group>
  )
}

// ─── MMA-style octagonal cage ─────────────────────────────────────────────────
function OctagonCage() {
  const BARS = 11   // vertical bars per panel — denser, more realistic

  // Alternating red/blue corner pads (MMA standard)
  const padColors = ['#8b1a1a', '#1a3a8b', '#8b1a1a', '#1a3a8b', '#8b1a1a', '#1a3a8b', '#8b1a1a', '#1a3a8b']

  return (
    <group>
      {/* 8 fence panels */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8
        return (
          <group
            key={i}
            position={[Math.sin(angle) * APOTHEM, 0, Math.cos(angle) * APOTHEM]}
            rotation={[0, angle, 0]}
          >
            {/* Vertical bars */}
            {Array.from({ length: BARS }, (_, j) => (
              <mesh
                key={j}
                position={[(j / (BARS - 1) - 0.5) * PANEL_W, CAGE_H / 2, 0]}
              >
                <boxGeometry args={[0.055, CAGE_H, 0.055]} />
                <meshStandardMaterial color="#282830" metalness={0.8} roughness={0.3} />
              </mesh>
            ))}

            {/* Horizontal rails — 4 rails for more authentic look */}
            {[0.3, CAGE_H * 0.36, CAGE_H * 0.65, CAGE_H - 0.2].map((y, j) => (
              <mesh key={j} position={[0, y, 0]}>
                <boxGeometry args={[PANEL_W + 0.05, 0.07, 0.07]} />
                <meshStandardMaterial color={C.metalLight} metalness={0.65} roughness={0.45} />
              </mesh>
            ))}

            {/* Top cap rail */}
            <mesh position={[0, CAGE_H + 0.07, 0]}>
              <boxGeometry args={[PANEL_W + 0.1, 0.16, 0.16]} />
              <meshStandardMaterial color={C.metal} metalness={0.78} roughness={0.35} />
            </mesh>

            {/* Bottom base rail */}
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[PANEL_W + 0.08, 0.14, 0.14]} />
              <meshStandardMaterial color={C.metal} metalness={0.78} roughness={0.35} />
            </mesh>
          </group>
        )
      })}

      {/* 8 corner posts + coloured foam pads */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const px = Math.sin(angle) * VERTEX_R
        const pz = Math.cos(angle) * VERTEX_R
        return (
          <group key={i} position={[px, 0, pz]}>
            {/* Steel post */}
            <mesh position={[0, CAGE_H / 2, 0]} castShadow>
              <boxGeometry args={[0.22, CAGE_H + 0.35, 0.22]} />
              <meshStandardMaterial color="#0c0c0e" metalness={0.88} roughness={0.22} />
            </mesh>
            {/* Foam corner pad (lower half of cage) */}
            <mesh position={[0, CAGE_H * 0.28, 0]}>
              <boxGeometry args={[0.32, CAGE_H * 0.52, 0.32]} />
              <meshStandardMaterial color={padColors[i]} roughness={0.9} metalness={0} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// ─── Overhead light rig with hazard-striped beams ────────────────────────────
function OverheadRig() {
  const RIG_Y  = WALL_H - 0.55
  const SPAN   = ROOM_HALF * 1.9

  return (
    <group>
      {/* Two main structural cross-beams (X and Z axes) */}
      {[0, Math.PI / 2].map((rotY, i) => (
        <group key={i} position={[0, RIG_Y, 0]} rotation={[0, rotY, 0]}>
          {/* Web */}
          <mesh>
            <boxGeometry args={[SPAN, 0.4, 0.32]} />
            <meshStandardMaterial color={C.metal} metalness={0.7} roughness={0.5} />
          </mesh>
          {/* Bottom flange */}
          <mesh position={[0, -0.24, 0]}>
            <boxGeometry args={[SPAN, 0.08, 0.72]} />
            <meshStandardMaterial color={C.metal} metalness={0.7} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* 4 industrial floodlight pods on the beams */}
      {[[-7, 0], [7, 0], [0, -7], [0, 7]].map(([ox, oz], i) => (
        <group key={i} position={[ox, RIG_Y - 0.55, oz]}>
          {/* Pod housing */}
          <mesh>
            <cylinderGeometry args={[0.55, 0.72, 0.35, 8]} />
            <meshStandardMaterial color="#181818" metalness={0.6} roughness={0.5} />
          </mesh>
          {/* Emissive lens */}
          <mesh position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]}>
            <circleGeometry args={[0.48, 8]} />
            <meshStandardMaterial color="#fff8d0" emissive="#fff8d0" emissiveIntensity={4} />
          </mesh>
          {/* Cage guard ring */}
          <mesh position={[0, -0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.52, 0.025, 6, 12]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Hazard-striped secondary beams (2 beams parallel to Z, above cage) */}
      {[-11, 11].map((ox, bi) => (
        <group key={bi} position={[ox, RIG_Y + 0.25, 0]}>
          {Array.from({ length: 10 }, (_, j) => (
            <mesh key={j} position={[0, 0, (j - 4.5) * 3.2]}>
              <boxGeometry args={[1.4, 0.45, 3.19]} />
              <meshStandardMaterial
                color={j % 2 === 0 ? C.yellow : C.black}
                roughness={0.35}
              />
            </mesh>
          ))}
          {/* Bottom flange */}
          <mesh position={[0, -0.27, 0]}>
            <boxGeometry args={[1.1, 0.08, ROOM_HALF * 2 - 4]} />
            <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Pendant drop chains / cables at corners of rig */}
      {[[-6, -6], [6, -6], [-6, 6], [6, 6]].map(([ox, oz], i) => (
        <mesh key={i} position={[ox, RIG_Y - 1, oz]}>
          <cylinderGeometry args={[0.02, 0.02, 2, 4]} />
          <meshStandardMaterial color="#111" metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Warehouse concrete floor ─────────────────────────────────────────────────
function WarehouseFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_HALF * 2, ROOM_HALF * 2]} />
        <meshStandardMaterial color={C.floor} roughness={0.96} />
      </mesh>
      {/* Slightly worn ring around cage base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[VERTEX_R + 0.1, VERTEX_R + 4, 64]} />
        <meshStandardMaterial color="#222120" roughness={0.98} />
      </mesh>
    </group>
  )
}

// ─── Warehouse walls ──────────────────────────────────────────────────────────
function WarehouseWalls() {
  const H = ROOM_HALF
  const S = H * 2

  return (
    <group>
      {/* 4 concrete walls */}
      {[
        { pos: [0,    WALL_H / 2, -H + 0.6], dims: [S + 1.2, WALL_H, 1.2] },
        { pos: [0,    WALL_H / 2,  H - 0.6], dims: [S + 1.2, WALL_H, 1.2] },
        { pos: [-H + 0.6, WALL_H / 2, 0],   dims: [1.2, WALL_H, S + 1.2] },
        { pos: [ H - 0.6, WALL_H / 2, 0],   dims: [1.2, WALL_H, S + 1.2] },
      ].map((w, i) => (
        <mesh key={i} position={w.pos} receiveShadow>
          <boxGeometry args={w.dims} />
          <meshStandardMaterial color={C.wall} roughness={1} />
        </mesh>
      ))}

      {/* Yellow hazard stripe at the base of each wall */}
      {[
        { pos: [0, 0.13, -H + 1.25],  dims: [S - 2, 0.26, 0.04] },
        { pos: [0, 0.13,  H - 1.25],  dims: [S - 2, 0.26, 0.04] },
        { pos: [-H + 1.25, 0.13, 0],  dims: [0.04, 0.26, S - 2] },
        { pos: [ H - 1.25, 0.13, 0],  dims: [0.04, 0.26, S - 2] },
      ].map((s, i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={s.dims} />
          <meshStandardMaterial color={C.yellow} roughness={0.4} />
        </mesh>
      ))}

      {/* Mid-wall horizontal divider strip */}
      {[
        { pos: [0, WALL_H * 0.42, -H + 0.62], dims: [S, 0.12, 0.04] },
        { pos: [0, WALL_H * 0.42,  H - 0.62], dims: [S, 0.12, 0.04] },
        { pos: [-H + 0.62, WALL_H * 0.42, 0], dims: [0.04, 0.12, S] },
        { pos: [ H - 0.62, WALL_H * 0.42, 0], dims: [0.04, 0.12, S] },
      ].map((s, i) => (
        <mesh key={i} position={s.pos}>
          <boxGeometry args={s.dims} />
          <meshStandardMaterial color="#303030" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Ceiling with exposed I-beams ─────────────────────────────────────────────
function WarehouseCeiling() {
  const S = ROOM_HALF * 2
  return (
    <group>
      <mesh position={[0, WALL_H + 0.5, 0]}>
        <boxGeometry args={[S + 1.2, 1.0, S + 1.2]} />
        <meshStandardMaterial color={C.concrete} roughness={1} />
      </mesh>
      {[-8, 0, 8].map((x, i) => (
        <group key={i} position={[x, WALL_H - 0.75, 0]}>
          <mesh>
            <boxGeometry args={[0.14, 1.1, S - 2]} />
            <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[0.72, 0.13, S - 2]} />
            <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.6, 0]}>
            <boxGeometry args={[0.72, 0.13, S - 2]} />
            <meshStandardMaterial color={C.metal} metalness={0.6} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ─── Corner columns ───────────────────────────────────────────────────────────
function Columns() {
  const H = ROOM_HALF - 1.5
  const positions = [
    [-H, -H], [H, -H], [-H, H], [H, H],
    [0, -H], [0, H], [-H, 0], [H, 0],
  ]
  return (
    <>
      {positions.map(([px, pz], i) => (
        <mesh key={i} position={[px, WALL_H / 2, pz]} receiveShadow>
          <boxGeometry args={[1.9, WALL_H + 1, 1.9]} />
          <meshStandardMaterial color={C.concrete} roughness={1} />
        </mesh>
      ))}
    </>
  )
}

// ─── Crowd silhouettes ────────────────────────────────────────────────────────
function Crowd() {
  const COUNT   = 140
  const bodyRef = useRef()
  const headRef = useRef()
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  const figures = useMemo(() => (
    Array.from({ length: COUNT }, (_, i) => {
      const angle  = (i / COUNT) * Math.PI * 2 + (pseudoRandom(i * 7.3) - 0.5) * 0.18
      const radius = VERTEX_R + 2.2 + pseudoRandom(i * 13.7) * 5.0
      const h      = 0.9  + pseudoRandom(i * 5.1) * 0.65
      const w      = 0.32 + pseudoRandom(i * 3.9) * 0.12
      const headR  = w * 0.42
      return {
        x: Math.sin(angle) * radius,
        z: Math.cos(angle) * radius,
        bodyY: h / 2,
        headY: h + headR * 0.9,
        rotY:  angle + Math.PI,
        sx: w, sy: h, sz: w * 0.48,
        headR,
      }
    })
  ), [])

  useEffect(() => {
    if (!bodyRef.current || !headRef.current) return

    figures.forEach((f, i) => {
      // Body
      dummy.position.set(f.x, f.bodyY, f.z)
      dummy.rotation.set(0, f.rotY, 0)
      dummy.scale.set(f.sx, f.sy, f.sz)
      dummy.updateMatrix()
      bodyRef.current.setMatrixAt(i, dummy.matrix)

      // Head
      dummy.position.set(f.x, f.headY, f.z)
      dummy.rotation.set(0, f.rotY, 0)
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
        <meshStandardMaterial color={C.crowd} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[null, null, COUNT]}>
        <sphereGeometry args={[1, 7, 7]} />
        <meshStandardMaterial color="#1e1c1a" roughness={1} />
      </instancedMesh>
    </>
  )
}

// ─── Scattered industrial props ───────────────────────────────────────────────
function Props() {
  const barrels = [[-18, -6], [-18, -3.5], [-20, 9], [19, 12], [18.5, -9], [-18, 14]]
  const crates  = [[-17, -17], [17, -17], [-18, 17]]

  return (
    <group>
      {barrels.map(([px, pz], i) => {
        const lean = (pseudoRandom(i * 17) - 0.5) * 0.09
        return (
          <group key={i} position={[px, 0, pz]} rotation={[lean, pseudoRandom(i * 9) * 6, 0]}>
            <mesh position={[0, 0.52, 0]} castShadow>
              <cylinderGeometry args={[0.33, 0.33, 1.04, 8]} />
              <meshStandardMaterial color="#1e1c18" metalness={0.4} roughness={0.85} />
            </mesh>
            {[0.18, 0.52, 0.86].map((y, j) => (
              <mesh key={j} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.345, 0.026, 6, 16]} />
                <meshStandardMaterial color="#111010" metalness={0.5} roughness={0.7} />
              </mesh>
            ))}
          </group>
        )
      })}

      {crates.map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          {[0, 0.8, 1.6].map((y, j) => (
            <mesh key={j} position={[0, y + 0.38, 0]} castShadow>
              <boxGeometry args={[1.1 - j * 0.08, 0.72, 1.1 - j * 0.08]} />
              <meshStandardMaterial color="#1a1814" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function Arena() {
  return (
    <group>
      <WarehouseFloor />
      <OctagonMat />
      <OctagonCage />
      <OverheadRig />
      <WarehouseWalls />
      <WarehouseCeiling />
      <Columns />
      <Crowd />
      <Props />
    </group>
  )
}
