import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Environment,
  Lightformer,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace, MathUtils } from 'three'
import type { Group, MeshStandardMaterial, Sprite, SpriteMaterial } from 'three'
import { useReducedMotion } from './useReducedMotion'

type Colors = Record<string, string>

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        A little mystery. A scent of your own.
      </div>
    ) : (
      this.props.children
    )
  }
}

function makeMistTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const data = context.createImageData(128, 128)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = (x - 64) / 62,
        dy = (y - 64) / 62
      const falloff = Math.max(0, 1 - dx * dx - dy * dy)
      const noise =
        0.65 +
        0.2 * Math.sin(x * 0.15 + Math.cos(y * 0.13) * 2) +
        0.15 * Math.cos(y * 0.2)
      const i = (y * 128 + x) * 4
      data.data[i] = data.data[i + 1] = data.data[i + 2] = 255
      data.data[i + 3] = Math.round(Math.pow(falloff, 2.4) * noise * 170)
    }
  }
  context.putImageData(data, 0, 0)
  return new CanvasTexture(canvas)
}

function Mist({ burst, color }: { burst: number; color: string }) {
  const [texture] = useState(makeMistTexture)
  const sprites = useRef<(Sprite | null)[]>([])
  const elapsed = useRef(5)
  const firstFrame = useRef(false)
  const reduced = useReducedMotion()
  const invalidate = useThree((state) => state.invalidate)

  function pose(progress: number) {
    for (let index = 0; index < 14; index++) {
      const sprite = sprites.current[index]
      if (!sprite) continue
      const side = index % 2 === 0 ? -1 : 1
      const spread = 0.35 + (index % 7) * 0.23
      sprite.position.set(
        side * (spread + progress * (0.9 + index * 0.04)),
        -0.9 +
          Math.sin(index * 1.7) * 0.3 +
          progress * (0.65 + (index % 3) * 0.12),
        index < 7 ? -0.8 : 0.65,
      )
      sprite.scale.set(2.2 + progress * 1.5, 0.9 + progress * 0.8, 1)
      const material = sprite.material as SpriteMaterial
      material.opacity = 0.065 + Math.sin(progress * Math.PI) * 0.15
      material.rotation = side * (0.18 + progress * 0.2)
    }
  }

  useEffect(() => {
    elapsed.current = burst > 0 ? 0 : 5
    firstFrame.current = true
    pose(reduced && burst > 0 ? 0.5 : 0)
    invalidate()
  }, [burst, reduced, invalidate])

  useEffect(() => () => texture.dispose(), [texture])
  useFrame((_, delta) => {
    if (reduced || elapsed.current >= 4.8) return
    if (firstFrame.current) {
      firstFrame.current = false
      invalidate()
      return
    }
    elapsed.current = Math.min(4.8, elapsed.current + delta)
    pose(elapsed.current / 4.8)
    if (elapsed.current < 4.8) invalidate()
  })

  return (
    <group>
      {Array.from({ length: 14 }, (_, index) => (
        <sprite
          key={index}
          ref={(node) => {
            sprites.current[index] = node
          }}
          position={[index % 2 ? 1 : -1, -0.9, index < 7 ? -0.8 : 0.65]}
          scale={[2.2, 0.9, 1]}
        >
          <spriteMaterial
            map={texture}
            color={color}
            transparent
            opacity={0.065}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}

function Bottle({
  rotation,
  mood,
  colors,
}: {
  rotation: number
  mood: number
  colors: Colors
}) {
  const group = useRef<Group>(null)
  const labelMaterial = useRef<MeshStandardMaterial>(null)
  const reduced = useReducedMotion()
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 640
    const label = new CanvasTexture(canvas)
    let disposed = false
    function paint() {
      if (disposed) return
      const context = canvas.getContext('2d')!
      context.fillStyle = colors.paper
      context.fillRect(0, 0, 512, 640)
      context.strokeStyle = colors.ink
      context.lineWidth = 2
      context.strokeRect(24, 24, 464, 592)
      context.fillStyle = colors.ink
      context.textAlign = 'center'
      context.font = '78px ' + colors.serif
      context.fillText('Sillage', 256, 280)
      context.font = '21px ' + colors.sans
      context.fillText('Follow your senses', 256, 337)
      context.beginPath()
      for (let line = 0; line < 3; line++) {
        context.moveTo(218 + line * 32, 430)
        context.bezierCurveTo(
          185 + line * 32,
          405,
          250 + line * 32,
          390,
          220 + line * 32,
          365,
        )
      }
      context.stroke()
      label.colorSpace = SRGBColorSpace
      label.needsUpdate = true
      if (labelMaterial.current) {
        labelMaterial.current.map = label
        labelMaterial.current.needsUpdate = true
      }
      invalidate()
    }
    paint()
    void document.fonts.ready.then(paint)
    return () => {
      disposed = true
      label.dispose()
    }
  }, [colors, invalidate])
  useEffect(() => {
    if (group.current && reduced) group.current.rotation.y = rotation
    invalidate()
  }, [rotation, reduced, invalidate])

  useFrame((_, delta) => {
    if (!group.current || reduced) return
    const next = MathUtils.damp(group.current.rotation.y, rotation, 7, delta)
    group.current.rotation.y = next
    if (Math.abs(next - rotation) > 0.001) invalidate()
  })

  return (
    <group ref={group} rotation={[0.08, -0.32, -0.06]} position={[0, -0.15, 0]}>
      <RoundedBox args={[1.68, 2.3, 0.88]} radius={0.18} smoothness={5}>
        <meshPhysicalMaterial
          color={colors.glass}
          metalness={0.15}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.1}
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </RoundedBox>
      <RoundedBox
        args={[1.44, 1.43, 0.65]}
        position={[0, -0.3, 0]}
        radius={0.08}
        smoothness={3}
      >
        <meshStandardMaterial
          color={colors['liquid' + mood]}
          metalness={0.15}
          roughness={0.24}
          transparent
          opacity={0.85}
        />
      </RoundedBox>
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[0.25, 0.29, 0.28, 40]} />
        <meshStandardMaterial
          color={colors.gold}
          metalness={0.85}
          roughness={0.22}
        />
      </mesh>
      <group position={[0, 1.64, 0]}>
        <mesh>
          <cylinderGeometry args={[0.43, 0.43, 0.58, 48]} />
          <meshStandardMaterial
            color={colors.cap}
            metalness={0.55}
            roughness={0.18}
          />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.4, 0.43, 0.035, 48]} />
          <meshStandardMaterial
            color={colors.gold}
            metalness={0.65}
            roughness={0.25}
          />
        </mesh>
        {Array.from({ length: 24 }, (_, index) => {
          const angle = (index / 24) * Math.PI * 2
          return (
            <mesh
              key={index}
              position={[Math.sin(angle) * 0.427, 0, Math.cos(angle) * 0.427]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.018, 0.48, 0.018]} />
              <meshStandardMaterial
                color={colors.rib}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          )
        })}
      </group>
      <mesh position={[0, -0.02, 0.449]}>
        <planeGeometry args={[1.04, 1.3]} />
        <meshStandardMaterial ref={labelMaterial} roughness={0.8} />
      </mesh>
      <RoundedBox
        args={[1.58, 0.09, 0.78]}
        radius={0.035}
        position={[0, -1.12, 0]}
        smoothness={3}
      >
        <meshStandardMaterial
          color={colors.glass}
          metalness={0.55}
          roughness={0.1}
        />
      </RoundedBox>
    </group>
  )
}

