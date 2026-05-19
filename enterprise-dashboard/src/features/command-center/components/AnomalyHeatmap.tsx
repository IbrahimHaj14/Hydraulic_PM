"use client";

import React, { useMemo } from 'react';
import { Grid3X3 } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';
import styles from './AnomalyHeatmap.module.css';

/**
 * Anomaly Heatmap — Component × Time intensity matrix.
 * Shows the last 30 telemetry ticks as a color-coded heatmap where
 * intensity = 100 - AHI (so higher = more anomalous).
 * This is the "asset-by-hour anomaly heatmap" pattern from IBM Carbon / Grafana benchmarks.
 */

const COMPONENTS = ['pump', 'valve', 'cooler', 'accumulator'] as const;
const COMPONENT_LABELS: Record<string, string> = {
  pump: 'Pump',
  valve: 'Valve',
  cooler: 'Cooler',
  acc: 'Acc.',
  accumulator: 'Acc.',
};

function getHeatColor(ahi: number): string {
  // Green → Yellow → Orange → Red as AHI degrades
  if (ahi >= 90) return 'rgba(16, 185, 129, 0.6)';  // healthy green
  if (ahi >= 75) return 'rgba(16, 185, 129, 0.3)';  // light green
  if (ahi >= 60) return 'rgba(234, 179, 8, 0.4)';   // yellow
  if (ahi >= 45) return 'rgba(249, 115, 22, 0.5)';  // orange
  if (ahi >= 30) return 'rgba(239, 68, 68, 0.5)';   // red
  return 'rgba(239, 68, 68, 0.8)';                   // deep red
}

export default function AnomalyHeatmap() {
  const { telemetryHistory, isRunning } = useSimulationStore();

  const heatmapData = useMemo(() => {
    const window = telemetryHistory.slice(-30);
    return COMPONENTS.map(comp => ({
      component: comp,
      cells: window.map(tick => {
        const ahi = tick.components?.[comp]?.ahi ?? 97;
        return { ahi, color: getHeatColor(ahi) };
      }),
    }));
  }, [telemetryHistory]);

  const hasData = telemetryHistory.length > 0 && telemetryHistory[0].components;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Grid3X3 size={16} color="var(--accent-primary)" />
        <span>Anomaly Intensity Matrix</span>
        {isRunning && <span className={styles.liveBadge}>● LIVE</span>}
      </div>

      {!hasData ? (
        <div className={styles.noData}>
          No telemetry data — start a simulation to populate the heatmap
        </div>
      ) : (
        <div className={styles.matrix}>
          {heatmapData.map(row => (
            <div key={row.component} className={styles.row}>
              <div className={styles.rowLabel}>{COMPONENT_LABELS[row.component]}</div>
              <div className={styles.cells}>
                {row.cells.map((cell, i) => (
                  <div
                    key={i}
                    className={styles.cell}
                    style={{ backgroundColor: cell.color }}
                    title={`${row.component}: AHI ${cell.ahi}%`}
                  />
                ))}
              </div>
              <div className={styles.rowValue}>
                {row.cells.length > 0 ? `${row.cells[row.cells.length - 1].ahi}%` : '--'}
              </div>
            </div>
          ))}

          <div className={styles.timeAxis}>
            <span>-30s</span>
            <span className={styles.timeArrow}>→ time</span>
            <span>now</span>
          </div>
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Healthy</span>
        <div className={styles.gradientBar} />
        <span className={styles.legendLabel}>Critical</span>
      </div>
    </div>
  );
}
