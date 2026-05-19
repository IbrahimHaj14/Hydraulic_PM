"use client";

import React, { useMemo } from 'react';
import { TrendingDown } from 'lucide-react';
import { useSimulationStore, TelemetryData } from '@/lib/store';
import styles from './AhiTrendChart.module.css';

/**
 * Real-time AHI Trend Chart — synchronized multi-line SVG chart.
 * Renders per-component AHI degradation trajectories over the last 60 ticks.
 * Follows the "synchronized time-series stack" pattern from WaterSight/Grafana benchmarks.
 */

const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const PADDING = { top: 20, right: 15, bottom: 25, left: 35 };

const COMPONENT_COLORS: Record<string, string> = {
  pump:        '#3b82f6', // blue
  valve:       '#10b981', // green
  cooler:      '#f97316', // orange
  accumulator: '#a855f7', // purple
};

const COMPONENT_LABELS: Record<string, string> = {
  pump:        'Pump',
  valve:       'Valve',
  cooler:      'Cooler',
  accumulator: 'Acc.',
};

function buildPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return '';
  const xStep = w / (data.length - 1);
  return data.map((val, i) => {
    const x = PADDING.left + i * xStep;
    const y = PADDING.top + (1 - val / 100) * h;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function buildAreaPath(data: number[], w: number, h: number): string {
  if (data.length < 2) return '';
  const linePath = buildPath(data, w, h);
  const lastX = PADDING.left + (data.length - 1) * (w / (data.length - 1));
  return `${linePath} L${lastX.toFixed(1)},${(PADDING.top + h).toFixed(1)} L${PADDING.left},${(PADDING.top + h).toFixed(1)} Z`;
}

export default function AhiTrendChart() {
  const { telemetryHistory, isRunning } = useSimulationStore();

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Extract AHI time series per component from the last 60 ticks
  const series = useMemo(() => {
    const window = telemetryHistory.slice(-60);
    const result: Record<string, number[]> = {
      pump: [], valve: [], cooler: [], accumulator: [],
    };
    const systemAhiArr: number[] = [];

    for (const tick of window) {
      if (tick.components) {
        result.pump.push(tick.components.pump.ahi);
        result.valve.push(tick.components.valve.ahi);
        result.cooler.push(tick.components.cooler.ahi);
        result.accumulator.push(tick.components.accumulator.ahi);
      }
      if (tick.systemAhi !== undefined) {
        systemAhiArr.push(tick.systemAhi);
      }
    }

    return { ...result, system: systemAhiArr };
  }, [telemetryHistory]);

  // Y-axis grid lines
  const yTicks = [0, 25, 50, 75, 100];

  // Current values for the legend
  const currentValues: Record<string, number> = {};
  for (const key of ['pump', 'valve', 'cooler', 'accumulator'] as const) {
    const arr = series[key as keyof typeof series];
    currentValues[key] = arr.length > 0 ? arr[arr.length - 1] : 97;
  }
  const systemCurrent = series.system.length > 0 ? series.system[series.system.length - 1] : 97;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <TrendingDown size={16} color="var(--accent-primary)" />
        <span>AHI Degradation Trend</span>
        <span className={styles.windowLabel}>60s window</span>
        {isRunning && <span className={styles.liveBadge}>● LIVE</span>}
      </div>

      <div className={styles.chartWrapper}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className={styles.chartSvg}
        >
          {/* Grid lines */}
          {yTicks.map(tick => {
            const y = PADDING.top + (1 - tick / 100) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left} y1={y}
                  x2={PADDING.left + plotW} y2={y}
                  stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4,4"
                />
                <text x={PADDING.left - 5} y={y + 3} fill="var(--text-muted)" fontSize="8" textAnchor="end">{tick}%</text>
              </g>
            );
          })}

          {/* Warning zone: AHI < 50 */}
          <rect
            x={PADDING.left}
            y={PADDING.top + (1 - 50 / 100) * plotH}
            width={plotW}
            height={(50 / 100) * plotH}
            fill="rgba(239, 68, 68, 0.04)"
          />

          {/* Critical threshold line at 30% */}
          <line
            x1={PADDING.left} y1={PADDING.top + (1 - 30 / 100) * plotH}
            x2={PADDING.left + plotW} y2={PADDING.top + (1 - 30 / 100) * plotH}
            stroke="var(--status-critical)" strokeWidth="1" strokeDasharray="6,3" opacity="0.5"
          />

          {/* System AHI — bold area fill */}
          {series.system.length > 1 && (
            <path d={buildAreaPath(series.system, plotW, plotH)} fill="rgba(255,255,255,0.04)" />
          )}
          {series.system.length > 1 && (
            <path d={buildPath(series.system, plotW, plotH)} fill="none" stroke="var(--text-primary)" strokeWidth="2.5" opacity="0.6" />
          )}

          {/* Per-component lines */}
          {(['pump', 'valve', 'cooler', 'accumulator'] as const).map(key => {
            const data = series[key as keyof typeof series];
            if (data.length < 2) return null;
            return (
              <path
                key={key}
                d={buildPath(data, plotW, plotH)}
                fill="none"
                stroke={COMPONENT_COLORS[key]}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {/* No-data placeholder */}
        {series.system.length < 2 && (
          <div className={styles.noData}>
            Start a simulation to see AHI degradation trends
          </div>
        )}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={styles.legendLine} style={{ backgroundColor: 'var(--text-primary)', opacity: 0.6, height: '3px' }} />
          <span>System <strong>{systemCurrent}%</strong></span>
        </div>
        {(['pump', 'valve', 'cooler', 'accumulator'] as const).map(key => (
          <div key={key} className={styles.legendItem}>
            <span className={styles.legendLine} style={{ backgroundColor: COMPONENT_COLORS[key] }} />
            <span>{COMPONENT_LABELS[key]} <strong style={{ color: currentValues[key] < 50 ? 'var(--status-critical)' : 'inherit' }}>{currentValues[key]}%</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}
