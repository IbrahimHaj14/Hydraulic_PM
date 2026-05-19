"use client";

import React from 'react';
import { Brain, Gauge, ShieldAlert, Clock } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './AiDiagnostics.module.css';

export default function AiDiagnostics() {
  const { telemetry, isRunning, scenario } = useSimulationStore();

  const xai = telemetry?.xai ?? {
    confidence: 12,
    rootCause: 'No anomalies detected. All parameters within nominal operating envelope.',
    affectedSensor: 'None',
    recommendation: 'Continue standard monitoring schedule.',
  };
  const systemAhi = telemetry?.systemAhi ?? 97;

  const getConfidenceColor = (conf: number) => {
    if (conf > 70) return 'var(--status-critical)';
    if (conf > 40) return 'var(--status-warning)';
    return 'var(--status-healthy)';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Brain size={16} color="var(--accent-primary)" />
        <span>AI Diagnostics</span>
        {isRunning && scenario !== 'optimal' && (
          <span className={styles.analyzingBadge}>● ANALYZING</span>
        )}
      </div>

      <div className={styles.metricsRow}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}><Gauge size={12} /> Confidence</div>
          <div className={styles.metricValue} style={{ color: getConfidenceColor(xai.confidence) }}>
            {xai.confidence}%
          </div>
          <div className={styles.miniBar}>
            <div className={styles.miniFill} style={{ width: `${xai.confidence}%`, backgroundColor: getConfidenceColor(xai.confidence) }} />
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}><ShieldAlert size={12} /> System AHI</div>
          <div className={styles.metricValue} style={{ color: systemAhi < 50 ? 'var(--status-critical)' : 'var(--status-healthy)' }}>
            {systemAhi}%
          </div>
        </div>
      </div>

      <div className={styles.insightBlock}>
        <div className={styles.insightLabel}>Root Cause</div>
        <div className={styles.insightText}>{xai.rootCause}</div>
      </div>

      <div className={styles.insightBlock}>
        <div className={styles.insightLabel}>Recommendation</div>
        <div className={styles.insightText}>{xai.recommendation}</div>
      </div>
    </div>
  );
}
