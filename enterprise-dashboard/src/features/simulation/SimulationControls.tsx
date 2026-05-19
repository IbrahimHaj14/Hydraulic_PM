"use client";

import React, { useEffect } from 'react';
import { Play, Square, Settings2, RefreshCw } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import { useMqtt } from '@/lib/mqtt';
import styles from './SimulationControls.module.css';

export default function SimulationControls() {
  const { isRunning, scenario, toggleSimulation, setScenario, resetSimulation } = useSimulationStore();
  const { publishCommand } = useMqtt(); // Initialize MQTT client

  const handleToggle = () => {
    if (isRunning) {
      publishCommand('stop');
      toggleSimulation();
    } else {
      publishCommand('start', scenario);
      toggleSimulation();
    }
  };

  const handleReset = () => {
    publishCommand('stop');
    resetSimulation();
  };

  const handleScenarioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setScenario(e.target.value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Settings2 size={20} color="var(--accent-primary)" />
          Simulation Control Panel
        </div>
        <div className={`${styles.statusIndicator} ${isRunning ? styles.statusRunning : styles.statusIdle}`}>
          <div className={`${styles.dot} ${isRunning ? styles.dotRunning : styles.dotIdle}`}></div>
          {isRunning ? 'Simulating' : 'Idle'}
        </div>
      </div>

      <div className={styles.controlsRow}>
        <select 
          className={styles.select}
          value={scenario}
          onChange={handleScenarioChange}
          disabled={isRunning}
        >
          <option value="optimal">Optimal Baseline</option>
          <option value="pump-leak">Inject: Severe Pump Leak</option>
          <option value="valve-degrade">Inject: Gradual Valve Degradation</option>
          <option value="accumulator-fail">Inject: Accumulator Pressure Loss</option>
        </select>

        <button 
          className={`${styles.btn} ${isRunning ? styles.btnDanger : styles.btnPrimary}`}
          onClick={handleToggle}
        >
          {isRunning ? (
            <><Square size={16} /> Stop Simulation</>
          ) : (
            <><Play size={16} /> Start Simulation</>
          )}
        </button>

        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleReset}>
          <RefreshCw size={16} /> Reset
        </button>
      </div>
    </div>
  );
}
