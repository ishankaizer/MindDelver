import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPECIES, fishSprite } from '../lib/fish'
import { FLOOR_Y, rng } from '../lib/sea'

/**
 * The fish are billboards on lazy orbits rather than anything that steers.
 * Real boids would be invisible at this scale and this distance; what actually
 * reads is a shoal crossing behind the coral at one speed while a lone fish
 * drifts past in front at another, so that is what is built: a handful of
 * schools on shared rings, plus loners on rings of their own.
 */

type School = {
  radius: number
  y: number
  speed: number
  phase: number
  tilt: number
}

type Fish = {
  school: number
  species: number
  size: number
  dAngle: number
  dRadius: number
  dY: number
  bob: number
  beat: number
}

const RIGHT = new THREE.Vector3()

export function Fish() {
  const group = useRef<THREE.Group>(null)

  const { schools, fish, sprites, geometry } = useMemo(() => {
    const rand = rng(90210)

    // four shoals of small fish, then a set of one-per-ring bigger fish
    const schools: School[] = []
    for (let i = 0; i < 5; i++) {
      schools.push({
        radius: 11 + rand() * 17,
        y: FLOOR_Y + 3 + rand() * 16,
        speed: (0.055 + rand() * 0.07) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.25,
      })
    }
    for (let i = 0; i < 8; i++) {
      schools.push({
        radius: 12 + rand() * 24,
        y: FLOOR_Y + 2 + rand() * 20,
        speed: (0.03 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.3,
      })
    }

    // sizes are judged against the coral, not against a real fish: anything
    // scaled honestly against a twelve-metre sculpture would be a single pixel
    const fish: Fish[] = []
    for (let s = 0; s < 5; s++) {
      const species = Math.floor(rand() * SPECIES.length)
      const members = 7 + Math.floor(rand() * 6)
      for (let i = 0; i < members; i++) {
        fish.push({
          school: s,
          // a shoal is one species: mixed colours in a tight group read as confetti
          species,
          size: 0.4 + rand() * 0.24,
          dAngle: (rand() - 0.5) * 0.45,
          dRadius: (rand() - 0.5) * 4,
          dY: (rand() - 0.5) * 3,
          bob: rand() * Math.PI * 2,
          beat: 5 + rand() * 3,
        })
      }
    }
    for (let s = 5; s < schools.length; s++) {
      fish.push({
        school: s,
        species: Math.floor(rand() * SPECIES.length),
        size: 0.72 + rand() * 0.45,
        dAngle: 0,
        dRadius: 0,
        dY: 0,
        bob: rand() * Math.PI * 2,
        beat: 3.4 + rand() * 2,
      })
    }

    // one sprite per species, then a clone per fish so each can hold its own
    // frame; the clone shares the image, it is only the uv offset that differs
    const base = SPECIES.map((_, i) => fishSprite(i, i * 31 + 7))
    const sprites = fish.map((f) => {
      const tex = base[f.species].texture.clone()
      tex.needsUpdate = true
      return { texture: tex, aspect: base[f.species].aspect }
    })

    return { schools, fish, sprites, geometry: new THREE.PlaneGeometry(1, 1) }
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      for (const s of sprites) s.texture.dispose()
    },
    [geometry, sprites],
  )

  useFrame(({ clock, camera }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    RIGHT.setFromMatrixColumn(camera.matrixWorld, 0)

    for (let i = 0; i < fish.length; i++) {
      const child = g.children[i]
      const f = fish[i]
      const s = schools[f.school]
      if (!child) continue

      const a = s.phase + t * s.speed + f.dAngle
      const r = s.radius + f.dRadius + Math.sin(t * 0.37 + f.bob) * 0.8
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = s.y + f.dY + Math.sin(t * 0.63 + f.bob) * 0.7 + Math.sin(a * 2) * s.tilt * 4

      child.position.set(x, y, z)
      child.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z)

      // flip the sprite so the fish always faces the way it is going, judged
      // against the camera's own right: this is the one thing that separates a
      // swimming fish from a sticker sliding sideways
      const dir = Math.sign(s.speed)
      const facing = -Math.sin(a) * dir * RIGHT.x + Math.cos(a) * dir * RIGHT.z > 0 ? 1 : -1
      const sprite = sprites[i]
      child.scale.set(f.size * sprite.aspect * facing, f.size, 1)

      const frame = Math.floor(t * f.beat + f.bob) % 2
      sprite.texture.offset.x = frame * 0.5
    }
  })

  return (
    <group ref={group}>
      {fish.map((_, i) => (
        <mesh key={i} geometry={geometry} raycast={() => null}>
          <meshBasicMaterial
            map={sprites[i].texture}
            alphaTest={0.5}
            side={THREE.DoubleSide}
            fog
          />
        </mesh>
      ))}
    </group>
  )
}
