"use client";

const SHAP_SCENARIOS: Record<string, { feature: string; value: number; label: string }[]> = {
  'pump-leak': [
    { feature: 'EPS1', value: 19.4, label: 'Motor Power Draw' },
    { feature: 'PS1',  value: 16.8, label: 'Pump Inlet Pressure' },
    { feature: 'SE',   value: 13.2, label: 'Pump Efficiency' },
    { feature: 'PS6',  value: 9.7,  label: 'Discharge Pressure' },
    { feature: 'FS1',  value: 8.4,  label: 'Flow Rate (bypass)' },
    { feature: 'VS1',  value: 5.6,  label: 'Vibration (shaft)' },
    { feature: 'TS1',  value: 2.3,  label: 'Fluid Temperature' },
    { feature: 'PS4',  value: -1.7, label: 'Acc. Pre-charge' },
  ],
  'valve-degrade': [
    { feature: 'PS2',  value: 20.1, label: 'Valve Upstream Press.' },
    { feature: 'FS1',  value: 15.8, label: 'Flow Rate (main)' },
    { feature: 'PS3',  value: 11.4, label: 'Back-Pressure' },
    { feature: 'FS2',  value: 8.6,  label: 'Downstream Flow' },
    { feature: 'PS4',  value: 4.3,  label: 'Acc. Pre-charge Effect' },
    { feature: 'EPS1', value: 3.1,  label: 'Motor Compensation' },
    { feature: 'TS2',  value: -2.4, label: 'System Temperature' },
    { feature: 'VS1',  value: -1.3, label: 'Vibration' },
  ],
  'accumulator-fail': [
    { feature: 'PS4',  value: 19.3, label: 'Pre-charge Pressure' },
    { feature: 'PS5',  value: 17.1, label: 'N₂ Bladder Pressure' },
    { feature: 'VS1',  value: 8.2,  label: 'Pressure Pulsation' },
    { feature: 'PS3',  value: 5.7,  label: 'System Back-Pressure' },
    { feature: 'FS1',  value: 4.1,  label: 'Flow Irregularity' },
    { feature: 'CP',   value: 3.3,  label: 'Cooling Power' },
    { feature: 'TS3',  value: -2.1, label: 'System Temperature' },
    { feature: 'EPS1', value: -1.5, label: 'Motor Power' },
  ],
};

interface ShapChartProps {
  scenario: string;
  confidence: number;
}

export default function ShapChart({ scenario, confidence }: ShapChartProps) {
  const data = SHAP_SCENARIOS[scenario];
  if (!data) return null;

  const maxAbs = Math.max(...data.map(d => Math.abs(d.value)));
  const confColor = confidence > 70 ? 'var(--status-critical)' : confidence > 40 ? 'var(--status-warning)' : 'var(--status-healthy)';

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius-md)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Feature Drivers — XGBoost SHAP
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.62rem', color: 'var(--text-muted)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, background: 'var(--status-critical)', borderRadius: 2 }} />
            ↑ fault
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, background: 'var(--status-healthy)', borderRadius: 2 }} />
            ↓ nominal
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: 1 }}>
        {data.map(({ feature, value, label }) => {
          const isPositive = value >= 0;
          const color = isPositive ? 'var(--status-critical)' : 'var(--status-healthy)';
          const pct = (Math.abs(value) / maxAbs) * 100;
          const opacity = 0.35 + (Math.abs(value) / maxAbs) * 0.65;

          return (
            <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 36, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, textAlign: 'right' }}>
                {feature}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </div>
                <div style={{ height: 7, background: 'var(--bg-primary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, opacity, borderRadius: 4, transition: 'width 0.6s ease' }} />
                </div>
              </div>
              <div style={{ width: 38, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>
                {value > 0 ? '+' : ''}{value.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        Confidence:&nbsp;
        <span style={{ color: confColor, fontWeight: 700 }}>{confidence}%</span>
        &nbsp;·&nbsp;ranked by |SHAP| magnitude
      </div>
    </div>
  );
}
