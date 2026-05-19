/**
 * Mock telemetry generator for when MQTT live stream is unavailable.
 * Provides scenario-aware mock data that components can use as a fallback.
 * Includes the 17-channel SCADA sensor array for the ISA-101 interface.
 */

import { TelemetryData, RULData, XAIData, ScadaSensors, ScadaHealth } from '@/lib/store';

// SCADA BASELINES
const BASELINE: ScadaSensors = {
  PS1:152, PS2:132, PS3:2.8, PS4:8.1, PS5:8.7, PS6:153,
  EPS1:2180, FS1:11.4, FS2:8.9,
  TS1:38, TS2:42, TS3:40, TS4:34,
  VS1:0.45, CE:96, CP:1.75, SE:95,
};

// ... SCENARIOS ...
const SCENARIOS: Record<string, { health: ScadaHealth, delta: Partial<ScadaSensors> }> = {
  'optimal':           { health: {cooler:100,valve:100,pump:100,accumulator:100}, delta: {} },
  'pump-leak':         { health: {cooler:100,valve:100,pump:10,accumulator:100},  delta: {PS1:-33,FS1:-3.2,EPS1:+420,SE:-20,VS1:+0.9,PS6:-20} },
  'valve-degrade':     { health: {cooler:100,valve:10,pump:100,accumulator:100},  delta: {PS2:-38,PS3:+2.2,FS1:-3.5,FS2:-1.8,PS4:-1.5} },
  'accumulator-fail':  { health: {cooler:100,valve:100,pump:100,accumulator:10},  delta: {PS4:-5.2,PS5:-4.8,VS1:+0.35,PS3:+0.4} },
};

const noise = (amp=1) => (Math.random()-0.5)*2*amp;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function computeSensors(scenarioKey: string, t: number): ScadaSensors {
  const sc = SCENARIOS[scenarioKey] || SCENARIOS['optimal'];
  const out = {} as ScadaSensors;
  
  // Define mins/maxes for clamping
  const SENSORS: Record<string, {min:number, max:number, type: string, normal: [number, number]}> = {
    PS1: { type:'pressure', min:0,   max:250, normal:[140,165] },
    PS2: { type:'pressure', min:0,   max:200, normal:[120,145] },
    PS3: { type:'pressure', min:0,   max:10,  normal:[2,4]     },
    PS4: { type:'pressure', min:0,   max:20,  normal:[7,9]     },
    PS5: { type:'pressure', min:0,   max:20,  normal:[8,10]    },
    PS6: { type:'pressure', min:0,   max:250, normal:[140,165] },
    EPS1:{ type:'power',    min:0,   max:4000,normal:[2000,2400]},
    FS1: { type:'flow',     min:0,   max:25,  normal:[10,13]   },
    FS2: { type:'flow',     min:0,   max:20,  normal:[8,10]    },
    TS1: { type:'temp',     min:20,  max:90,  normal:[35,42]   },
    TS2: { type:'temp',     min:20,  max:90,  normal:[38,46]   },
    TS3: { type:'temp',     min:20,  max:90,  normal:[36,44]   },
    TS4: { type:'temp',     min:20,  max:80,  normal:[30,38]   },
    VS1: { type:'vibration',min:0,   max:3,   normal:[0.2,0.7] },
    CE:  { type:'efficiency',min:0,  max:100, normal:[90,100]  },
    CP:  { type:'cooling',  min:0,   max:5,   normal:[1.5,2.0] },
    SE:  { type:'efficiency',min:0,  max:100, normal:[88,98]   },
  };

  for (const [key, base] of Object.entries(BASELINE)) {
    const k = key as keyof ScadaSensors;
    // Transition smoothly based on tick count (simulated)
    const targetDelta = sc.delta[k] || 0;
    
    // Simulate a gradual ramp to the target delta
    const currentDelta = targetDelta * Math.min(t / 150, 1);
    
    const S = SENSORS[k];
    const noiseAmp = (S.normal[1]-S.normal[0])*0.04;
    
    // Add slight sinusoidal oscillation (pump rotation effect on pressure)
    const osc = S.type === 'pressure' ? Math.sin(t/10)*1.5 : 0;
    out[k] = clamp(base + currentDelta + noise(noiseAmp) + osc, S.min, S.max);
  }
  return out;
}

