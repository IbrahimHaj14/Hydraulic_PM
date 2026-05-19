"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, Clock } from 'lucide-react';
import { acknowledgeAlert } from '@/app/actions/alerts';
import { useSimulationStore } from '@/lib/store';
import styles from './AlertTriage.module.css';

type AlertData = {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  component: string;
  message: string;
  timestamp: string;
  rul?: string;
};

// Mock alerts for initial UI scaffolding
const initialAlerts: AlertData[] = [
  {
    id: '1',
    severity: 'CRITICAL',
    component: 'Main Hydraulic Pump',
    message: 'Pump efficiency drop highly correlated with recent spike in hydraulic fluid temperature. Severe leakage risk.',
    timestamp: 'Just now',
    rul: '~12 hrs',
  },
  {
    id: '2',
    severity: 'WARNING',
    component: 'Cooler Unit A',
    message: 'Cooling efficiency reduced by 15%. Recommend inspecting radiator fins.',
    timestamp: '2 mins ago',
    rul: '~720 hrs',
  }
];

export default function AlertTriage() {
  const [alerts, setAlerts] = useState<AlertData[]>(initialAlerts);
  const { isRunning, scenario, telemetry } = useSimulationStore();
  // Track the initial AHI when scenario started (for delta display)
  const baselineAhiRef = useRef<number | null>(null);

  // Mock fallback data for when MQTT telemetry isn't streaming
  const mockScenarioData: Record<string, { ahi: number; rul: string; rootCause: string; recommendation: string }> = {
    'pump-leak': {
      ahi: 38,
      rul: '~12 hrs',
      rootCause: 'Pump RPM dropped significantly below nominal (2400). Cooler temperature rising indicates internal fluid bypass. Pattern matches hydraulic seal degradation fingerprint (ISO 4406:2021).',
      recommendation: 'Immediate inspection of pump mechanical seals. Prepare replacement seal kit P/N HYD-SEAL-4406.',
    },
    'valve-degrade': {
      ahi: 62,
      rul: '~168 hrs (7 days)',
      rootCause: 'Valve actuation degraded below nominal (100%). Pump RPM compensating upward. Spool erosion pattern detected per API 598 leakage classification.',
      recommendation: 'Schedule valve spool replacement within RUL window. Cross-reference with last maintenance log.',
    },
    'accumulator-fail': {
      ahi: 45,
      rul: '~48 hrs',
      rootCause: 'Accumulator pre-charge pressure dropping below nominal (90 PSI). Nitrogen bladder integrity compromised. Failure mode consistent with fatigue cracking per ASME PCC-2.',
      recommendation: 'Isolate accumulator. Perform nitrogen pre-charge test per OEM spec. Replace bladder if delta-P > 5 PSI.',
    },
  };

  useEffect(() => {
    if (isRunning && scenario !== 'optimal') {
      const componentLabel = scenario === 'pump-leak' ? 'Main Hydraulic Pump' 
        : scenario === 'valve-degrade' ? 'Control Valve' 
        : 'Accumulator';
      const componentKey = scenario === 'pump-leak' ? 'pump' 
        : scenario === 'valve-degrade' ? 'valve' 
        : 'accumulator';

      // Try live telemetry first, fall back to mock data
      const liveAhi = telemetry?.components?.[componentKey as keyof typeof telemetry.components]?.ahi;
      const liveRul = telemetry?.components?.[componentKey as keyof typeof telemetry.components]?.rul?.label;
      const liveConfidence = telemetry?.xai?.confidence;
      const mock = mockScenarioData[scenario];

      const componentAhi = liveAhi ?? mock.ahi;
      const componentRul = liveRul ?? mock.rul;
      const confidence = liveConfidence ?? 85;
      const rootCause = telemetry?.xai?.rootCause ?? mock.rootCause;
      const recommendation = telemetry?.xai?.recommendation ?? mock.recommendation;

      // Capture baseline AHI on first tick
      if (baselineAhiRef.current === null) {
        baselineAhiRef.current = componentAhi;
      }

      // Build descriptive message with AHI trajectory
      const ahiDelta = `${componentLabel} AHI: ${baselineAhiRef.current}% → ${componentAhi}%`;

      const newAlert: AlertData = {
        id: Date.now().toString(),
        severity: scenario === 'pump-leak' || scenario === 'accumulator-fail' ? 'CRITICAL' : 'WARNING',
        component: componentLabel,
        message: `${rootCause} [${ahiDelta}, ${confidence}% confidence]. ${recommendation}`,
        timestamp: 'Just now',
        rul: componentRul,
      };
      
      setAlerts(prev => {
        // Prevent duplicate alerts for the same scenario in a row
        if (prev.length > 0 && prev[0].component === newAlert.component && prev[0].severity === newAlert.severity) {
          // Update the existing top alert with fresh RUL/AHI data
          const updated = [...prev];
          updated[0] = { ...updated[0], message: newAlert.message, rul: newAlert.rul };
          return updated;
        }
        return [newAlert, ...prev];
      });
    } else {
      // Reset baseline when simulation stops
      baselineAhiRef.current = null;
    }
  }, [isRunning, scenario, telemetry?.systemAhi, telemetry?.components]);

  const handleAcknowledge = async (id: string) => {
    // Optimistic UI update
    setAlerts(prev => prev.filter(alert => alert.id !== id));
    // Trigger Server Action for Audit Logging & DB update
    try {
      await acknowledgeAlert(id, "maintenance_engineer_1");
    } catch (e) {
      console.error("Failed to acknowledge alert in DB", e);
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <ShieldAlert size={16} />;
      case 'WARNING': return <AlertTriangle size={16} />;
      case 'ADVISORY': return <Info size={16} />;
      default: return <Info size={16} />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>
          <ShieldAlert size={20} color="var(--accent-primary)" />
          Alert Triage Center
        </div>
        <span className={styles.badge}>{alerts.length} Active</span>
      </div>

      {alerts.length === 0 ? (
        <div className={styles.emptyState}>
          <CheckCircle2 size={32} color="var(--status-healthy)" />
          <p>All systems operating optimally.</p>
        </div>
      ) : (
        <div className={styles.alertList}>
          {alerts.map((alert) => (
            <div key={alert.id} className={`${styles.alertCard} ${styles[alert.severity.toLowerCase()]}`}>
              <div className={styles.alertHeader}>
                {getIcon(alert.severity)}
                {alert.severity}: {alert.component}
              </div>
              <div className={styles.alertBody}>
                {alert.message}
              </div>
              <div className={styles.alertFooter}>
                <span className={styles.timestamp}>{alert.timestamp}</span>
                {alert.rul && (
                  <span className={styles.rulTag}>
                    <Clock size={12} /> RUL: {alert.rul}
                  </span>
                )}
                <button 
                  className={styles.actionBtn}
                  onClick={() => handleAcknowledge(alert.id)}
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
