import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { CHARACTER_MODEL_PATHS } from '../game/constants/game'
import Button from '../components/Button'
import backgroundImg from '../assets/background/background.webp'

const CHARACTERS = [
  { key: 'blue', label: 'Fighter A', color: '#3b82f6' },
  { key: 'red', label: 'Fighter B', color: '#ef4444' },
  { key: 'black', label: 'Fighter C', color: '#6b7280' },
  { key: 'white', label: 'Fighter D', color: '#e5e7eb' },
]

const FACE_PLANE_SIZE = 0.38
const FACE_OFFSET = new THREE.Vector3(0, 0.08, 0.14)

function CharacterPreview({ modelPath, faceUrl, selected, onClick, position }) {
  const groupRef = useRef()
  const { scene, animations } = useGLTF(modelPath)
  const clonedScene = useMemo(() => clone(scene), [scene])
  const sanitized = useMemo(() =>
    animations.map(clip => {
      const c = clip.clone()
      c.tracks = c.tracks.filter(t => !t.name.endsWith('.position'))
      return c
    }), [animations])
  const { actions } = useAnimations(sanitized, clonedScene)

  // Play idle animation
  useEffect(() => {
    const idle = Object.values(actions).find(a =>
      a.getClip().name.toLowerCase().includes('idle')
    )
    if (idle) {
      idle.reset().setLoop(THREE.LoopRepeat).play()
    }
  }, [actions])

  // Enable shadows
  useEffect(() => {
    clonedScene.traverse(node => {
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = false }
    })
  }, [clonedScene])

  // Attach face texture
  useEffect(() => {
    let headBone = null
    clonedScene.traverse(node => {
      if (node.isBone && node.name === 'mixamorig:Head') headBone = node
    })
    if (!headBone || !faceUrl) return

    const existing = headBone.getObjectByName('__facePlane__')
    if (existing) headBone.remove(existing)

    const texture = new THREE.TextureLoader().load(faceUrl)
    texture.colorSpace = THREE.SRGBColorSpace
    const geo = new THREE.CircleGeometry(FACE_PLANE_SIZE, 32)
    const mat = new THREE.MeshStandardMaterial({
      map: texture, transparent: true, depthWrite: false,
      side: THREE.FrontSide, roughness: 0.8, metalness: 0,
    })
    const plane = new THREE.Mesh(geo, mat)
    plane.name = '__facePlane__'
    plane.position.copy(FACE_OFFSET)
    headBone.add(plane)

    return () => {
      headBone.remove(plane)
      geo.dispose(); mat.dispose(); texture.dispose()
    }
  }, [clonedScene, faceUrl])

  // Slow rotate
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.008
    }
  })

  return (
    <group
      ref={groupRef}
      position={position}
      scale={selected ? [1.8, 1.8, 1.8] : [1.5, 1.5, 1.5]}
      onClick={onClick}
    >
      <primitive object={clonedScene} />
      {/* Selection ring */}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  )
}

function SelectScene({ faceUrl, selected, onSelect }) {
  const spacing = 2.2
  const startX = -((CHARACTERS.length - 1) * spacing) / 2

  return (
    <>
      <ambientLight intensity={0.7} color="#c8b888" />
      <pointLight position={[0, 6, 4]} intensity={40} color="#fff4d0" distance={30} decay={1.5} />
      <pointLight position={[-5, 4, 2]} intensity={15} color="#ffe8a0" distance={20} decay={2} />
      <pointLight position={[5, 4, 2]} intensity={15} color="#ffe8a0" distance={20} decay={2} />
      <fog attach="fog" args={['#1a1612', 20, 40]} />
      <color attach="background" args={['#161410']} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>

      {CHARACTERS.map((char, i) => (
        <CharacterPreview
          key={char.key}
          modelPath={CHARACTER_MODEL_PATHS[char.key]}
          faceUrl={faceUrl}
          selected={selected === char.key}
          onClick={() => onSelect(char.key)}
          position={[startX + i * spacing, 0, 0]}
        />
      ))}
    </>
  )
}

export default function CharacterSelect({ playerFaceUrl, onConfirm, onBack }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden select-none">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${backgroundImg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-black/60" />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors duration-150 text-sm font-medium tracking-wide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Title */}
      <div className="relative z-10 pt-8 pb-4 text-center">
        <h1 className="text-3xl font-black text-white tracking-wide">SELECT YOUR FIGHTER</h1>
        <p className="text-sm text-gray-400 mt-2">Choose a character to fight with</p>
      </div>

      {/* 3D Character Preview */}
      <div className="relative z-10 flex-1 min-h-0">
        <Canvas shadows camera={{ position: [0, 2.5, 6], fov: 45 }}>
          <Suspense fallback={null}>
            <SelectScene faceUrl={playerFaceUrl} selected={selected} onSelect={setSelected} />
          </Suspense>
        </Canvas>
      </div>

      {/* Character labels */}
      <div className="relative z-10 flex justify-center gap-6 pb-4">
        {CHARACTERS.map(char => (
          <button
            key={char.key}
            onClick={() => setSelected(char.key)}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-150 ${
              selected === char.key
                ? 'bg-white/20 border border-yellow-400/60 scale-105'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            <div
              className="w-5 h-5 rounded-full border-2"
              style={{
                backgroundColor: char.color,
                borderColor: selected === char.key ? '#facc15' : 'rgba(255,255,255,0.2)',
              }}
            />
            <span className={`text-xs font-bold tracking-wide ${selected === char.key ? 'text-yellow-400' : 'text-white/60'}`}>
              {char.label}
            </span>
          </button>
        ))}
      </div>

      {/* Start Game button */}
      <div className="relative z-10 flex justify-center pb-8">
        <Button
          onClick={() => selected && onConfirm(selected)}
          disabled={!selected}
          className="px-12 py-3 text-lg"
        >
          Start Game
        </Button>
      </div>
    </div>
  )
}
