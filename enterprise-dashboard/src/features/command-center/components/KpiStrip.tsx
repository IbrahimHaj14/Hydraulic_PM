"use client";

import React from 'react';
import { Shield, Clock, AlertTriangle, Wifi, WifiOff, Activity } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './KpiStrip.module.css';

const SCENARIO_LABELS: Record<string, string> = {
  'optimal': 'Optimal Baseline',
  'pump-leak': 'Severe Pump Leak',
  'valve-degrade': 'Valve Degradation',
  'accumulator-fail': 'Accumulator Failure',
};

export default function KpiStrip() {
  const { telemetry, isRunning, scenario, mqttConnected } = useSimulationStore();

  // Derive KPIs from live telemetry or mock fallback
  const systemAhi = telemetry?.systemAhi ?? 97;
  const rul = telemetry?.rul?.label ?? '>10,000 hrs';
  const xaiConfidence = telemetry?.xai?.confidence ?? 12;

  // Find the weakest component
  const components = telemetry?.components;
  const weakest = components
    ? Object.entries(components).reduce((min, [k, v]) =>
        v.ahi < min.ahi ? { name: k, ahi: v.ahi } : min,
      { name: 'all', ahi: 100 })
    : null;

  // Count active alerts (simulate from XAI confidence)
  const alertCount = xaiConfidence > 60 ? 2 : xaiConfidence > 30 ? 1 : 0;

  const getAhiColor = (ahi: number) => {
    if (ahi >= 80) return 'var(--status-healthy)';
    if (ahi >= 50) return 'var(--status-warning)';
    return 'var(--status-critical)';
  };

  return (
    <div className={styles.strip}>
      {/* System AHI */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Shield size={16} />
          <span>System Health Index</span>
        </div>
        <div className={styles.cardValue} style={{ color: getAhiColor(systemAhi) }}>
          {systemAhi}%
        </div>
        <div className={styles.cardSubtitle}>
          {weakest && weakest.name !== 'all'
            ? `Bottleneck: ${weakest.name.charAt(0).toUpperCase() + weakest.name.slice(1)} (${weakest.ahi}%)`
            : 'All components nominal'}
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${systemAhi}%`, backgroundColor: getAhiColor(systemAhi) }}
          />
        </div>
      </div>

      {/* RUL */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Clock size={16} />
          <span>Remaining Useful Life</span>
        </div>
        <div className={styles.cardValue} style={{
          color: (telemetry?.rul?.value ?? 10000) <= 48 ? 'var(--status-critical)' : 'var(--text-primary)',
          fontSize: rul.length > 12 ? '1.2rem' : undefined,
        }}>
          {rul}
        </div>
        <div className={styles.cardSubtitle}>System-level estimate (ISO 13381-1)</div>
      </div>

      {/* Active Alerts */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <AlertTriangle size={16} />
          <span>Active Alerts</span>
        </div>
        <div className={styles.cardValue} style={{
          color: alertCount > 1 ? 'var(--status-critical)' : alertCount > 0 ? 'var(--status-warning)' : 'var(--status-healthy)'
        }}>
          {alertCount}
        </div>
        <div className={styles.alertBreakdown}>
          <span className={styles.alertDot} style={{ backgroundColor: 'var(--status-critical)' }} />
          <span>{xaiConfidence > 70 ? '1' : '0'} Critical</span>
          <span className={styles.alertDot} style={{ backgroundColor: 'var(--status-warning)' }} />
          <span>{xaiConfidence > 30 && xaiConfidence <= 70 ? '1' : '0'} Warning</span>
        </div>
      </div>

      {/* System Status */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <Activity size={16} />
          <span>System Status</span>
        </div>
        <div className={styles.statusRow}>
          <div className={`${styles.statusBadge} ${isRunning ? styles.statusActive : styles.statusIdle}`}>
            <div className={styles.statusDot} />
            {isRunning ? 'SIMULATING' : 'IDLE'}
          </div>
        </div>
        <div className={styles.statusDetails}>
          <div className={styles.statusItem}>
            {mqttConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{mqttConnected ? 'MQTT Connected' : 'MQTT Offline'}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.scenarioLabel}>{SCENARIO_LABELS[scenario] || scenario}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
