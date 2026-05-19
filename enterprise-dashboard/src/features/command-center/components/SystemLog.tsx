"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, AlertTriangle, Info, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './SystemLog.module.css';

interface LogEntry {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL' | 'OK';
  source: string;
  message: string;
}

const SEVERITY_ICONS = {
  INFO: <Info size={12} />,
  WARN: <AlertTriangle size={12} />,
  CRITICAL: <AlertCircle size={12} />,
  OK: <CheckCircle size={12} />,
};

export default function SystemLog() {
  const { telemetry, isRunning, scenario, mqttConnected } = useSimulationStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScenarioRef = useRef(scenario);
  const tickRef = useRef(0);

  // Generate logs from system events
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Initial boot log
    if (logs.length === 0) {
      setLogs([
        { id: '0', timestamp: now, severity: 'INFO', source: 'SYSTEM', message: 'HydroSense Enterprise Dashboard v2.0 initialized' },
        { id: '1', timestamp: now, severity: mqttConnected ? 'OK' : 'WARN', source: 'MQTT', message: mqttConnected ? 'Broker connected at ws://localhost:9001' : 'Broker connection pending...' },
        { id: '2', timestamp: now, severity: 'INFO', source: 'AI_ENGINE', message: 'XGBoost multi-output classifier loaded (211 features, 5-fold CV F1 ≈ 0.99)' },
        { id: '3', timestamp: now, severity: 'OK', source: 'SENSORS', message: 'All 4 sensor channels (PS-101, TS-201, VS-301, PS-401) reporting nominal' },
      ]);
    }
  }, []);

  // Log scenario changes
  useEffect(() => {
    if (scenario !== lastScenarioRef.current) {
      const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const scenarioLabels: Record<string, string> = {
        'optimal': 'Optimal Baseline',
        'pump-leak': 'Severe Pump Leak',
        'valve-degrade': 'Gradual Valve Degradation',
        'accumulator-fail': 'Accumulator Pressure Loss',
      };
      setLogs(prev => [...prev, {
        id: Date.now().toString(),
        timestamp: now,
        severity: scenario === 'optimal' ? 'INFO' : 'WARN',
        source: 'SIM_CTL',
        message: `Scenario changed → ${scenarioLabels[scenario] || scenario}`,
      }]);
      lastScenarioRef.current = scenario;
    }
  }, [scenario]);

  // Log simulation start/stop
  useEffect(() => {
    const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (isRunning) {
      tickRef.current = 0;
      setLogs(prev => [...prev, {
        id: Date.now().toString(),
        timestamp: now,
        severity: 'INFO',
        source: 'SIM_CTL',
        message: `Simulation STARTED — injecting fault scenario at 10 Hz telemetry rate`,
      }]);
    }
  }, [isRunning]);

  // Log telemetry events (throttled — only log every 5 seconds)
  useEffect(() => {
    if (!telemetry || !isRunning) return;
    tickRef.current++;
    if (tickRef.current % 50 !== 0) return; // Every 5 seconds at 10Hz

    const now = telemetry.timestamp;
    const newLogs: LogEntry[] = [];

    // Check each component for warnings
    const components = telemetry.components;
    if (components) {
      const entries = [
        { key: 'pump', id: 'PS-101', label: 'Pump' },
        { key: 'valve', id: 'VS-301', label: 'Valve' },
        { key: 'cooler', id: 'TS-201', label: 'Cooler' },
        { key: 'accumulator', id: 'PS-401', label: 'Accumulator' },
      ];

      for (const { key, id, label } of entries) {
        const comp = components[key as keyof typeof components];
        if (comp.ahi < 30) {
          newLogs.push({
            id: `${Date.now()}-${key}`,
            timestamp: now,
            severity: 'CRITICAL',
            source: id,
            message: `${label} AHI critically low at ${comp.ahi}% — RUL: ${comp.rul.label}`,
          });
        } else if (comp.ahi < 60) {
          newLogs.push({
            id: `${Date.now()}-${key}`,
            timestamp: now,
            severity: 'WARN',
            source: id,
            message: `${label} AHI degraded to ${comp.ahi}% — monitor closely`,
          });
        }
      }

      // XAI confidence log
      if (telemetry.xai && telemetry.xai.confidence > 70) {
        newLogs.push({
          id: `${Date.now()}-xai`,
          timestamp: now,
          severity: 'CRITICAL',
          source: 'AI_ENGINE',
          message: `Anomaly detection confidence at ${telemetry.xai.confidence}% — ${telemetry.xai.rootCause.substring(0, 80)}...`,
        });
      }
    }

    if (newLogs.length > 0) {
      setLogs(prev => [...prev, ...newLogs].slice(-100)); // Keep last 100 entries
    }
  }, [telemetry?.timestamp]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Terminal size={16} color="var(--accent-primary)" />
        <span className={styles.title}>System Event Log</span>
        <span className={styles.count}>{logs.length} entries</span>
        <button
          className={styles.scrollToggle}
          onClick={() => setAutoScroll(!autoScroll)}
          title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
        >
          {autoScroll ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          {autoScroll ? 'AUTO' : 'PAUSED'}
        </button>
      </div>

      <div className={styles.logBody} ref={scrollRef}>
        {logs.map(log => (
          <div key={log.id} className={`${styles.logEntry} ${styles[log.severity.toLowerCase()]}`}>
            <span className={styles.logTimestamp}>{log.timestamp}</span>
            <span className={`${styles.logSeverity} ${styles[`sev${log.severity}`]}`}>
              {SEVERITY_ICONS[log.severity]}
              {log.severity}
            </span>
            <span className={styles.logSource}>[{log.source}]</span>
            <span className={styles.logMessage}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
