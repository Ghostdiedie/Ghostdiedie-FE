import { useMemo } from 'react'
import * as THREE from 'three'
import {
  ARENA_RADIUS,
  WALL_HEIGHT,
  STAND_ROWS,
  STAND_ROW_HEIGHT,
  STAND_ROW_DEPTH,
  AUDIENCE_SCALE,
} from '../constants/game'

function AudienceFigure({ position, color }) {
  return (
    <group position={position} scale={AUDIENCE_SCALE}>
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[0.15, 0.3, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#f5deb3" />
      </mesh>
      {/* Left arm */}
      <group position={[-0.22, 0.1, 0]} rotation={[0, 0, 0.3]}>
        <mesh>
          <capsuleGeometry args={[0.05, 0.2, 4, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      {/* Right arm */}
      <group position={[0.22, 0.1, 0]} rotation={[0, 0, -0.3]}>
        <mesh>
          <capsuleGeometry args={[0.05, 0.2, 4, 6]} />
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
    </group>
  )
}

function AudienceRow({ radius, y, count }) {
  const figures = useMemo(() => {
    const arr = []
    const colors = ['#c2185b', '#1565c0', '#2e7d32', '#f57f17', '#6a1b9a', '#e65100', '#00838f', '#4527a0']
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const jitterR = (Math.random() - 0.5) * 0.3
      const jitterAngle = (Math.random() - 0.5) * (0.5 / count) * Math.PI * 2
      const a = angle + jitterAngle
      const r = radius + jitterR
      arr.push({
        key: i,
        pos: [Math.sin(a) * r, y, Math.cos(a) * r],
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
    return arr
  }, [radius, y, count])

  return (
    <>
      {figures.map((f) => (
        <AudienceFigure key={f.key} position={f.pos} color={f.color} />
      ))}
    </>
  )
}

function Stands() {
  const rows = []
  for (let i = 0; i < STAND_ROWS; i++) {
    const rowRadius = ARENA_RADIUS + 1 + i * STAND_ROW_DEPTH
    const rowY = i * STAND_ROW_HEIGHT + 0.3
    const audienceCount = 40 + i * 12

    // Stone seating step
    rows.push(
      <mesh key={`step-${i}`} position={[0, rowY / 2, 0]}>
        <cylinderGeometry args={[rowRadius + STAND_ROW_DEPTH, rowRadius, rowY + 0.3, 64, 1, true]} />
        <meshStandardMaterial color="#d4c5a9" side={THREE.DoubleSide} />
      </mesh>
    )

    // Flat seat surface
    rows.push(
      <mesh key={`seat-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, rowY + 0.15, 0]}>
        <ringGeometry args={[rowRadius, rowRadius + STAND_ROW_DEPTH, 64]} />
        <meshStandardMaterial color="#c4b590" />
      </mesh>
    )

    // Audience figures sitting on this row
    rows.push(
      <AudienceRow
        key={`aud-${i}`}
        radius={rowRadius + STAND_ROW_DEPTH * 0.5}
        y={rowY + 0.6}
        count={audienceCount}
      />
    )
  }
  return <group>{rows}</group>
}

function Pillars() {
  const pillars = useMemo(() => {
    const arr = []
    const count = 24
    const radius = ARENA_RADIUS + 1 + STAND_ROWS * STAND_ROW_DEPTH + 0.5
    const topY = STAND_ROWS * STAND_ROW_HEIGHT + 2
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      arr.push({
        key: i,
        pos: [Math.sin(angle) * radius, topY / 2, Math.cos(angle) * radius],
        height: topY,
      })
    }
    return arr
  }, [])

  return (
    <>
      {pillars.map((p) => (
        <mesh key={p.key} position={p.pos} castShadow>
          <cylinderGeometry args={[0.25, 0.3, p.height, 8]} />
          <meshStandardMaterial color="#c9b99a" />
        </mesh>
      ))}
    </>
  )
}

export function Arena() {
  const topRingRadius = ARENA_RADIUS + 1 + STAND_ROWS * STAND_ROW_DEPTH + 0.5
  const topRingY = STAND_ROWS * STAND_ROW_HEIGHT + 2

  return (
    <group>
      {/* Arena floor — sandy colosseum ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#e8d5a3" />
      </mesh>

      {/* Center ring marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.5, 2.7, 64]} />
        <meshStandardMaterial color="#c4a265" />
      </mesh>

      {/* Tiered audience stands */}
      <Stands />

      {/* Colosseum pillars around the top */}
      <Pillars />

      {/* Ground plane extending beyond colosseum */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#c8b888" />
      </mesh>
    </group>
  )
}
