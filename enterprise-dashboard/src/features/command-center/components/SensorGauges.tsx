"use client";

import React, { useState, useEffect } from 'react';
import { Gauge, Droplets, Thermometer, Settings2, Cylinder } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './SensorGauges.module.css';

interface GaugeCardProps {
  icon: React.ReactNode;
  label: string;
  sensorId: string;
  value: number | string;
  unit: string;
  nominal: number;
  min: number;
  max: number;
  sparkline: number[];
  status: 'normal' | 'warning' | 'critical';
}

function GaugeCard({ icon, label, sensorId, value, unit, nominal, min, max, sparkline, status }: GaugeCardProps) {
  const numValue = typeof value === 'number' ? value : 0;
  const pct = Math.max(0, Math.min(100, ((numValue - min) / (max - min)) * 100));
  // Deviation from nominal as a percentage
  const deviation = nominal > 0 ? ((numValue - nominal) / nominal * 100) : 0;

  const statusColors: Record<string, string> = {
    normal: 'var(--status-healthy)',
    warning: 'var(--status-warning)',
    critical: 'var(--status-critical)',
  };

  // SVG sparkline path
  const sparklinePath = sparkline.length > 1
    ? sparkline.map((v, i) => {
        const x = (i / (sparkline.length - 1)) * 100;
        const y = 100 - ((v - min) / (max - min)) * 100;
        return `${i === 0 ? 'M' : 'L'}${x},${Math.max(5, Math.min(95, y))}`;
      }).join(' ')
    : 'M0,50 L100,50';

  return (
    <div className={`${styles.gaugeCard} ${styles[status]}`}>
      <div className={styles.gaugeHeader}>
        <div className={styles.gaugeIcon}>{icon}</div>
        <div className={styles.gaugeInfo}>
          <div className={styles.gaugeSensorId}>{sensorId}</div>
          <div className={styles.gaugeLabel}>{label}</div>
        </div>
        <div className={styles.gaugeStatusDot} style={{ backgroundColor: statusColors[status] }} />
      </div>

      <div className={styles.gaugeValueRow}>
        <div className={styles.gaugeValue}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className={styles.gaugeUnit}>{unit}</div>
      </div>

      <div className={styles.gaugeBar}>
        <div className={styles.gaugeBarFill} style={{ width: `${pct}%`, backgroundColor: statusColors[status] }} />
        <div className={styles.gaugeNominalMark} style={{ left: `${((nominal - min) / (max - min)) * 100}%` }} />
      </div>

      <div className={styles.gaugeFooter}>
        <span className={styles.gaugeDeviation} style={{ color: Math.abs(deviation) > 10 ? statusColors[status] : 'var(--text-muted)' }}>
          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}% from nominal
        </span>
      </div>

      <div className={styles.sparklineContainer}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.sparklineSvg}>
          <path d={sparklinePath} fill="none" stroke={statusColors[status]} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

export default function SensorGauges() {
  const { telemetry, telemetryHistory, isRunning } = useSimulationStore();
  const [mockTick, setMockTick] = useState(0);

  // Mock data fallback when MQTT isn't streaming
  useEffect(() => {
    if (!telemetry) {
      const interval = setInterval(() => setMockTick(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [telemetry]);

  // Get current readings (static defaults to avoid SSR hydration mismatch)
  const pumpRpm = telemetry?.pumpRpm ?? 2400;
  const coolerTemp = telemetry?.coolerTemp ?? 50;
  const valveOpen = telemetry?.valveOpen ?? 100;
  const accPressure = telemetry?.accPressure ?? 90;

  // Build sparkline data from history
  const buildSparkline = (key: 'pumpRpm' | 'coolerTemp' | 'valveOpen' | 'accPressure'): number[] => {
    if (telemetryHistory.length > 2) {
      return telemetryHistory.slice(-30).map(t => (t as any)[key] ?? 0);
    }
    // Fallback: generate static sparkline
    return Array.from({ length: 30 }, (_, i) => {
      const base = key === 'pumpRpm' ? 2400 : key === 'coolerTemp' ? 50 : key === 'valveOpen' ? 100 : 90;
      return base + (Math.sin(i * 0.5 + mockTick * 0.1) * (base * 0.01));
    });
  };

  // Determine status from component AHI
  const getStatus = (ahi?: number): 'normal' | 'warning' | 'critical' => {
    if (ahi === undefined) return 'normal';
    if (ahi >= 80) return 'normal';
    if (ahi >= 50) return 'warning';
    return 'critical';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Gauge size={18} color="var(--accent-primary)" />
        <span>Live Sensor Telemetry</span>
        {isRunning && <span className={styles.liveBadge}>● LIVE</span>}
        <span className={styles.refreshRate}>10 Hz</span>
      </div>

      <div className={styles.grid}>
        <GaugeCard
          icon={<Droplets size={18} />}
          label="Main Pump Efficiency"
          sensorId="PS-101"
          value={Math.round(pumpRpm)}
          unit="RPM"
          nominal={2400}
          min={0}
          max={3000}
          sparkline={buildSparkline('pumpRpm')}
          status={getStatus(telemetry?.components?.pump?.ahi)}
        />
        <GaugeCard
          icon={<Thermometer size={18} />}
          label="Cooler Temperature"
          sensorId="TS-201"
          value={Math.round(coolerTemp * 10) / 10}
          unit="°C"
          nominal={50}
          min={20}
          max={100}
          sparkline={buildSparkline('coolerTemp')}
          status={getStatus(telemetry?.components?.cooler?.ahi)}
        />
        <GaugeCard
          icon={<Settings2 size={18} />}
          label="Control Valve Position"
          sensorId="VS-301"
          value={Math.round(valveOpen)}
          unit="% OPEN"
          nominal={100}
          min={0}
          max={100}
          sparkline={buildSparkline('valveOpen')}
          status={getStatus(telemetry?.components?.valve?.ahi)}
        />
        <GaugeCard
          icon={<Cylinder size={18} />}
          label="Accumulator Pressure"
          sensorId="PS-401"
          value={Math.round(accPressure * 10) / 10}
          unit="PSI"
          nominal={90}
          min={0}
          max={120}
          sparkline={buildSparkline('accPressure')}
          status={getStatus(telemetry?.components?.accumulator?.ahi)}
        />
      </div>
    </div>
  );
}
