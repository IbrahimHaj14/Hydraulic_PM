import { create } from 'zustand';

export interface RULData {
  value: number;
  unit: string;
  label: string;
}

export interface XAIData {
  confidence: number;
  rootCause: string;
  affectedSensor: string;
  recommendation: string;
}

export interface ComponentHealth {
  ahi: number;
  rul: RULData;
}

export interface ComponentsData {
  pump: ComponentHealth;
  valve: ComponentHealth;
  cooler: ComponentHealth;
  accumulator: ComponentHealth;
}

export interface ScadaSensors {
  PS1: number; PS2: number; PS3: number; PS4: number; PS5: number; PS6: number;
  EPS1: number; FS1: number; FS2: number;
  TS1: number; TS2: number; TS3: number; TS4: number;
  VS1: number; CE: number; CP: number; SE: number;
}

export interface ScadaHealth {
  cooler: number;
  valve: number;
  pump: number;
  accumulator: number;
}

export interface TelemetryData {
  pumpRpm: number;
  coolerTemp: number;
  valveOpen: number;
  accPressure: number;
  timestamp: string;
  // Enterprise PdM metrics (streamed from AI engine)
  systemAhi?: number;
  components?: ComponentsData;
  ahi?: number;      // Legacy: system-level AHI
  rul?: RULData;     // Legacy: system-level RUL
  xai?: XAIData;
  
  // ISA-101 SCADA Extenstions
  scadaSensors?: ScadaSensors;
  scadaHealth?: ScadaHealth;
  
  // RCA Forecast Extensions
  forecastPumpRpm?: number;
  forecastCoolerTemp?: number;
  forecastValveOpen?: number;
  forecastAccPressure?: number;
}

export interface ScadaAlarm {
  id: number;
  time: string;
  priority: 'CRIT' | 'WARN';
  component: string;
  msg: string;
  acked: boolean;
}

export interface ScadaLog {
  id: number;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

interface SimulationState {
  isRunning: boolean;
  scenario: string;
  mqttConnected: boolean;
  telemetry: TelemetryData | null;
  telemetryHistory: TelemetryData[];
  alarms: ScadaAlarm[];
  logs: ScadaLog[];
  uptime: number;
  cycle: number;
  latency: number;
  toggleSimulation: () => void;
  setScenario: (scenario: string) => void;
  resetSimulation: () => void;
  setMqttConnected: (connected: boolean) => void;
  updateTelemetry: (data: TelemetryData) => void;
  addAlarm: (alarm: Omit<ScadaAlarm, 'id' | 'time' | 'acked'>) => void;
  ackAlarm: (id: number) => void;
  ackAllAlarms: () => void;
  addLog: (level: 'INFO' | 'WARN' | 'ERROR', msg: string) => void;
  incrementTime: (deltaSeconds: number) => void;
  setLatency: (ms: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  isRunning: false,
  scenario: 'optimal',
  mqttConnected: false,
  telemetry: null,
  telemetryHistory: [],
  alarms: [],
  logs: [
    { id: 1, time: new Date().toLocaleTimeString([], { hour12: false }), level: 'INFO', msg: 'HydroSense AI SCADA initialised' },
    { id: 2, time: new Date().toLocaleTimeString([], { hour12: false }), level: 'INFO', msg: 'Awaiting simulation start...' }
  ],
  uptime: 0,
  cycle: 0,
  latency: 0,
  toggleSimulation: () => set((state) => {
    if (!state.isRunning && state.logs.length <= 2) {
      // Just starting
      return { isRunning: true, logs: [{ id: Date.now(), time: new Date().toLocaleTimeString([], { hour12: false }), level: 'INFO', msg: 'Simulation STARTED. Models tracking 17 channels.' }, ...state.logs] };
    }
    return { isRunning: !state.isRunning };
  }),
  setScenario: (scenario: string) => set((state) => {
    const scShort = scenario === 'optimal' ? 'NOMINAL' : scenario.toUpperCase();
    const newLog: ScadaLog = { id: Date.now(), time: new Date().toLocaleTimeString([], { hour12: false }), level: scenario === 'optimal' ? 'INFO' : 'WARN', msg: `System state changed to: ${scShort}` };
    return { scenario, logs: [newLog, ...state.logs].slice(0, 80) };
  }),
  resetSimulation: () => set({ 
    isRunning: false, scenario: 'optimal', telemetryHistory: [], telemetry: null, alarms: [], 
    uptime: 0, cycle: 0, latency: 0,
    logs: [{ id: Date.now(), time: new Date().toLocaleTimeString([], { hour12: false }), level: 'INFO', msg: 'Simulation RESET to zero state.' }]
  }),
  setMqttConnected: (connected: boolean) => set({ mqttConnected: connected }),
  updateTelemetry: (data: TelemetryData) => set((state) => {
    const newHistory = [...state.telemetryHistory, data].slice(-60); // Keep last 60 ticks
    return { telemetry: data, telemetryHistory: newHistory };
  }),
  addAlarm: (alarm) => set((state) => {
    const exists = state.alarms.some(a => a.component === alarm.component && !a.acked && a.msg === alarm.msg);
    if (exists) return state;
    const newAlarm: ScadaAlarm = {
      ...alarm,
      id: Date.now(),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      acked: false
    };
    return { alarms: [newAlarm, ...state.alarms].slice(0, 20) };
  }),
  ackAlarm: (id) => set((state) => ({
    alarms: state.alarms.map(a => a.id === id ? { ...a, acked: true } : a)
  })),
  ackAllAlarms: () => set((state) => ({
    alarms: state.alarms.map(a => ({ ...a, acked: true }))
  })),
  addLog: (level, msg) => set((state) => {
    const newLog: ScadaLog = { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString([], { hour12: false }), level, msg };
    return { logs: [newLog, ...state.logs].slice(0, 80) };
  }),
  incrementTime: (deltaSeconds) => set((state) => ({
    uptime: state.uptime + deltaSeconds,
    cycle: Math.floor((state.uptime + deltaSeconds) / 2) // 1 cycle = 2 seconds
  })),
  setLatency: (ms) => set({ latency: ms })
}));