function computeRUL(ahi: number): RULData {
  if (ahi >= 90) return { value: 10000, unit: 'hrs', label: '>10,000 hrs' };
  if (ahi >= 75) return { value: 720, unit: 'hrs', label: '~720 hrs (30 days)' };
  if (ahi >= 60) return { value: 168, unit: 'hrs', label: '~168 hrs (7 days)' };
  if (ahi >= 45) return { value: 48, unit: 'hrs', label: '~48 hrs' };
  if (ahi >= 30) return { value: 12, unit: 'hrs', label: '~12 hrs' };
  return { value: 2, unit: 'hrs', label: 'CRITICAL: <2 hrs' };
}

export function generateMockTelemetry(scenario: string, tickCount: number): TelemetryData {
  const scadaSensors = computeSensors(scenario, tickCount);
  const targetHealth = SCENARIOS[scenario]?.health || SCENARIOS['optimal'].health;
  
  // Transition health smoothly
  const progress = Math.min(tickCount / 150, 1);
  const scadaHealth: ScadaHealth = {
    pump: 100 - (100 - targetHealth.pump) * progress + noise(1),
    valve: 100 - (100 - targetHealth.valve) * progress + noise(1),
    cooler: 100 - (100 - targetHealth.cooler) * progress + noise(1),
    accumulator: 100 - (100 - targetHealth.accumulator) * progress + noise(1),
  };
  
  // Clamp health
  scadaHealth.pump = clamp(scadaHealth.pump, 0, 100);
  scadaHealth.valve = clamp(scadaHealth.valve, 0, 100);
  scadaHealth.cooler = clamp(scadaHealth.cooler, 0, 100);
  scadaHealth.accumulator = clamp(scadaHealth.accumulator, 0, 100);

  const systemAhi = Math.round(Math.min(scadaHealth.pump, scadaHealth.valve, scadaHealth.cooler, scadaHealth.accumulator));

  const confidence = scenario === 'optimal' ? 12 : Math.round(60 + progress * 38);

  const xaiInsights: Record<string, XAIData> = {
    'optimal': {
      confidence: 12,
      rootCause: 'No anomalies detected. All parameters within nominal operating envelope.',
      affectedSensor: 'None',
      recommendation: 'Continue standard monitoring schedule.',
    },
    'pump-leak': {
      confidence,
      rootCause: `Pump RPM dropped (nominal: 2400). Flow sensor FS1 showing ${scadaSensors.FS1.toFixed(1)} l/m indicating internal fluid bypass. Pattern matches hydraulic seal degradation (ISO 4406:2021).`,
      affectedSensor: 'PS1, FS1, EPS1',
      recommendation: 'Immediate inspection of pump mechanical seals. Prepare replacement seal kit P/N HYD-SEAL-4406.',
    },
    'valve-degrade': {
      confidence,
      rootCause: `Valve pressure drop PS2 at ${scadaSensors.PS2.toFixed(1)} bar. Flow FS1 restricted. Spool erosion pattern detected per API 598.`,
      affectedSensor: 'PS2, FS1, PS3',
      recommendation: 'Schedule valve spool replacement within RUL window. Cross-reference with last maintenance log.',
    },
    'accumulator-fail': {
      confidence,
      rootCause: `Accumulator pre-charge PS4 at ${scadaSensors.PS4.toFixed(1)} bar. Nitrogen bladder integrity compromised. Failure mode per ASME PCC-2.`,
      affectedSensor: 'PS4, PS5',
      recommendation: 'Isolate accumulator. Perform nitrogen pre-charge test per OEM spec. Replace bladder if delta-P > 5 PSI.',
    },
  };

  return {
    timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    // Legacy mapping for old components
    pumpRpm: scadaSensors.EPS1 / 2, // Proxy
    coolerTemp: scadaSensors.TS1,
    valveOpen: 100, // Proxy
    accPressure: scadaSensors.PS4 * 10, // Proxy to PSI
    
    systemAhi,
    components: {
      pump: { ahi: Math.round(scadaHealth.pump), rul: computeRUL(scadaHealth.pump) },
      valve: { ahi: Math.round(scadaHealth.valve), rul: computeRUL(scadaHealth.valve) },
      cooler: { ahi: Math.round(scadaHealth.cooler), rul: computeRUL(scadaHealth.cooler) },
      accumulator: { ahi: Math.round(scadaHealth.accumulator), rul: computeRUL(scadaHealth.accumulator) },
    },
    xai: xaiInsights[scenario] || xaiInsights['optimal'],
    ahi: systemAhi,
    rul: computeRUL(systemAhi),
    
    // New SCADA ISA-101 mappings
    scadaSensors,
    scadaHealth
  };
}
