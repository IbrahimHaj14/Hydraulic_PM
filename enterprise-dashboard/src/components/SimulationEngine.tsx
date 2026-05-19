"use client";

import { useEffect, useRef } from 'react';
import { useSimulationStore } from '@/lib/store';
import { generateMockTelemetry } from '@/lib/mockTelemetry';

export default function SimulationEngine() {
  const { isRunning, scenario, mqttConnected, updateTelemetry, setScenario, addAlarm, incrementTime, setLatency, addLog } = useSimulationStore();
  const uptime = useSimulationStore((s) => s.uptime);
  const tickRef = useRef(0);
  const cycleRef = useRef(0);
  const prevHealthRef = useRef<any>({ cooler: 100, valve: 100, pump: 100, accumulator: 100 });
  const faultFiredRef = useRef(false);

  // Reset fault guard when simulation is reset (uptime returns to 0)
  useEffect(() => {
    if (uptime === 0) {
      faultFiredRef.current = false;
      tickRef.current = 0;
      cycleRef.current = 0;
    }
  }, [uptime]);

  // Global client-side mock telemetry loop
  useEffect(() => {
    if (!isRunning) {
      return;
    }

    if (mqttConnected) return;

    const interval = setInterval(() => {
      tickRef.current++;
      const mockData = generateMockTelemetry(scenario, tickRef.current);
      updateTelemetry(mockData);
      
      // Update time every 1 second (10 ticks)
      if (tickRef.current % 10 === 0) {
        incrementTime(1);
      }

      // Every 2 seconds (1 cycle = 20 ticks)
      if (tickRef.current % 20 === 0) {
        cycleRef.current++;
        
        // Random latency 60-120ms
        setLatency(Math.floor(60 + Math.random() * 60));

        // Deterministic fault injection at 45 s uptime
        const currentUptime = useSimulationStore.getState().uptime;
        if (scenario === 'optimal' && currentUptime >= 45 && !faultFiredRef.current) {
          faultFiredRef.current = true;
          setScenario('pump-leak');
          addLog('WARN', 'Auto-injection triggered: simulated pump-leak anomaly at 45 s uptime.');
        }

        // Alarm checking logic based on scadaHealth
        if (mockData.scadaHealth) {
          const newHealth = mockData.scadaHealth;
          const prevHealth = prevHealthRef.current;
          
          const comps = [
            { key: 'cooler', icon: '❄️' },
            { key: 'valve', icon: '🔧' },
            { key: 'pump', icon: '💧' },
            { key: 'accumulator', icon: '🔋' },
          ];

          comps.forEach(({ key, icon }) => {
            const h = newHealth[key as keyof typeof newHealth];
            const prev = prevHealth[key as keyof typeof prevHealth];
            
            if (h < 40 && prev >= 40) {
              addAlarm({ priority: 'CRIT', component: key, msg: `${icon} ${key.toUpperCase()} health critical (${Math.round(h)}/100)` });
              addLog('ERROR', `CRITICAL: ${key} health dropped to ${Math.round(h)}/100 — immediate action required`);
            } else if (h < 75 && h >= 40 && prev >= 75) {
              addAlarm({ priority: 'WARN', component: key, msg: `${icon} ${key.toUpperCase()} health degraded (${Math.round(h)}/100)` });
              addLog('WARN', `WARNING: ${key} health at ${Math.round(h)}/100 — schedule inspection`);
            } else if (h >= 75 && prev < 75) {
              addLog('INFO', `RECOVERY: ${key} health restored to ${Math.round(h)}/100`);
            }
          });
          
          prevHealthRef.current = { ...newHealth };
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, scenario, mqttConnected, updateTelemetry, setScenario, addAlarm, incrementTime, setLatency, addLog]);

  return null; // Invisible global engine
}
