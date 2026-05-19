"use client";

import React from 'react';
import { ArcGauge, BarMeter } from './ScadaWidgets';
import { ScadaSensors } from '@/lib/store';

const SENSORS = {
  PS1: { min: 0, max: 250, normal: [140, 165] },
  PS2: { min: 0, max: 200, normal: [120, 145] },
  PS3: { min: 0, max: 10, normal: [2, 4] },
  PS4: { min: 0, max: 20, normal: [7, 9] },
  PS5: { min: 0, max: 20, normal: [8, 10] },
  PS6: { min: 0, max: 250, normal: [140, 165] },
  FS1: { min: 0, max: 25, normal: [10, 13] },
  FS2: { min: 0, max: 20, normal: [8, 10] },
  TS1: { min: 20, max: 90, normal: [35, 42] },
  TS2: { min: 20, max: 90, normal: [38, 46] },
  TS3: { min: 20, max: 90, normal: [36, 44] },
  TS4: { min: 20, max: 80, normal: [30, 38] },
  VS1: { min: 0, max: 3, normal: [0.2, 0.7] },
  CE: { min: 0, max: 100, normal: [90, 100] },
  SE: { min: 0, max: 100, normal: [88, 98] },
};

const fmt = (v: number | undefined) => {
  if (v === undefined) return '--';
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
};

export default function ScadaSensorPanel({ sensors }: { sensors: ScadaSensors }) {
  if (!sensors) return null;

  return (
    <div style={{ background: 'var(--isa-panel)', border: '1px solid var(--isa-border)', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 9, color: 'var(--isa-text3)', letterSpacing: '0.1em', marginBottom: 8 }}>
        LIVE SENSOR READINGS — 17 CHANNELS
      </div>

      {/* Pressure gauges */}
      <div style={{ fontSize: 8, color: 'var(--isa-text3)', marginBottom: 6, letterSpacing: '0.06em' }}>
        PRESSURE (bar) · 100 Hz
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        {(['PS1', 'PS2', 'PS3', 'PS4', 'PS5', 'PS6'] as const).map(k => (
          <ArcGauge key={k} value={sensors[k]} min={SENSORS[k].min} max={SENSORS[k].max} label={k} unit="bar" normal={SENSORS[k].normal} size={72} />
        ))}
      </div>

      {/* Power */}
      <div style={{ fontSize: 8, color: 'var(--isa-text3)', marginBottom: 6, letterSpacing: '0.06em' }}>
        MOTOR POWER (W) · 100 Hz
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--isa-panel2)', borderRadius: 6, padding: '6px 10px' }}>
          <span style={{ fontSize: 9, color: 'var(--isa-text2)' }}>EPS1</span>
          <div style={{ flex: 1, height: 8, background: 'var(--isa-border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4, transition: 'width 0.3s',
              width: `${(sensors.EPS1 / 4000) * 100}%`,
              background: sensors.EPS1 > 2600 ? 'var(--isa-red)' : sensors.EPS1 > 2300 ? 'var(--isa-amber)' : 'var(--isa-green)',
              boxShadow: `0 0 6px ${sensors.EPS1 > 2600 ? 'var(--isa-red)' : 'var(--isa-green)'}66`
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--isa-text)', fontFamily: 'var(--font-mono)', minWidth: 50, textAlign: 'right' }}>
            {Math.round(sensors.EPS1)}W
          </span>
        </div>
      </div>

      {/* Flow */}
      <div style={{ fontSize: 8, color: 'var(--isa-text3)', marginBottom: 6, letterSpacing: '0.06em' }}>
        FLOW (l/min) · 10 Hz
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 10 }}>
        <BarMeter value={sensors.FS1} min={0} max={25} label="FS1" unit="l/m" normal={SENSORS.FS1.normal} height={55} />
        <BarMeter value={sensors.FS2} min={0} max={20} label="FS2" unit="l/m" normal={SENSORS.FS2.normal} height={55} />
      </div>

      {/* Temperature */}
      <div style={{ fontSize: 8, color: 'var(--isa-text3)', marginBottom: 6, letterSpacing: '0.06em' }}>
        TEMPERATURE (°C) · 1 Hz
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, marginBottom: 10 }}>
        {(['TS1', 'TS2', 'TS3', 'TS4'] as const).map(k => {
          const inNorm = sensors[k] >= SENSORS[k].normal[0] && sensors[k] <= SENSORS[k].normal[1];
          const col = inNorm ? 'var(--isa-green)' : sensors[k] > SENSORS[k].normal[1] ? 'var(--isa-red)' : 'var(--isa-amber)';
          return (
            <div key={k} style={{ background: 'var(--isa-panel2)', borderRadius: 5, padding: '5px', textAlign: 'center', border: `1px solid ${col}33` }}>
              <div style={{ fontSize: 8, color: 'var(--isa-text3)' }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)' }}>{fmt(sensors[k])}</div>
              <div style={{ fontSize: 8, color: 'var(--isa-text3)' }}>°C</div>
            </div>
          );
        })}
      </div>

      {/* Misc */}
      <div style={{ fontSize: 8, color: 'var(--isa-text3)', marginBottom: 6, letterSpacing: '0.06em' }}>
        SYSTEM SENSORS · 1 Hz
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 5 }}>
        {(['VS1', 'CE', 'SE'] as const).map(k => {
          const inNorm = sensors[k] >= SENSORS[k].normal[0] && sensors[k] <= SENSORS[k].normal[1];
          const col = inNorm ? 'var(--isa-green)' : 'var(--isa-red)';
          const labels = { VS1: 'VIBRATION', CE: 'COOL EFF', SE: 'SYS EFF' };
          const units = { VS1: 'mm/s', CE: '%', SE: '%' };
          return (
            <div key={k} style={{ background: 'var(--isa-panel2)', borderRadius: 5, padding: '5px', textAlign: 'center', border: `1px solid ${col}33` }}>
              <div style={{ fontSize: 8, color: 'var(--isa-text3)' }}>{labels[k]}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)' }}>{fmt(sensors[k])}</div>
              <div style={{ fontSize: 8, color: 'var(--isa-text3)' }}>{units[k]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
