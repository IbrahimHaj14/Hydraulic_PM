"use client";

import { useSimulationStore } from '@/lib/store';
import ScadaPID from '../scada/components/ScadaPID';
import ScadaSensorPanel from '../scada/components/ScadaSensorPanel';
import { ScadaAlarms, HealthCard } from '../scada/components/ScadaAlarms';

export default function CommandCenter() {
  const { isRunning, toggleSimulation, scenario, setScenario, telemetry, telemetryHistory, uptime, cycle, latency, resetSimulation, logs } = useSimulationStore();

  const scadaSensors = telemetry?.scadaSensors;
  const scadaHealth = telemetry?.scadaHealth;

  const fmtUptime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const activeAlarms = useSimulationStore(state => state.alarms).filter(a => !a.acked);
  const overallHealth = telemetry?.systemAhi ?? 100;
  
  const compMeta = [
    { key: 'cooler', icon: '❄️', label: 'COOLER', pred: scadaHealth && scadaHealth.cooler >= 75 ? 'full efficiency' : scadaHealth && scadaHealth.cooler >= 40 ? 'reduced efficiency' : 'near failure' },
    { key: 'valve', icon: '🔧', label: 'VALVE', pred: scadaHealth && scadaHealth.valve >= 75 ? 'optimal' : scadaHealth && scadaHealth.valve >= 40 ? 'small lag' : 'near failure' },
    { key: 'pump', icon: '💧', label: 'PUMP', pred: scadaHealth && scadaHealth.pump >= 75 ? 'no leakage' : scadaHealth && scadaHealth.pump >= 40 ? 'weak leakage' : 'severe leakage' },
    { key: 'accumulator', icon: '🔋', label: 'ACCUMULATOR', pred: scadaHealth && scadaHealth.accumulator >= 75 ? 'optimal' : scadaHealth && scadaHealth.accumulator >= 40 ? 'slightly reduced' : 'near failure' },
  ];

  return (
    <div style={{ background: 'var(--isa-bg)', minHeight: '100%', padding: 12, color: 'var(--isa-text)', fontFamily: 'var(--font-mono)' }}>
      {/* ── TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: '8px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: isRunning ? 'var(--isa-green)' : 'var(--isa-amber)', boxShadow: `0 0 8px ${isRunning ? 'var(--isa-green)' : 'var(--isa-amber)'}` }} />
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', color: 'var(--isa-text)' }}>
            HYDROSENSE AI
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {/* KPI strip */}
        {[
          { label: 'OVERALL HEALTH', value: `${overallHealth}%`, col: overallHealth >= 75 ? 'var(--isa-green)' : overallHealth >= 40 ? 'var(--isa-amber)' : 'var(--isa-red)' },
          { label: 'CYCLE', value: cycle, col: 'var(--isa-cyan)' },
          { label: 'UPTIME', value: fmtUptime(uptime), col: 'var(--isa-text2)' },
          { label: 'LATENCY', value: `${latency}ms`, col: 'var(--isa-blue)' },
          { label: 'ALARMS', value: activeAlarms.length, col: activeAlarms.length > 0 ? 'var(--isa-red)' : 'var(--isa-green)' },
        ].map(k => (
          <div key={k.label} style={{ textAlign: 'center', padding: '0 10px', borderLeft: '1px solid var(--isa-border)' }}>
            <div style={{ fontSize: 8, color: 'var(--isa-text3)', letterSpacing: '0.08em' }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: k.col, lineHeight: 1.2 }}>{k.value}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginLeft: 8, alignItems: 'center' }}>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            style={{ background: 'var(--isa-panel2)', color: 'var(--isa-text2)', border: '1px solid var(--isa-border)', borderRadius: 5, padding: '4px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
          >
            <option value="optimal">NOMINAL</option>
            <option value="pump-leak">FAULT: Pump Leak</option>
            <option value="valve-degrade">FAULT: Valve Degrade</option>
            <option value="accumulator-fail">FAULT: Accumulator</option>
          </select>
          <button onClick={resetSimulation} style={{ background: 'var(--isa-panel2)', color: 'var(--isa-text3)', border: '1px solid var(--isa-border)', borderRadius: 5, padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 700 }}>
            RESET
          </button>
          <button onClick={toggleSimulation} style={{ background: isRunning ? 'var(--isa-amberDim)' : 'var(--isa-greenDim)', color: isRunning ? 'var(--isa-amber)' : 'var(--isa-green)', border: `1px solid ${isRunning ? 'var(--isa-amber)' : 'var(--isa-green)'}44`, borderRadius: 5, padding: '4px 10px', fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 700 }}>
            {isRunning ? '⏸ PAUSE' : '▶ RUN'}
          </button>
        </div>
      </div>

      {/* ── MAIN 3-COLUMN GRID */}
      {scadaSensors && scadaHealth && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 10, marginBottom: 10 }}>
          {/* LEFT: P&ID DIAGRAM */}
          <div style={{ background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: '10px 8px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 9, color: 'var(--isa-text3)', letterSpacing: '0.1em', marginBottom: 6, textAlign: 'center' }}>P&ID HYDRAULIC CIRCUIT</div>
            <ScadaPID sensors={scadaSensors} health={scadaHealth} scenarioKey={scenario} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 'auto' }}>
              {compMeta.map(c => {
                const hVal = scadaHealth[c.key as keyof typeof scadaHealth];
                const col = hVal >= 75 ? 'var(--isa-green)' : hVal >= 40 ? 'var(--isa-amber)' : 'var(--isa-red)';
                return (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--isa-panel2)', borderRadius: 4, padding: '4px 6px', border: `1px solid ${col}33` }}>
                    <span style={{ fontSize: 12 }}>{c.icon}</span>
                    <div>
                      <div style={{ fontSize: 8, color: 'var(--isa-text3)' }}>{c.label}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: col }}>{Math.round(hVal)}/100</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER: SENSOR READINGS */}
          <ScadaSensorPanel sensors={scadaSensors} />

          {/* RIGHT: HEALTH CARDS + ALARMS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 9, color: 'var(--isa-text3)', letterSpacing: '0.1em', marginBottom: 8 }}>
                COMPONENT HEALTH — XGBoost
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {compMeta.map(c => (
                  <HealthCard key={c.key} name={c.label} icon={c.icon} score={Math.round(scadaHealth[c.key as keyof typeof scadaHealth])} history={telemetryHistory.map(t => t.scadaHealth?.[c.key as keyof typeof scadaHealth] || 100)} predicted={c.pred} />
                ))}
              </div>
            </div>

            <ScadaAlarms />

            {/* ── SYSTEM EVENT LOG */}
            <div style={{ background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: 'var(--isa-text3)', letterSpacing: '0.1em' }}>
                  SYSTEM EVENT LOG
                </span>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: isRunning ? 'var(--isa-green)' : 'var(--isa-amber)', boxShadow: `0 0 6px ${isRunning ? 'var(--isa-green)' : 'var(--isa-amber)'}` }} />
                <span style={{ fontSize: 9, color: isRunning ? 'var(--isa-green)' : 'var(--isa-amber)' }}>
                  {isRunning ? 'RECORDING' : 'PAUSED'}
                </span>
              </div>
              <div style={{ height: 110, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {logs.map(entry => {
                  const col = entry.level === 'ERROR' ? 'var(--isa-red)' : entry.level === 'WARN' ? 'var(--isa-amber)' : 'var(--isa-text3)';
                  const bg = entry.level === 'ERROR' ? 'var(--isa-redDim)22' : entry.level === 'WARN' ? 'var(--isa-amberDim)22' : 'transparent';
                  return (
                    <div key={entry.id} style={{ display: 'flex', gap: 8, fontSize: 10, padding: '2px 4px', background: bg, borderRadius: 3, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--isa-text3)', flexShrink: 0, fontSize: 9 }}>{entry.time}</span>
                      <span style={{ color: col, width: 40, flexShrink: 0, fontWeight: 600, fontSize: 9 }}>
                        {entry.level}
                      </span>
                      <span style={{ color: 'var(--isa-text2)', lineHeight: 1.4 }}>{entry.msg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
