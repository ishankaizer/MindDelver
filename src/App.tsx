import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Scene } from './components/Scene'
import { Grain } from './components/Grain'
import { Hud } from './components/Hud'
import { useGraph } from './store/useGraph'

export default function App() {
  const select = useGraph((s) => s.select)

  return (
    <>
      <Canvas
        camera={{ position: [0, 3.5, 22], fov: 46 }}
        dpr={[1, 1.6]}
        // dpr is capped low on purpose: the pixel pass quantises the frame
        // anyway, so rendering at full retina buys nothing but heat. ACES
        // desaturates the cyans this palette is built on, so Neutral it is.
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NeutralToneMapping,
          toneMappingExposure: 1.05,
        }}
        onPointerMissed={() => select(null)}
        // right-drag still pans; what goes is the browser menu that would
        // otherwise cover the reef every time a node is added to the mix
        onContextMenu={(e) => e.preventDefault()}
      >
        <Scene />
      </Canvas>
      <Hud />
      <Grain />
    </>
  )
}
