"use client";

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Activity, Download, Brain, ShieldAlert, Gauge, Clock, TrendingDown } from 'lucide-react';
import { useSimulationStore, RULData, ComponentsData, ComponentHealth } from '@/lib/store';
import TelemetryChart from './components/TelemetryChart';
import ShapChart from './components/ShapChart';
import SparklineCard from './components/SparklineCard';
import styles from './RcaConsole.module.css';

// ── Chart config registry ────────────────────────────────────────────
const CHART_CONFIGS = {
  pumpRpm:    { dataKey: 'pumpRpm',    forecastKey: 'forecastPumpRpm',    title: 'Main Pump Power Draw (EPS1)', color: 'var(--accent-primary)',  unit: 'RPM'    },
  coolerTemp: { dataKey: 'coolerTemp', forecastKey: 'forecastCoolerTemp', title: 'Cooler Temperature',          color: 'var(--status-warning)',  unit: '°C'     },
  valveOpen:  { dataKey: 'valveOpen',  forecastKey: 'forecastValveOpen',  title: 'Control Valve Actuation',     color: 'var(--status-healthy)',  unit: '% OPEN' },
  accPressure:{ dataKey: 'accPressure',forecastKey: 'forecastAccPressure',title: 'Accumulator Pressure (PS4)',  color: 'var(--status-critical)', unit: 'PSI'    },
} as const;

type ChartKey = keyof typeof CHART_CONFIGS;
const ALL_KEYS: ChartKey[] = ['pumpRpm', 'coolerTemp', 'valveOpen', 'accPressure'];

// Which chart is primary (most diagnostic signal) per fault
const FAULT_PRIMARY: Record<string, ChartKey> = {
  'pump-leak':        'pumpRpm',
  'valve-degrade':    'accPressure',
  'accumulator-fail': 'accPressure',
};

// Component key → chart key mapping (for health lookup)
const CHART_TO_COMP: Record<ChartKey, keyof ComponentsData> = {
  pumpRpm:     'pump',
  coolerTemp:  'cooler',
  valveOpen:   'valve',
  accPressure: 'accumulator',
};

