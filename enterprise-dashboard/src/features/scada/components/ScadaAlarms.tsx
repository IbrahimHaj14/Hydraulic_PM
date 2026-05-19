"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSimulationStore } from '@/lib/store';
import { Sparkline } from './ScadaWidgets';

export function ScadaAlarms() {
  const router = useRouter();
  const { alarms, ackAlarm, ackAllAlarms } = useSimulationStore();
  const activeAlarms = alarms.filter(a => !a.acked);

  const handleRowClick = (component: string) => {
    router.push(`/rca?component=${component}`);
  };

  return (
    <div style={{ background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: 10, flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--isa-text3)', letterSpacing: '0.1em' }}>ALARM PANEL</span>
          {activeAlarms.length > 0 && (
            <span style={{ background: 'var(--isa-red)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
              {activeAlarms.length}
            </span>
          )}
        </div>
        {activeAlarms.length > 0 && (
          <button onClick={() => ackAllAlarms()} style={{ background: 'transparent', color: 'var(--isa-text3)', border: '1px solid var(--isa-border2)', borderRadius: 4, padding: '2px 7px', fontSize: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
            ACK ALL
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
        {alarms.length === 0 && (
          <div style={{ color: 'var(--isa-green)', fontSize: 10, padding: '8px 4px', textAlign: 'center' }}>
            ✓ No active alarms
          </div>
        )}
        {alarms.map(a => {
          const col = a.priority === 'CRIT' ? 'var(--isa-red)' : 'var(--isa-amber)';
          return (
            <div
              key={a.id}
              onClick={() => handleRowClick(a.component)}
              title={`Click to inspect ${a.component.toUpperCase()} in RCA Console`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: a.acked ? 'var(--isa-panel2)' : `${col}11`,
                border: `1px solid ${a.acked ? 'var(--isa-border)' : col}44`,
                borderRadius: 5, padding: '5px 7px', opacity: a.acked ? 0.5 : 1,
                cursor: 'pointer',
                transition: 'background 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = a.acked ? 'var(--isa-panel2)' : `${col}22`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = a.acked ? 'var(--isa-panel2)' : `${col}11`; }}
            >
              <span style={{ width: 36, fontSize: 8, fontWeight: 700, color: col, flexShrink: 0 }}>{a.priority}</span>
              <span style={{ flex: 1, fontSize: 9, color: a.acked ? 'var(--isa-text3)' : 'var(--isa-text)', lineHeight: 1.3 }}>{a.msg}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 8, color: 'var(--isa-text3)' }}>{a.time}</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  {!a.acked && (
                    <button
                      onClick={e => { e.stopPropagation(); ackAlarm(a.id); }}
                      style={{ background: 'transparent', color: 'var(--isa-text3)', border: '1px solid var(--isa-border)', borderRadius: 3, padding: '1px 5px', fontSize: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}
                    >
                      ACK
                    </button>
                  )}
                  <span style={{ fontSize: 8, color: col, fontWeight: 700, letterSpacing: '0.04em', opacity: 0.8 }}>
                    RCA →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HealthCard({ name, icon, score, history, predicted }: any) {
  const col = score >= 75 ? 'var(--isa-green)' : score >= 40 ? 'var(--isa-amber)' : 'var(--isa-red)';
  const label = score >= 75 ? 'NOMINAL' : score >= 40 ? 'CAUTION' : 'CRITICAL';
  const sparkData = history.map((v: number) => ({ v }));

  return (
    <div style={{ background: 'var(--isa-panel2)', border: `1.5px solid ${col}44`, borderRadius: 10, padding: '10px 12px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: col, boxShadow: `0 0 8px ${col}` }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--isa-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{name}</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: col, background: `${col}22`, padding: '1px 6px', borderRadius: 999, border: `1px solid ${col}44` }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: col, fontFamily: 'var(--font-mono)', lineHeight: 1, textShadow: `0 0 12px ${col}66` }}>
          {score}
        </span>
        <span style={{ fontSize: 11, color: 'var(--isa-text3)' }}>/100</span>
      </div>
      <Sparkline data={sparkData} color={col} />
      {predicted && (
        <div style={{ fontSize: 9, color: 'var(--isa-text2)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
          MODEL → <span style={{ color: col }}>{predicted}</span>
        </div>
      )}
    </div>
  );
}
