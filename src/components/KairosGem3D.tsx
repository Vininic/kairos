import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, ContactShadows } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { KairosMark } from "./KairosLogo";

class ThreeErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

const APEX_Y = 1.02;
const TAIL_Y = -1.42;
const EQ_Y = 0.24;
const EQ_R = 0.8;

/** The kite gem — the Kairos mark in three dimensions. An asymmetric octahedron
 *  (short crown, long keel, like the SVG kite) cut in flat facets. */
function useKiteGeometry() {
  return useMemo(() => {
    const top: [number, number, number] = [0, APEX_Y, 0];
    const bottom: [number, number, number] = [0, TAIL_Y, 0];
    const eq: [number, number, number][] = [
      [EQ_R, EQ_Y, 0],
      [0, EQ_Y, EQ_R],
      [-EQ_R, EQ_Y, 0],
      [0, EQ_Y, -EQ_R],
    ];
    const tris: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = eq[i];
      const b = eq[(i + 1) % 4];
      tris.push(...top, ...b, ...a);
      tris.push(...bottom, ...a, ...b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris), 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

/** Kairos is seized by the forelock: a swept lock of rose-gold anchored at
 *  the apex — the one part of the moment you can grab. */
function Forelock() {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, APEX_Y - 0.04, 0),
      new THREE.Vector3(0.22, APEX_Y + 0.3, 0.06),
      new THREE.Vector3(0.58, APEX_Y + 0.44, 0.12),
      new THREE.Vector3(0.94, APEX_Y + 0.34, 0.16),
    ]);
    return new THREE.TubeGeometry(curve, 40, 0.042, 12, false);
  }, []);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color="#D98FA3" metalness={0.85} roughness={0.25} />
    </mesh>
  );
}

function Gem() {
  const geometry = useKiteGeometry();
  const spin = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.28;
  });

  return (
    <group position={[0, 0.12, 0]}>
      <Float speed={0.9} rotationIntensity={0} floatIntensity={0.28}>
        <group ref={spin}>
          {/* Outer glass, flat-faceted — the sky overhead at dusk */}
          <mesh geometry={geometry} castShadow>
            <meshPhysicalMaterial
              color="#9B6FA8"
              transmission={0.86}
              thickness={0.6}
              roughness={0.07}
              ior={1.5}
              clearcoat={1}
              clearcoatRoughness={0.06}
              attenuationColor="#4A2A52"
              attenuationDistance={2.2}
              flatShading
              transparent
              opacity={0.72}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Inner core — the caught moment, glowing rose at the horizon */}
          <mesh geometry={geometry} scale={0.42} position={[0, 0.05, 0]}>
            <meshStandardMaterial color="#E6A8BE" emissive="#B8467A" emissiveIntensity={0.85} roughness={0.4} flatShading />
          </mesh>
          {/* Equator ring, rose-gold metal */}
          <mesh position={[0, EQ_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[EQ_R + 0.035, 0.013, 14, 90]} />
            <meshStandardMaterial color="#D98FA3" metalness={0.9} roughness={0.2} />
          </mesh>
          <Forelock />
        </group>
      </Float>
    </group>
  );
}

interface Props { className?: string; compact?: boolean; quiet?: boolean; }

export default function KairosGem3D({ className, compact = false, quiet = false }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(id);
  }, []);

  const fallback = (
    <div className="grid h-full w-full place-items-center">
      <KairosMark className="h-32 w-32 text-secondary-soft" />
    </div>
  );

  return (
    <div className={`${className ?? ""} relative h-full w-full`}>
      {!ready && !quiet && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-dusk/70 backdrop-blur-sm transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3 text-primary-foreground/85">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
            <span className="text-[11px] uppercase tracking-[0.22em] text-secondary-soft">Loading Kairos</span>
          </div>
        </div>
      )}
      <ThreeErrorBoundary fallback={fallback}>
        <Canvas
          shadows
          dpr={[1, 1.75]}
          camera={{ position: [0, 0.15, 5.6], fov: 30 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={() => setReady(true)}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
            <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#E0899F" />
            <pointLight position={[0, 0.4, 2.5]} intensity={0.3} color="#F0C6D6" />
            <Gem />
            {!compact && (
              <ContactShadows position={[0, TAIL_Y - 0.18, 0]} opacity={0.26} scale={5} blur={2.2} far={2} />
            )}
            <Environment preset="studio" />
          </Suspense>
        </Canvas>
      </ThreeErrorBoundary>
    </div>
  );
}
