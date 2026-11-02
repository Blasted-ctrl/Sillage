import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  Environment,
  Lightformer,
  OrbitControls,
  RoundedBox,
} from '@react-three/drei'
import { CanvasTexture, SRGBColorSpace } from 'three'

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
      <div className="scene-fallback">The shape of your next discovery.</div>
    ) : (
      this.props.children
    )
  }
}

function Bottle({
  rotation,
  colors,
}: {
  rotation: number
  colors: Record<string, string>
}) {
  const [label] = useState(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')!
    context.fillStyle = colors.paper
    context.fillRect(0, 0, 512, 512)
    context.fillStyle = colors.ink
    context.textAlign = 'center'
    context.font = `52px ${colors.serif}`
    context.fillText('Sillage', 256, 225)
    context.font = `19px ${colors.sans}`
    context.fillText('Find your signature', 256, 285)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return texture
  })
  useEffect(() => () => label.dispose(), [label])
  return (
    <group rotation={[0.07, rotation, -0.08]} position={[0, -0.15, 0]}>
      <RoundedBox args={[1.7, 2.1, 0.85]} radius={0.13} smoothness={4}>
        <meshStandardMaterial
          color={colors.glass}
          metalness={0.12}
          roughness={0.12}
          transparent
          opacity={0.24}
          depthWrite={false}
        />
      </RoundedBox>
      <RoundedBox
        args={[1.48, 1.55, 0.65]}
        position={[0, -0.19, 0]}
        radius={0.07}
        smoothness={3}
      >
        <meshPhysicalMaterial
          color={colors.liquid}
          metalness={0.1}
          roughness={0.2}
          transparent
          opacity={0.78}
        />
      </RoundedBox>
      <mesh position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.3, 32]} />
        <meshStandardMaterial
          color={colors.gold}
          metalness={0.9}
          roughness={0.23}
        />
      </mesh>
      <RoundedBox
        args={[0.86, 0.57, 0.66]}
        radius={0.05}
        position={[0, 1.5, 0]}
        smoothness={3}
      >
        <meshStandardMaterial
          color={colors.cap}
          metalness={0.6}
          roughness={0.23}
        />
      </RoundedBox>
      <mesh position={[0, 0, 0.436]}>
        <planeGeometry args={[1.12, 1.08]} />
        <meshStandardMaterial map={label} roughness={0.8} />
      </mesh>
      <mesh position={[0, -1.08, 0]}>
        <boxGeometry args={[1.57, 0.05, 0.72]} />
        <meshStandardMaterial
          color={colors.gold}
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>
    </group>
  )
}

export default function BottleScene({ rotation }: { rotation: number }) {
  const [colors] = useState(() => {
    const styles = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      ['paper', 'ink', 'glass', 'liquid', 'gold', 'cap', 'serif', 'sans'].map(
        (name) => [name, styles.getPropertyValue(`--scene-${name}`).trim()],
      ),
    )
  })
  return (
    <SceneBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.4, 5.8], fov: 37 }}
        fallback={
          <div className="scene-fallback">
            The shape of your next discovery.
          </div>
        }
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 5]} intensity={2.6} />
        <Bottle rotation={rotation} colors={colors} />
        <Environment resolution={128}>
          <Lightformer
            form="rect"
            intensity={4}
            position={[3, 2, 3]}
            scale={[2, 5, 1]}
          />
          <Lightformer
            form="rect"
            intensity={2}
            position={[-3, 1, 2]}
            scale={[1, 4, 1]}
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
