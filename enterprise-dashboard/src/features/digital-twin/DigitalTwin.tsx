"use client";

import { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls, Environment, Html, AccumulativeShadows,
  RandomizedLight, MeshReflectorMaterial, Lightformer,
  Grid, PerformanceMonitor,
} from '@react-three/drei';
import * as THREE from 'three';
import {
  EffectComposer, Bloom, SMAA, Vignette, ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useSimulationStore } from '@/lib/store';
import ScadaPID from '../scada/components/ScadaPID';

// ─── PIPE FLOW SHADERS ───────────────────────────────────────────────────────

const PIPE_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const PIPE_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uFlow;
  uniform float uPressure;
  uniform vec3  uLowCol;
  uniform vec3  uHighCol;
  uniform float uOpacity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  float hash(vec2 p){
    p=fract(p*vec2(443.897,441.423));
    p+=dot(p,p+19.19);
    return fract(p.x*p.y);
  }
  float noise(vec2 p){
    vec2 i=floor(p); vec2 f=fract(p);
    float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(a,b,u.x)+(c-a)*u.y*(1.0-u.x)+(d-b)*u.x*u.y;
  }

  void main(){
    float scrollV = vUv.y - uTime * uFlow * 0.55;
    float n1 = noise(vec2(vUv.x*3.0, scrollV*9.0));
    float n2 = noise(vec2(vUv.x*7.0+1.3, scrollV*18.0+0.7))*0.45;
    float flowNoise = n1 + n2;

    vec3 base = mix(uLowCol, uHighCol, uPressure);
    base += flowNoise * uFlow * 0.14;

    float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.2);
    base += uHighCol * fresnel * uPressure * 0.35;
    base += uHighCol * uPressure * 0.25;

    gl_FragColor = vec4(base, uOpacity * (0.55 + uFlow * 0.35));
  }
