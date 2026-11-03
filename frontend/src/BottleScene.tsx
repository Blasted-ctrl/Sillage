import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import {
  CanvasTexture,
  SRGBColorSpace,
  MathUtils,
  AdditiveBlending,
} from 'three'
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
        side * (spread * 1.4 + progress * (1.4 + index * 0.04)),
        -1.45 +
          Math.sin(index * 1.7) * 0.3 +
          progress * (0.65 + (index % 3) * 0.12),
        index < 7 ? -0.8 : 0.65,
      )
      sprite.scale.set(3.8 + progress * 2, 0.55 + progress * 0.8, 1)
      const material = sprite.material as SpriteMaterial
      material.opacity = 0.16 + Math.sin(progress * Math.PI) * 0.22
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
            opacity={0.16}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}

function Backlight({ color }: { color: string }) {
  const [texture] = useState(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    glow.addColorStop(0, color)
    glow.addColorStop(1, color + '00')
    context.fillStyle = glow
    context.fillRect(0, 0, 128, 128)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return map
  })
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <sprite position={[0, 0, -1.5]} scale={[5, 5, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </sprite>
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
      context.clearRect(0, 0, 512, 640)
      context.strokeStyle = colors.ink
      context.lineWidth = 2
      context.fillStyle = colors.ink
      context.textAlign = 'center'
      context.font = '600 66px ' + colors.sans
      context.fillText('SILLAGE', 256, 248)
      context.font = '19px ' + colors.sans
      context.fillText('L’ART DE LA PRÉSENCE', 256, 294)
      context.font = '18px ' + colors.sans
      context.fillText('EAU DE PARFUM', 256, 524)
      context.beginPath()
      for (let line = 0; line < 3; line++) {
        context.moveTo(218 + line * 32, 140)
        context.bezierCurveTo(
          185 + line * 32,
          115,
          250 + line * 32,
          100,
          220 + line * 32,
          75,
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
    <group ref={group} rotation={[0.08, -0.32, -0.15]} position={[0, 0, 0]}>
      <RoundedBox args={[1.62, 2.45, 0.84]} radius={0.13} smoothness={6}>
        <MeshTransmissionMaterial
          color={colors.glass}
          samples={4}
          resolution={512}
          backside
          backsideResolution={128}
          metalness={0}
          roughness={0.08}
          transmission={1}
          thickness={0.8}
          ior={1.5}
          chromaticAberration={0.035}
          temporalDistortion={0}
          distortion={0}
          clearcoat={1}
          envMapIntensity={1.2}
        />
      </RoundedBox>
      <RoundedBox
        args={[1.37, 1.72, 0.62]}
        position={[0, -0.18, 0]}
        radius={0.1}
        smoothness={3}
      >
        <meshPhysicalMaterial
          color={colors['liquid' + mood]}
          metalness={0.1}
          roughness={0.12}
          transparent
          opacity={0.23}
          depthWrite={false}
          thickness={0.5}
          ior={1.33}
          clearcoat={1}
        />
      </RoundedBox>
      <mesh position={[0, 1.3, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.16, 64]} />
        <meshStandardMaterial
          color={colors.gold}
          metalness={0.85}
          roughness={0.22}
        />
      </mesh>
      <group position={[0, 1.66, 0]}>
        <mesh>
          <cylinderGeometry args={[0.35, 0.36, 0.58, 64]} />
          <meshPhysicalMaterial
            color={colors.cap}
            metalness={0.8}
            roughness={0.19}
            clearcoat={1}
          />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.345, 0.35, 0.035, 64]} />
          <meshStandardMaterial
            color={colors.cap}
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
        {Array.from({ length: 40 }, (_, index) => {
          const angle = (index / 40) * Math.PI * 2
          return (
            <mesh
              key={index}
              position={[Math.sin(angle) * 0.354, 0, Math.cos(angle) * 0.354]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[0.008, 0.49, 0.012]} />
              <meshStandardMaterial
                color={colors.rib}
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
          )
        })}
      </group>
      <mesh
        position={[0, -0.02, 0.435]}
        renderOrder={5}
        onBeforeRender={(renderer) => {
          // Printed lettering sits on the glass; exclude it from the
          // refraction buffer so it does not produce a second, warped label.
          if (labelMaterial.current) {
            labelMaterial.current.opacity = renderer.getRenderTarget() ? 0 : 1
          }
        }}
      >
        <planeGeometry args={[1.23, 1.7]} />
        <meshStandardMaterial
          ref={labelMaterial}
          roughness={0.3}
          transparent
          depthWrite={false}
        />
      </mesh>
      <RoundedBox
        args={[1.54, 0.13, 0.77]}
        radius={0.045}
        position={[0, -1.13, 0]}
        smoothness={3}
      >
        <meshStandardMaterial
          color={colors.glass}
          metalness={0.7}
          roughness={0.08}
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
        'light',
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
        camera={{ position: [0, 0.5, 7.5], fov: 37 }}
        fallback={
          <div className="scene-fallback">
            A little mystery. A scent of your own.
          </div>
        }
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[-3, 4, 5]}
          intensity={2}
          color={colors.ink}
        />
        <Bottle rotation={rotation} mood={mood} colors={colors} />
        <Backlight color={colors.mist} />
        <Mist burst={burst} color={colors.mist} />
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={3}
            position={[4, 2, 2]}
            target={[0, 0, 0]}
            scale={[0.8, 7, 1]}
            color={colors.ink}
          />
          <Lightformer
            form="rect"
            intensity={4}
            position={[-4, 1, 1]}
            target={[0, 0, 0]}
            scale={[0.6, 7, 1]}
            color={colors.light}
          />
          <Lightformer
            form="rect"
            color={colors.gold}
            intensity={3}
            position={[0, 4, 1]}
            target={[0, 0, 0]}
            scale={[4, 2, 1]}
          />
          <Lightformer
            form="rect"
            color={colors.ink}
            intensity={2}
            position={[-1, 0, 4]}
            target={[0, 0, 0]}
            scale={[0.35, 5, 1]}
          />
          <Lightformer
            form="ring"
            color={colors.glass}
            intensity={4}
            position={[0, 1, -3]}
            scale={4}
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
