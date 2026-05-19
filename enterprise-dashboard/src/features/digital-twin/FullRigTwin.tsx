"use client";

import React from 'react';
import { Network, Server, Settings, Activity, Cpu } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import SchematicNode from './components/SchematicNode';
import styles from './FullRigTwin.module.css';

export default function FullRigTwin() {
  const { isRunning, scenario } = useSimulationStore();

  const isHpuFailed = isRunning && scenario !== 'optimal';

  // Determine line styles
  const getLineStyle = (isCascading: boolean) => {
    if (!isRunning) return '';
    if (isHpuFailed && isCascading) return styles.lineCritical;
    return styles.lineActive;
  };

  // Status for macro nodes
  const topDriveStatus = isHpuFailed ? 'critical' : 'healthy';
  const hpuStatus = isHpuFailed ? 'critical' : 'healthy';
  const drawworksStatus = isHpuFailed ? 'warning' : 'healthy';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Network size={20} color="var(--accent-primary)" />
        Rig Process Flow Diagram (PFD)
      </div>

      <div className={styles.schematicCanvas}>
        {/* Main Hydraulic Supply Line to Top Drive */}
        <div className={`${styles.lineVertical} ${getLineStyle(true)}`} style={{ top: '25%', left: '50%', height: '50%' }} />
        
        {/* Branch line to Drawworks */}
        <div className={`${styles.lineHorizontal} ${getLineStyle(true)}`} style={{ top: '50%', left: '50%', width: '25%' }} />
        
        {/* Independent line to Mud Pumps (no cascading failure from HPU) */}
        <div className={`${styles.lineHorizontal} ${getLineStyle(false)}`} style={{ top: '75%', left: '20%', width: '30%' }} />

        {/* Nodes */}
        <SchematicNode 
          label="Top Drive System" 
          icon={<Settings size={24} />} 
          status={isRunning ? topDriveStatus : 'idle'} 
          position={{ top: '15%', left: '42%' }} 
          telemetry={isRunning ? (topDriveStatus === 'critical' ? 'TORQUE LOSS' : '150 RPM') : undefined}
        />

        <SchematicNode 
          label="Hydraulic Power Unit (HPU)" 
          icon={<Server size={24} />} 
          status={isRunning ? hpuStatus : 'idle'} 
          position={{ top: '75%', left: '42%' }} 
          telemetry={isRunning ? (hpuStatus === 'critical' ? 'FAULT DETECTED' : 'NOMINAL') : undefined}
        />

        <SchematicNode 
          label="Drawworks" 
          icon={<Cpu size={24} />} 
          status={isRunning ? drawworksStatus : 'idle'} 
          position={{ top: '40%', left: '70%' }} 
          telemetry={isRunning ? (drawworksStatus === 'warning' ? 'BRAKE WEAR' : 'NOMINAL') : undefined}
        />

        <SchematicNode 
          label="Mud Pumps" 
          icon={<Activity size={24} />} 
          status={isRunning ? 'healthy' : 'idle'} 
          position={{ top: '65%', left: '5%' }} 
          telemetry={isRunning ? '120 GPM' : undefined}
        />
      </div>
    </div>
  );
}