`;

// ─── COLOUR HELPERS ──────────────────────────────────────────────────────────

const hcol = (h: number) =>
  h >= 75 ? '#22C55E' : h >= 40 ? '#F59E0B' : '#EF4444';

const SensorTag = ({ pos, title, rows, color }: {
  pos: [number, number, number];
  title: string;
  rows: Array<{ label: string; value: string; col?: string }>;
  color: string;
}) => (
  <Html position={pos} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
    <div style={{
      background: 'rgba(14,17,23,0.93)',
      border: `1px solid ${color}`,
      borderRadius: 4,
      padding: '6px 10px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      whiteSpace: 'nowrap',
      boxShadow: `0 0 14px ${color}55`,
      minWidth: 130,
    }}>
      <div style={{ color, fontWeight: 700, borderBottom: '1px solid #252D3D', paddingBottom: 3, marginBottom: 4 }}>
        {title}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#475569' }}>{r.label}</span>
          <span style={{ color: r.col ?? '#E2E8F0' }}>{r.value}</span>
        </div>
      ))}
    </div>
  </Html>
);

// ─── AXIAL PISTON PUMP ───────────────────────────────────────────────────────

function AxialPistonPump({ pos, health, rpm, ps1 }: {
  pos: [number, number, number]; health: number; rpm: number; ps1: number;
}) {
  const shaftRef = useRef<THREE.Mesh>(null!);
  const bodyRef  = useRef<THREE.Group>(null!);
  const smoothRpm = useRef(0);
  const col = hcol(health);
  const crit = health < 40;

  // 9 bolt positions on flange
  const bolts = useMemo(() =>
    Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return [Math.cos(a) * 0.52, Math.sin(a) * 0.52] as [number, number];
    }), []);

  // Port SAE flanges
  const ports: Array<[number, number, number]> = useMemo(() => [
    [0.52, -0.2, 0],   // suction
    [-0.52, 0.25, 0],  // discharge
  ], []);

  useFrame(({ clock }, dt) => {
    smoothRpm.current += (rpm - smoothRpm.current) * dt * 1.8;
    shaftRef.current.rotation.z += (smoothRpm.current * Math.PI * 2 / 60) * dt;

    // Micro-vibration from VS1 proxy
    const vibAmp = crit ? 0.0025 : health < 75 ? 0.001 : 0.0003;
    bodyRef.current.position.y = Math.sin(clock.getElapsedTime() * 180) * vibAmp;
  });

  return (
    <group position={pos}>
      <group ref={bodyRef}>
        {/* Cast-iron barrel */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.48, 0.52, 1.35, 24]} />
          <meshStandardMaterial color={crit ? '#2e1010' : '#252525'}
            metalness={0.55} roughness={0.88}
            emissive={crit ? '#3a0808' : '#000'} emissiveIntensity={crit ? 0.4 : 0} />
        </mesh>
        {/* Machined front flange */}
        <mesh position={[0, 0.74, 0]} castShadow>
          <cylinderGeometry args={[0.54, 0.54, 0.1, 24]} />
          <meshStandardMaterial color="#909090" metalness={0.96} roughness={0.12} />
        </mesh>
        {/* Rear end cap */}
        <mesh position={[0, -0.74, 0]} castShadow>
          <cylinderGeometry args={[0.54, 0.54, 0.1, 24]} />
          <meshStandardMaterial color="#808080" metalness={0.94} roughness={0.15} />
        </mesh>
        {/* Drive shaft */}
        <mesh ref={shaftRef} position={[0, 0.88, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.075, 0.32, 16]} />
          <meshStandardMaterial color="#d0d0d0" metalness={0.99} roughness={0.04} />
        </mesh>
        {/* Shaft coupling hex */}
        <mesh position={[0, 1.05, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.105, 0.07, 6]} />
          <meshStandardMaterial color="#bbb" metalness={0.97} roughness={0.08} />
        </mesh>
        {/* Port connections */}
        {ports.map(([x, y, z], i) => (
          <group key={i} position={[x, y, z]}>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.072, 0.072, 0.28, 12]} />
              <meshStandardMaterial color="#686868" metalness={0.86} roughness={0.3} />
            </mesh>
            <mesh position={[x > 0 ? 0.16 : -0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.112, 0.112, 0.035, 12]} />
              <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
        {/* Bolt ring — instanced individually for visual detail */}
        {bolts.map(([bx, bz], i) => (
          <mesh key={i} position={[bx, 0.8, bz]} castShadow>
            <cylinderGeometry args={[0.019, 0.019, 0.055, 6]} />
            <meshStandardMaterial color="#555" metalness={0.9} roughness={0.3} />
          </mesh>
        ))}
        {/* Health status LED ring */}
        <mesh position={[0, 0, 0.505]}>
          <torusGeometry args={[0.49, 0.016, 6, 32]} />
          <meshStandardMaterial color={col} emissive={col}
            emissiveIntensity={crit ? 3.0 : 1.4} transparent opacity={0.95} />
        </mesh>
        {/* Nameplate */}
        <mesh position={[0, 0, 0.5]} castShadow>
          <boxGeometry args={[0.22, 0.07, 0.005]} />
          <meshStandardMaterial color="#1a1a2a" metalness={0.3} roughness={0.7} />
        </mesh>
      </group>
      <SensorTag
        pos={[0, 1.6, 0.6]}
        title="AXIAL PISTON PUMP"
        color={col}
        rows={[
          { label: 'HEALTH', value: `${Math.round(health)}/100`, col },
          { label: 'RPM', value: `${Math.round(rpm)}`, col: '#3B82F6' },
          { label: 'PS1', value: `${ps1?.toFixed(1)} bar`, col: ps1 > 190 ? '#EF4444' : '#22C55E' },
          { label: 'STATUS', value: crit ? 'CRITICAL' : health < 75 ? 'CAUTION' : 'NOMINAL', col },
        ]}
      />
    </group>
  );
}

// ─── BLADDER ACCUMULATOR ─────────────────────────────────────────────────────

function BladderAccumulator({ pos, health, ps4 }: {
  pos: [number, number, number]; health: number; ps4: number;
}) {
  const fluidRef  = useRef<THREE.Mesh>(null!);
  const fillSmooth = useRef(0.5);
  const col = hcol(health);
  const crit = health < 40;
  const fillTarget = THREE.MathUtils.clamp(ps4 / 20, 0, 1);

  // Domed shell profile via LatheGeometry
  const shellPts = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.sin(t) * 0.34, -0.72 + Math.cos(t) * 0.22));
    }
    pts.push(new THREE.Vector2(0.34, 0.5));
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(t) * 0.34, 0.5 + Math.sin(t) * 0.22));
    }
    return pts;
  }, []);

  useFrame((_, dt) => {
    fillSmooth.current += (fillTarget - fillSmooth.current) * dt * 1.8;
    const fh = fillSmooth.current;
    fluidRef.current.scale.y = Math.max(0.01, fh * 1.15);
    fluidRef.current.position.y = pos[1] - 0.55 + fh * 0.58;
  });

  return (
    <group>
      {/* Outer pressure vessel shell */}
      <mesh position={pos} castShadow receiveShadow>
        <latheGeometry args={[shellPts, 24]} />
        <meshStandardMaterial color={crit ? '#3a1515' : '#464655'}
          metalness={0.8} roughness={0.28}
          emissive={crit ? '#250505' : '#000'} emissiveIntensity={crit ? 0.5 : 0} />
      </mesh>
      {/* Weld seam */}
      <mesh position={[pos[0], pos[1] - 0.22, pos[2]]}>
        <torusGeometry args={[0.343, 0.009, 6, 28]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.55} roughness={0.8} />
      </mesh>
      {/* Top hydraulic port */}
      <mesh position={[pos[0], pos[1] + 0.83, pos[2]]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.22, 10]} />
        <meshStandardMaterial color="#777" metalness={0.86} roughness={0.25} />
      </mesh>
      <mesh position={[pos[0], pos[1] + 0.95, pos[2]]} castShadow>
        <cylinderGeometry args={[0.088, 0.088, 0.04, 10]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Bottom N₂ charging valve */}
      <mesh position={[pos[0], pos[1] - 0.98, pos[2]]} castShadow>
        <cylinderGeometry args={[0.038, 0.038, 0.1, 8]} />
        <meshStandardMaterial color="#aaa" metalness={0.92} roughness={0.15} />
      </mesh>
      {/* Pressure gauge stub */}
      <mesh position={[pos[0] + 0.36, pos[1] + 0.08, pos[2]]}
        rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.078, 0.078, 0.07, 12]} />
        <meshStandardMaterial color="#b0b0b0" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Internal hydraulic oil */}
      <mesh ref={fluidRef} position={[pos[0], pos[1] - 0.55, pos[2]]}>
        <cylinderGeometry args={[0.315, 0.315, 1.1, 18]} />
        <meshStandardMaterial color="#2c1e00" transparent opacity={0.82}
          metalness={0.05} roughness={0.9}
          emissive="#110c00" emissiveIntensity={0.15} />
      </mesh>
      {/* Health ring */}
      <mesh position={[pos[0], pos[1] + 0.52, pos[2]]}>
        <torusGeometry args={[0.347, 0.014, 6, 28]} />
        <meshStandardMaterial color={col} emissive={col}
          emissiveIntensity={crit ? 2.5 : 1.1} />
      </mesh>
      <SensorTag
        pos={[pos[0] + 0.65, pos[1] + 1.1, pos[2]]}
        title="BLADDER ACCUMULATOR"
        color={col}
        rows={[
          { label: 'HEALTH', value: `${Math.round(health)}/100`, col },
          { label: 'PS4', value: `${ps4?.toFixed(2)} bar`, col: ps4 < 5 ? '#EF4444' : '#22C55E' },
          { label: 'FILL', value: `${Math.round(fillSmooth.current * 100)}%`, col: '#06B6D4' },
          { label: 'N₂ PRE-CHG', value: '10 bar', col: '#94A3B8' },
        ]}
      />
    </group>
  );
}

// ─── PROPORTIONAL DIRECTIONAL VALVE ──────────────────────────────────────────

function DirectionalValve({ pos, health, fs1, ps2 }: {
  pos: [number, number, number]; health: number; fs1: number; ps2: number;
}) {
  const actuatorRef = useRef<THREE.Group>(null!);
  const indicatorRef = useRef<THREE.Mesh>(null!);
  const smoothTravel = useRef(0);
  const col = hcol(health);
  const crit = health < 40;
  const travelTarget = 1 - health / 100;

  // Copper coil rings (14 per solenoid)
  const coilRings = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => -0.26 + i * 0.038), []);

  useFrame((_, dt) => {
    smoothTravel.current += (travelTarget - smoothTravel.current) * dt * 1.5;
    actuatorRef.current.position.x = smoothTravel.current * 0.038;
    indicatorRef.current.position.x = pos[0] + smoothTravel.current * 0.1 - 0.05;
  });

  return (
    <group position={pos}>
      {/* Manifold block */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.25, 0.3, 0.38]} />
        <meshStandardMaterial color={crit ? '#2e1010' : '#36364a'}
          metalness={0.77} roughness={0.38}
          emissive={crit ? '#1e0808' : '#000'} emissiveIntensity={crit ? 0.35 : 0} />
      </mesh>
      {/* Left solenoid body */}
      <mesh position={[-0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.46, 16]} />
        <meshStandardMaterial color="#252535" metalness={0.5} roughness={0.62} />
      </mesh>
      {/* Right solenoid body */}
      <mesh position={[0.78, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.46, 16]} />
        <meshStandardMaterial color="#252535" metalness={0.5} roughness={0.62} />
      </mesh>
      {/* Copper winding — left */}
      {coilRings.map((x, i) => (
        <mesh key={i} position={[x - 0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.085, 0.009, 6, 12]} />
          <meshStandardMaterial color="#b87333" metalness={0.82} roughness={0.28} />
        </mesh>
      ))}
      {/* Copper winding — right */}
      {coilRings.map((x, i) => (
        <mesh key={i + 20} position={[x + 0.75, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.085, 0.009, 6, 12]} />
          <meshStandardMaterial color="#b87333" metalness={0.82} roughness={0.28} />
        </mesh>
      ))}
      {/* Animated actuator assembly */}
      <group ref={actuatorRef}>
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.062, 0.062, 0.78, 14]} />
          <meshStandardMaterial color="#909090" metalness={0.92} roughness={0.18} />
        </mesh>
      </group>
      {/* Port connections: P, T, A, B */}
      {([[-0.25, -0.185, 0], [0, -0.185, 0], [0.25, -0.185, 0], [0.5, -0.185, 0]] as [number,number,number][]).map((p, i) => (
        <group key={i} position={p}>
          <mesh castShadow>
            <cylinderGeometry args={[0.038, 0.038, 0.14, 8]} />
            <meshStandardMaterial color="#767676" metalness={0.85} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.086, 0]} castShadow>
            <cylinderGeometry args={[0.065, 0.065, 0.028, 8]} />
            <meshStandardMaterial color="#888" metalness={0.88} roughness={0.25} />
          </mesh>
        </group>
      ))}
      {/* Spool position indicator (animated) */}
      <mesh ref={indicatorRef} position={[pos[0], 0.185, 0]}>
        <boxGeometry args={[0.072, 0.048, 0.055]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.2} />
      </mesh>
      {/* Status LED */}
      <mesh position={[0.52, 0.17, 0]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial
          color={fs1 > 8 ? '#22C55E' : '#F59E0B'}
          emissive={fs1 > 8 ? '#22C55E' : '#F59E0B'} emissiveIntensity={2.5} />
      </mesh>
      <SensorTag
        pos={[0, 0.55, 0.3]}
        title="4/3 PROPORTIONAL VALVE"
        color={col}
        rows={[
          { label: 'HEALTH', value: `${Math.round(health)}/100`, col },
          { label: 'FS1', value: `${fs1?.toFixed(1)} l/m`, col: fs1 < 7 ? '#EF4444' : '#22C55E' },
          { label: 'PS2', value: `${ps2?.toFixed(1)} bar`, col: ps2 < 90 ? '#EF4444' : '#22C55E' },
          { label: 'SPOOL', value: `${Math.round(smoothTravel.current * 100)}%`, col: '#8B5CF6' },
        ]}
      />
    </group>
  );
}

// ─── PLATE HEAT EXCHANGER ────────────────────────────────────────────────────

function PlateHeatExchanger({ pos, health, ts1, ce }: {
  pos: [number, number, number]; health: number; ts1: number; ce: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const col = hcol(health);
  const crit = health < 40;
  const tempNorm = THREE.MathUtils.clamp((ts1 - 35) / 55, 0, 1);

  const emissiveCol = useMemo(() => new THREE.Color().lerpColors(
    new THREE.Color(0x000000), new THREE.Color(0xff4400), tempNorm
  ), [tempNorm]);

  useFrame(({ clock }, dt) => {
    // Thermal expansion at high temperature
    if (ts1 > 65) {
      const exp = 1 + Math.sin(clock.getElapsedTime() * 2.5) * 0.0018 * tempNorm;
      groupRef.current.scale.set(exp, 1, exp);
    }
  });

  const plates = useMemo(() => Array.from({ length: 14 }, (_, i) => -0.58 + (i / 13) * 1.16), []);

  return (
    <group ref={groupRef} position={pos}>
      {/* End frames */}
      {([-0.72, 0.72] as number[]).map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.11, 0.52, 0.4]} />
          <meshStandardMaterial color="#555" metalness={0.8} roughness={0.42} />
        </mesh>
      ))}
      {/* Tie rods */}
      {([[-0.14, -0.14],[-0.14,0.14],[0.14,-0.14],[0.14,0.14]] as [number,number][]).map(([y, z], i) => (
        <mesh key={i} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 1.32, 6]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
      {/* Corrugated plate stack */}
      {plates.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.04, 0.44, 0.34]} />
          <meshStandardMaterial color="#9a8a78" metalness={0.86} roughness={0.18}
            emissive={emissiveCol} emissiveIntensity={tempNorm * 0.9} />
        </mesh>
      ))}
      {/* 4 port connections (oil in/out, coolant in/out) */}
      {([[-0.68, 0.18, 0],[-0.68,-0.18,0],[0.68, 0.18, 0],[0.68,-0.18,0]] as [number,number,number][]).map((p, i) => (
        <group key={i} position={p}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.048, 0.048, 0.2, 10]} />
            <meshStandardMaterial color="#777" metalness={0.86} roughness={0.3} />
          </mesh>
          <mesh position={[p[0] < 0 ? -0.11 : 0.11, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.078, 0.078, 0.032, 10]} />
            <meshStandardMaterial color="#888" metalness={0.9} roughness={0.22} />
          </mesh>
        </group>
      ))}
      {/* Thermal LED strip */}
      <mesh position={[0, 0.285, 0]}>
        <boxGeometry args={[1.0, 0.018, 0.055]} />
        <meshStandardMaterial
          color={ts1 > 75 ? '#EF4444' : ts1 > 58 ? '#F59E0B' : '#22C55E'}
          emissive={ts1 > 75 ? '#EF4444' : ts1 > 58 ? '#F59E0B' : '#22C55E'}
          emissiveIntensity={1.8} />
      </mesh>
      <SensorTag
        pos={[0, 0.7, 0.28]}
        title="PLATE HEAT EXCHANGER"
        color={col}
        rows={[
          { label: 'HEALTH', value: `${Math.round(health)}/100`, col },
          { label: 'TS1', value: `${ts1?.toFixed(1)} °C`, col: ts1 > 75 ? '#EF4444' : '#22C55E' },
          { label: 'COOL EFF', value: `${ce?.toFixed(0)} %`, col: ce < 88 ? '#F59E0B' : '#06B6D4' },
          { label: 'DUTY', value: tempNorm > 0.5 ? 'HIGH LOAD' : 'NOMINAL', col: tempNorm > 0.5 ? '#F59E0B' : '#22C55E' },
        ]}
      />
    </group>
  );
}

// ─── HYDRAULIC RESERVOIR ─────────────────────────────────────────────────────

function HydraulicReservoir({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* Main tank */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.92, 1.25]} />
        <meshStandardMaterial color="#1e2e1e" metalness={0.6} roughness={0.52} />
      </mesh>
      {/* Top lid with weld bead */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <boxGeometry args={[1.87, 0.038, 1.27]} />
        <meshStandardMaterial color="#2a3a2a" metalness={0.7} roughness={0.42} />
      </mesh>
      {/* Filler / breather assembly */}
      <mesh position={[0.55, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.068, 0.068, 0.14, 12]} />
        <meshStandardMaterial color="#bbb" metalness={0.82} roughness={0.28} />
      </mesh>
      <mesh position={[0.55, 0.67, 0]} castShadow>
        <cylinderGeometry args={[0.088, 0.088, 0.04, 12]} />
        <meshStandardMaterial color="#999" metalness={0.78} roughness={0.35} />
      </mesh>
      {/* Return-line filter canister */}
      <mesh position={[-0.55, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.085, 0.3, 12]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.5} />
      </mesh>
      {/* Sight glass (translucent) */}
      <mesh position={[0.94, 0, 0]} castShadow>
        <boxGeometry args={[0.038, 0.52, 0.11]} />
        <meshStandardMaterial color="#3a6a3a" metalness={0.05} roughness={0.04}
          transparent opacity={0.32} envMapIntensity={2.0} />
      </mesh>
      <mesh position={[0.94, 0.3, 0]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.13]} />
        <meshStandardMaterial color="#888" metalness={0.86} roughness={0.28} />
      </mesh>
      <mesh position={[0.94, -0.3, 0]} castShadow>
        <boxGeometry args={[0.06, 0.04, 0.13]} />
        <meshStandardMaterial color="#888" metalness={0.86} roughness={0.28} />
      </mesh>
      {/* Oil volume */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[1.79, 0.76, 1.19]} />
        <meshStandardMaterial color="#2c1e00" transparent opacity={0.72}
          metalness={0.0} roughness={0.92} />
      </mesh>
      {/* Suction port */}
      <mesh position={[-0.94, -0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.072, 0.072, 0.22, 10]} />
        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.36} />
      </mesh>
      {/* Return port */}
      <mesh position={[0, 0.48, 0.35]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.2, 10]} />
        <meshStandardMaterial color="#666" metalness={0.8} roughness={0.36} />
      </mesh>
      {/* Drain plug */}
      <mesh position={[0, -0.48, -0.5]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
        <meshStandardMaterial color="#aaa" metalness={0.88} roughness={0.22} />
      </mesh>
      {/* Support legs */}
      {([[-0.78,-0.58],[-0.78,0.58],[0.78,-0.58],[0.78,0.58]] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} position={[x, -0.64, z]} castShadow>
          <boxGeometry args={[0.075, 0.32, 0.075]} />
          <meshStandardMaterial color="#222" metalness={0.62} roughness={0.65} />
        </mesh>
      ))}
      <SensorTag
        pos={[0, 0.9, 0.75]}
        title="HYDRAULIC RESERVOIR"
        color="#22C55E"
        rows={[
          { label: 'OIL LEVEL', value: '94 %', col: '#06B6D4' },
          { label: 'CAPACITY', value: '120 L', col: '#94A3B8' },
          { label: 'OIL TEMP', value: '38.0 °C', col: '#22C55E' },
          { label: 'FILTER ΔP', value: '0.8 bar', col: '#22C55E' },
        ]}
      />
    </group>
  );
}

// ─── ANIMATED PIPE NETWORK ───────────────────────────────────────────────────

function PipeNetwork({ sensors }: { sensors: any }) {
  const matRefs = useRef<(THREE.ShaderMaterial | null)[]>([]);

  const fs1  = sensors?.FS1  ?? 11.4;
  const fs2  = sensors?.FS2  ?? 8.9;
  const ps1  = sensors?.PS1  ?? 152;
  const ps2  = sensors?.PS2  ?? 132;
  const ps3  = sensors?.PS3  ?? 2.8;

  const pipes = useMemo(() => [
    // 0 — Reservoir → Pump (suction, low pressure, dark)
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.45, -0.58, 0.3),
        new THREE.Vector3(-3.0, -0.75, 0),
        new THREE.Vector3(-2.35, -0.72, 0),
      ]),
      flow: fs1 / 25, pressure: 0.08, radius: 0.048,
      lowCol: new THREE.Color(0.04, 0.04, 0.08),
      highCol: new THREE.Color(0.1, 0.2, 0.5),
    },
    // 1 — Pump → Accumulator (high-pressure delivery)
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.2, -0.22, 0),
        new THREE.Vector3(-1.6, 0.4, -0.8),
        new THREE.Vector3(-0.6, 0.85, -1.2),
        new THREE.Vector3(0, 1.0, -1.2),
      ]),
      flow: fs1 / 25, pressure: ps1 / 250, radius: 0.038,
      lowCol: new THREE.Color(0.0, 0.08, 0.35),
      highCol: new THREE.Color(0.1, 0.55, 1.0),
    },
    // 2 — Accumulator → Valve (high pressure)
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.1, 0.85, -1.2),
        new THREE.Vector3(0.8, 0.55, -0.6),
        new THREE.Vector3(1.5, 0.08, -0.2),
        new THREE.Vector3(1.88, 0, 0),
      ]),
      flow: fs1 / 25, pressure: ps2 / 200, radius: 0.038,
      lowCol: new THREE.Color(0.0, 0.08, 0.35),
      highCol: new THREE.Color(0.1, 0.55, 1.0),
    },
    // 3 — Valve → Heat Exchanger (medium pressure)
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.52, 0.0, 0),
        new THREE.Vector3(2.75, 0.28, 0.5),
        new THREE.Vector3(2.9, 0.4, 0.85),
        new THREE.Vector3(2.65, 0.42, 1.1),
      ]),
      flow: fs2 / 20, pressure: ps3 / 10, radius: 0.04,
      lowCol: new THREE.Color(0.04, 0.12, 0.04),
      highCol: new THREE.Color(0.15, 0.7, 0.2),
    },
    // 4 — Heat Exchanger → Reservoir (return line, low pressure)
    {
      curve: new THREE.CatmullRomCurve3([
        new THREE.Vector3(2.4, 0.3, 1.15),
        new THREE.Vector3(1.5, 0.22, 1.55),
        new THREE.Vector3(0, 0.18, 1.7),
        new THREE.Vector3(-1.8, 0.1, 1.4),
        new THREE.Vector3(-2.8, 0.1, 0.85),
        new THREE.Vector3(-3.1, 0.18, 0.5),
      ]),
      flow: fs2 / 20, pressure: 0.06, radius: 0.048,
      lowCol: new THREE.Color(0.06, 0.04, 0.0),
      highCol: new THREE.Color(0.45, 0.28, 0.05),
    },
  ], [fs1, fs2, ps1, ps2, ps3]);

  const geometries = useMemo(() =>
    pipes.map(p => new THREE.TubeGeometry(p.curve, 56, p.radius, 8, false))
  , [pipes]);

  useFrame(({ clock }) => {
    matRefs.current.forEach((mat, i) => {
      if (!mat) return;
      mat.uniforms.uTime.value   = clock.getElapsedTime();
      mat.uniforms.uFlow.value   = pipes[i]?.flow      ?? 0.5;
      mat.uniforms.uPressure.value = pipes[i]?.pressure ?? 0.3;
      mat.uniforms.uLowCol.value   = pipes[i]?.lowCol   ?? new THREE.Color(0, 0.1, 0.4);
      mat.uniforms.uHighCol.value  = pipes[i]?.highCol  ?? new THREE.Color(0.1, 0.5, 1.0);
    });
  });

  return (
    <group>
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <shaderMaterial
            ref={el => { matRefs.current[i] = el; }}
            vertexShader={PIPE_VERT}
            fragmentShader={PIPE_FRAG}
            transparent depthWrite={false} side={THREE.DoubleSide}
            uniforms={{
              uTime:     { value: 0 },
              uFlow:     { value: pipes[i]?.flow ?? 0.5 },
              uPressure: { value: pipes[i]?.pressure ?? 0.3 },
              uLowCol:   { value: pipes[i]?.lowCol ?? new THREE.Color(0, 0.1, 0.4) },
              uHighCol:  { value: pipes[i]?.highCol ?? new THREE.Color(0.1, 0.5, 1.0) },
              uOpacity:  { value: 0.84 },
            }}
          />
        </mesh>
      ))}
      {/* SAE flange rings at pipe endpoints */}
      {pipes.flatMap((p, pi) =>
        [0, 0.5, 1].map(t => {
          const pt = p.curve.getPoint(t);
          return (
            <mesh key={`flg-${pi}-${t}`} position={pt.toArray() as [number,number,number]}
              castShadow>
              <torusGeometry args={[p.radius + 0.02, 0.016, 6, 14]} />
              <meshStandardMaterial color="#777" metalness={0.88} roughness={0.28} />
            </mesh>
          );
        })
      )}
    </group>
  );
}

// ─── STRUCTURAL BASE FRAME ───────────────────────────────────────────────────

function BaseFrame() {
  const beams: Array<[[number,number,number],[number,number,number],[number,number,number]]> = [
    [[0, -1.05, 0], [9.5, 0.06, 0.09], [0,0,0]],      // main X rail
    [[0, -1.05, 0], [0.06, 0.06, 4.5], [0,0,0]],       // main Z rail
  ];
  return (
    <group>
      {/* Drip tray / skid base */}
      <mesh position={[0, -1.1, 0.4]} receiveShadow>
        <boxGeometry args={[9.8, 0.06, 4.8]} />
        <meshStandardMaterial color="#1a1e28" metalness={0.5} roughness={0.65} />
      </mesh>
      {/* Corner legs */}
      {([[-4.5,-1.5,-1.8],[-4.5,-1.5,2.6],[4.5,-1.5,-1.8],[4.5,-1.5,2.6]] as [number,number,number][]).map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.09, 0.75, 0.09]} />
          <meshStandardMaterial color="#333" metalness={0.7} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}

// ─── MAIN SCENE ─────────────────────────────────────────────────────────────

function HydraulicScene() {
  const { isRunning, telemetry, scenario } = useSimulationStore();
  const health  = telemetry?.scadaHealth;
  const sensors = telemetry?.scadaSensors;

  const ph = health?.pump        ?? 100;
  const vh = health?.valve       ?? 100;
  const ch = health?.cooler      ?? 100;
  const ah = health?.accumulator ?? 100;

  return (
    <>
      {/* ── Lighting ── */}
      <Environment preset="warehouse" environmentIntensity={0.55} />
      <Lightformer
        form="rect" intensity={3.5} color="#fff8f0"
        scale={[12, 0.6, 1]} position={[0, 4.5, 0]} rotation={[-Math.PI / 2, 0, 0]}
      />
      <Lightformer
        form="rect" intensity={1.2} color="#e8f4ff"
        scale={[4, 3, 1]} position={[-6, 2, -2]} rotation={[0, Math.PI / 2, 0]}
      />
      <ambientLight intensity={0.18} />

      {/* ── Shadows ── */}
      <AccumulativeShadows position={[0, -1.07, 0.4]} temporal frames={60}
        scale={18} alphaTest={0.8} color="#0a0d16">
        <RandomizedLight amount={6} radius={4} position={[4, 6, -2]} />
      </AccumulativeShadows>

      {/* ── Reflective floor ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0.4]} receiveShadow>
        <planeGeometry args={[22, 12]} />
        <MeshReflectorMaterial
          blur={[400, 100]} resolution={512} mixBlur={1.0}
          mixStrength={12} roughness={0.88} depthScale={1.2}
          minDepthThreshold={0.4} maxDepthThreshold={1.4}
          color="#0e1117" metalness={0.5}
          mirror={0.35}
        />
      </mesh>

      {/* ── Grid overlay ── */}
      <Grid
        position={[0, -1.105, 0.4]}
        args={[22, 12]}
        cellSize={0.5}
        cellThickness={0.4}
        cellColor="#1a2035"
        sectionSize={2}
        sectionThickness={0.8}
        sectionColor="#1e2d50"
        fadeDistance={22}
        fadeStrength={1.2}
        infiniteGrid
      />

      {/* ── Structural base ── */}
      <BaseFrame />

      {/* ── Components ── */}
      <AxialPistonPump
        pos={[-2.2, -0.3, 0]}
        health={ph}
        rpm={sensors?.EPS1 ? sensors.EPS1 / 1.1 : 2180}
        ps1={sensors?.PS1 ?? 152}
      />
      <BladderAccumulator
        pos={[0, 0.85, -1.2]}
        health={ah}
        ps4={sensors?.PS4 ?? 8.1}
      />
      <DirectionalValve
        pos={[2.2, -0.25, 0]}
        health={vh}
        fs1={sensors?.FS1 ?? 11.4}
        ps2={sensors?.PS2 ?? 132}
      />
      <PlateHeatExchanger
        pos={[2.7, 0.35, 1.1]}
        health={ch}
        ts1={sensors?.TS1 ?? 38}
        ce={sensors?.CE ?? 96}
      />
      <HydraulicReservoir pos={[-3.5, -0.55, 0.5]} />

      {/* ── Animated pipes ── */}
      <PipeNetwork sensors={sensors} />

      {/* ── Status banner ── */}
      <Html position={[-4.2, 1.8, -1]} distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(14,17,23,0.88)',
          border: '1px solid #252D3D',
          borderRadius: 6,
          padding: '8px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: '#E2E8F0',
          whiteSpace: 'nowrap',
          minWidth: 160,
        }}>
          <div style={{ color: '#3B82F6', fontWeight: 700, marginBottom: 4, letterSpacing: '0.08em' }}>
            HYDROSENSE AI — DIGITAL TWIN
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%',
              background: isRunning ? '#22C55E' : '#F59E0B',
              boxShadow: `0 0 8px ${isRunning ? '#22C55E' : '#F59E0B'}` }} />
            <span style={{ color: isRunning ? '#22C55E' : '#F59E0B', fontSize: 10 }}>
              {isRunning ? 'LIVE TELEMETRY' : 'SIMULATION PAUSED'}
            </span>
          </div>
          <div style={{ marginTop: 6, color: '#475569', fontSize: 9 }}>
            SCENARIO: <span style={{ color: '#8B5CF6' }}>{scenario.toUpperCase()}</span>
          </div>
        </div>
      </Html>
    </>
  );
}

// ─── ROOT EXPORT ─────────────────────────────────────────────────────────────

export default function DigitalTwin() {
  const { isRunning, telemetry, scenario } = useSimulationStore();
  const [dpr, setDpr] = useState<[number, number]>([1, 1.8]);
  const scadaSensors = telemetry?.scadaSensors;
  const scadaHealth  = telemetry?.scadaHealth;

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0E1117', position: 'relative', overflow: 'hidden' }}>

      {/* ── Header overlay ── */}
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10, pointerEvents: 'none',
        background: 'rgba(14,17,23,0.88)',
        border: '1px solid #252D3D',
        borderRadius: 8, padding: '10px 18px',
        fontFamily: 'var(--font-mono)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: 16, letterSpacing: '0.1em' }}>
          3D DIGITAL TWIN VISUALISATION PROTOTYPE
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%',
            background: isRunning ? '#22C55E' : '#F59E0B',
            boxShadow: `0 0 8px ${isRunning ? '#22C55E' : '#F59E0B'}` }} />
          <span style={{ fontSize: 10, color: isRunning ? '#22C55E' : '#F59E0B' }}>
            {isRunning ? '● LIVE TELEMETRY STREAM' : '● SIMULATION PAUSED'}
          </span>
        </div>
        <div style={{ marginTop: 4, fontSize: 9, color: '#475569' }}>
          ISA-101 · ISO 1219 · IEC 61511 ALIGNED
        </div>
      </div>

      {/* ── 2D P&ID schematic overlay ── */}
      <div style={{
        position: 'absolute', bottom: 18, right: 18, zIndex: 10,
        width: 380, background: 'rgba(14,17,23,0.9)',
        border: '1px solid #252D3D', borderRadius: 8, padding: 10,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.1em' }}>
            P&ID SCHEMATIC OVERLAY
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3B82F6' }}>
            ISO 1219
          </span>
        </div>
        {scadaSensors && scadaHealth
          ? <ScadaPID sensors={scadaSensors} health={scadaHealth} scenarioKey={scenario} />
          : (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#475569' }}>
              AWAITING TELEMETRY…
            </div>
          )
        }
      </div>

      {/* ── Controls hint ── */}
      <div style={{
        position: 'absolute', bottom: 18, left: 18, zIndex: 10, pointerEvents: 'none',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2E3A50',
      }}>
        ORBIT: Left Drag  ·  PAN: Right Drag  ·  ZOOM: Scroll
      </div>

      {/* ── Three.js Canvas ── */}
      <Canvas
        shadows="soft"
        dpr={dpr}
        camera={{ position: [5, 3.5, 6.5], fov: 42 }}
        gl={{ powerPreference: 'high-performance', antialias: false, alpha: false, stencil: false }}
      >
        <PerformanceMonitor
          onIncline={() => setDpr([1, 2])}
          onDecline={() => setDpr([1, 1.2])}
        >
          <Suspense fallback={null}>
            <HydraulicScene />

            {/* ── Post-processing ── */}
            <EffectComposer multisampling={0}>
              <Bloom
                luminanceThreshold={0.55}
                luminanceSmoothing={0.7}
                intensity={1.1}
                radius={0.6}
                mipmapBlur
              />
              <ChromaticAberration
                blendFunction={BlendFunction.NORMAL}
                offset={[0.0004, 0.0004] as unknown as [number, number]}
                radialModulation={false}
                modulationOffset={0.5}
              />
              <Vignette offset={0.32} darkness={0.62} blendFunction={BlendFunction.NORMAL} />
              <SMAA />
            </EffectComposer>
          </Suspense>

          <OrbitControls
            makeDefault
            maxPolarAngle={Math.PI / 2 - 0.04}
            minDistance={3}
            maxDistance={18}
            target={[0, 0, 0]}
          />
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}