export default function RcaConsole() {
  const searchParams = useSearchParams();
  const focusedComponent = searchParams.get('component');
  const { isRunning, scenario, telemetryHistory, telemetry } = useSimulationStore();
  // ── Build chart data with 10-tick linear forecast ─────────────────
  const data = useMemo(() => {
    const mapped = [...telemetryHistory];
    if (isRunning && mapped.length > 0) {
      const last = mapped[mapped.length - 1];
      mapped[mapped.length - 1] = {
        ...last,
        forecastPumpRpm:    last.pumpRpm,
        forecastCoolerTemp: last.coolerTemp,
        forecastValveOpen:  last.valveOpen,
        forecastAccPressure:last.accPressure,
      };
      for (let i = 1; i <= 10; i++) {
        const pt: any = { timestamp: `+${i}s`, pumpRpm: null, coolerTemp: null, valveOpen: null, accPressure: null };
        if (scenario === 'pump-leak')        { pt.forecastPumpRpm    = Math.max(0, last.pumpRpm    - i * 20); pt.forecastCoolerTemp = last.coolerTemp + i * 0.5; }
        if (scenario === 'valve-degrade')    { pt.forecastValveOpen  = Math.max(0, last.valveOpen  - i * 1.5); pt.forecastPumpRpm   = last.pumpRpm   + i * 5;   }
        if (scenario === 'accumulator-fail') { pt.forecastAccPressure = Math.max(0, last.accPressure - i * 1.2); }
        mapped.push(pt);
      }
    }
    return mapped;
  }, [telemetryHistory, isRunning, scenario]);

  // ── RUL from current AHI — stable, no slope dependency ──────────
  const computeDynamicRUL = (compKey: keyof ComponentsData): RULData => {
    const cur = telemetry?.components?.[compKey]?.ahi ?? 100;
    if (cur >= 95) return { value: 2000, unit: 'hrs', label: '~2,000 hrs'       };
    if (cur >= 80) return { value: 500,  unit: 'hrs', label: '~500 hrs'         };
    if (cur >= 60) return { value: 168,  unit: 'hrs', label: '~168 hrs (7d)'    };
    if (cur >= 40) return { value: 48,   unit: 'hrs', label: '~48 hrs'          };
    if (cur >= 25) return { value: 24,   unit: 'hrs', label: '~24 hrs ⚠'        };
    if (cur >= 15) return { value: 8,    unit: 'hrs', label: '~8 hrs ⚠'         };
    return                { value: 2,    unit: 'hrs', label: 'CRITICAL: <2 hrs' };
  };

  // ── Derive worst component for AHI label ─────────────────────────
  const worstComp = (() => {
    if (!telemetry?.components) return null;
    const entries = Object.entries(telemetry.components) as [keyof ComponentsData, ComponentHealth][];
    return entries.reduce<{ key: string; ahi: number }>(
      (acc, [k, v]) => (v.ahi < acc.ahi ? { key: k, ahi: v.ahi } : acc),
      { key: '', ahi: 101 }
    );
  })();
  const ahiLabel = worstComp && worstComp.ahi < 90
    ? `↓ ${worstComp.key.charAt(0).toUpperCase() + worstComp.key.slice(1)}: ${worstComp.ahi}%`
    : 'All nominal';

  // ── RUL for worst component ────────────────────────────────────────
  const worstCompKey = (worstComp?.key as keyof ComponentsData | '') || 'pump';
  const dynamicRul = worstCompKey ? computeDynamicRUL(worstCompKey as keyof ComponentsData) : null;

  // ── Chart layout helpers ──────────────────────────────────────────
  const isFault = scenario !== 'optimal';
  const primaryKey: ChartKey = FAULT_PRIMARY[scenario] ?? 'pumpRpm';
  const secondaryKeys = ALL_KEYS.filter(k => k !== primaryKey);

  const actualData = data.filter((d: any) => d.pumpRpm !== null);
  const latest = actualData.length > 0 ? actualData[actualData.length - 1] : ({} as any);
  const eventTime = isRunning ? data[30]?.timestamp : undefined;

  const compHealth = (k: ChartKey) => (telemetry?.components?.[CHART_TO_COMP[k]]?.ahi ?? 100) > 70;

  // ── XAI / insight data ────────────────────────────────────────────
  const xai = telemetry?.xai ?? {
    confidence: 12,
    rootCause: 'No anomalies detected. All parameters within nominal operating envelope.',
    affectedSensor: 'None',
    recommendation: 'Continue standard monitoring schedule.',
  };
  const systemAhi = telemetry?.systemAhi ?? telemetry?.ahi;
  const confColor = xai.confidence > 70 ? 'var(--status-critical)' : xai.confidence > 40 ? 'var(--status-warning)' : 'var(--status-healthy)';
  const ahiColor  = systemAhi !== undefined && systemAhi < 50 ? 'var(--status-critical)' : 'var(--status-healthy)';
  const rulColor  = dynamicRul && dynamicRul.value <= 48 ? 'var(--status-critical)' : 'var(--text-primary)';

  // ── CSV export ────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Pump_RPM', 'Cooler_Temp', 'Valve_Open', 'Acc_Pressure', 'System_AHI'];
    const rows = data.filter((d: any) => d.pumpRpm !== null)
      .map((d: any) => [d.timestamp, d.pumpRpm, d.coolerTemp, d.valveOpen, d.accPressure, d.systemAhi ?? d.ahi ?? ''].join(','));
    const csv = 'data:text/csv;charset=utf-8,' + encodeURI([headers.join(','), ...rows].join('\n'));
    const a = document.createElement('a');
    a.setAttribute('href', csv);
    a.setAttribute('download', `rca_export_${new Date().toISOString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.title}>
          <Activity size={24} color="var(--accent-primary)" />
          Root Cause Analysis (RCA)
          {focusedComponent && (
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/ Focus: {focusedComponent.toUpperCase()}</span>
          )}
        </div>
        <button onClick={handleExportCSV} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)', padding: '8px 16px',
          borderRadius: 'var(--border-radius-md)', cursor: 'pointer',
        }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* ── XAI Metrics Panel ── */}
      <div className={styles.xaiPanel}>
        <div className={styles.xaiHeader}>
          <Brain size={20} color="var(--accent-primary)" />
          <span>AI Diagnostics — Explainable Insight</span>
          {isRunning && scenario !== 'optimal' && (
            <span className={styles.xaiLiveBadge}>● ANALYZING</span>
          )}
        </div>

        <div className={styles.xaiMetrics}>
          {/* Confidence */}
          <div className={styles.xaiMetricCard}>
            <div className={styles.xaiMetricLabel}><Gauge size={14} /> Anomaly Confidence</div>
            <div className={styles.xaiMetricValue} style={{ color: confColor }}>{xai.confidence}%</div>
            <div className={styles.confidenceBar}>
              <div className={styles.confidenceFill} style={{ width: `${xai.confidence}%`, backgroundColor: confColor }} />
            </div>
          </div>

          {/* AHI */}
          <div className={styles.xaiMetricCard}>
            <div className={styles.xaiMetricLabel}><ShieldAlert size={14} /> System Health Index</div>
            <div className={styles.xaiMetricValue} style={{ color: ahiColor }}>
              {systemAhi !== undefined ? `${systemAhi}%` : '--'}
            </div>
            <div className={styles.xaiMetricSubLabel}>{ahiLabel}</div>
          </div>

          {/* RUL */}
          <div className={styles.xaiMetricCard}>
            <div className={styles.xaiMetricLabel}><Clock size={14} /> Remaining Useful Life</div>
            <div className={styles.xaiMetricValue} style={{ color: rulColor }}>
              {dynamicRul ? dynamicRul.label : '--'}
            </div>
            {worstComp && worstComp.ahi < 90 && (
              <div className={styles.xaiMetricSubLabel}>
                <TrendingDown size={11} style={{ display: 'inline', marginRight: 3 }} />
                AHI-based · {worstComp.key}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts: Fault mode vs Nominal mode ── */}
      {isFault ? (
        <>
          {/* Primary fault chart + SHAP side by side */}
          <div className={styles.faultRow}>
            <TelemetryChart
              title={CHART_CONFIGS[primaryKey].title}
              dataKey={CHART_CONFIGS[primaryKey].dataKey}
              forecastDataKey={CHART_CONFIGS[primaryKey].forecastKey}
              data={data}
              color={CHART_CONFIGS[primaryKey].color}
              unit={CHART_CONFIGS[primaryKey].unit}
              currentValue={latest[CHART_CONFIGS[primaryKey].dataKey]}
              eventTimestamp={eventTime}
              enableBrush={true}
            />
            <ShapChart scenario={scenario} confidence={xai.confidence} />
          </div>

          {/* Secondary sparklines */}
          <div className={styles.sparklineRow}>
            {secondaryKeys.map(k => (
              <SparklineCard
                key={k}
                title={CHART_CONFIGS[k].title}
                dataKey={CHART_CONFIGS[k].dataKey}
                data={data}
                color={CHART_CONFIGS[k].color}
                unit={CHART_CONFIGS[k].unit}
                currentValue={latest[CHART_CONFIGS[k].dataKey]}
                isHealthy={compHealth(k)}
              />
            ))}
          </div>
        </>
      ) : (
        /* Nominal mode: 2×2 grid */
        <div className={styles.grid}>
          {ALL_KEYS.map(k => (
            <TelemetryChart
              key={k}
              title={CHART_CONFIGS[k].title}
              dataKey={CHART_CONFIGS[k].dataKey}
              forecastDataKey={CHART_CONFIGS[k].forecastKey}
              data={data}
              color={CHART_CONFIGS[k].color}
              unit={CHART_CONFIGS[k].unit}
              currentValue={latest[CHART_CONFIGS[k].dataKey]}
              eventTimestamp={eventTime}
              enableBrush={true}
            />
          ))}
        </div>
      )}

      {/* ── Insight text rows (always visible) ── */}
      <div className={styles.xaiInsight}>
        <div className={styles.xaiInsightRow}><strong>Root Cause:</strong> {xai.rootCause}</div>
        <div className={styles.xaiInsightRow}><strong>Affected Sensor(s):</strong> {xai.affectedSensor}</div>
        <div className={styles.xaiInsightRow}><strong>Recommendation:</strong> {xai.recommendation}</div>
      </div>
    </div>
  );
}
