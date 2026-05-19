"use client";

import React from 'react';
import { Bell, User } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './Topbar.module.css';

export default function Topbar() {
  const mqttConnected = useSimulationStore((s) => s.mqttConnected);

  return (
    <header className={styles.topbar}>
      <div className={styles.title}>Process Command Center</div>
      <div className={styles.actions}>
        <div className={styles.statusIndicator}>
          <div className={styles.dot} style={{ background: mqttConnected ? 'var(--status-healthy)' : 'var(--status-warning)' }}></div>
          {mqttConnected ? 'MQTT Connected' : 'Simulation Mode'}
        </div>
        <Bell size={20} color="var(--text-secondary)" />
        <User size={20} color="var(--text-secondary)" />
      </div>
    </header>
  );
}