export default function BottleScene({
  rotation,
  mood = 0,
  burst = 0,
}: {
  rotation: number
  mood?: number
  burst?: number
}) {
  const [colors] = useState(() => {
    const styles = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      [
        'paper',
        'ink',
        'glass',
        'liquid0',
        'liquid1',
        'liquid2',
        'gold',
        'cap',
        'rib',
        'mist',
        'serif',
        'sans',
      ].map((name) => [
        name,
        styles.getPropertyValue('--scene-' + name).trim(),
      ]),
    )
  })
  return (
    <SceneBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.3, 6.3], fov: 37 }}
        fallback={
          <div className="scene-fallback">
            A little mystery. A scent of your own.
          </div>
        }
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[-3, 4, 5]} intensity={3} />
        <Bottle rotation={rotation} mood={mood} colors={colors} />
        <Mist burst={burst} color={colors.mist} />
        <Environment resolution={128}>
          <Lightformer
            form="rect"
            intensity={5}
            position={[3, 2, 3]}
            scale={[2, 6, 1]}
          />
          <Lightformer
            form="rect"
            intensity={3}
            position={[-3, 1, 2]}
            scale={[1, 5, 1]}
          />
          <Lightformer
            form="rect"
            color={colors.gold}
            intensity={2}
            position={[0, -2, 2]}
            scale={[4, 1, 1]}
          />
        </Environment>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </SceneBoundary>
  )
}
