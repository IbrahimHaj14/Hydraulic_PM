import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

const fmt = (v: number | undefined) => {
  if (v === undefined) return '--';
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
};

export function ArcGauge({ value, min, max, label, unit, normal, size = 80 }: any) {
  const safeVal = value ?? 0;
  const pct = Math.max(0, Math.min(1, (safeVal - min) / (max - min)));
  const inNormal = safeVal >= normal[0] && safeVal <= normal[1];
  const col = inNormal ? 'var(--isa-green)' : safeVal < normal[0] * 0.85 ? 'var(--isa-red)' : 'var(--isa-amber)';
  const r = size / 2 - 8;
  const cx = size / 2, cy = size / 2 + 4;
  const startAngle = 220, sweep = 280;
  const endAngle = startAngle - sweep * pct;
  const toRad = (a: number) => (a * Math.PI) / 180;
  const arcX = (a: number) => cx + r * Math.cos(toRad(a));
  const arcY = (a: number) => cy - r * Math.sin(toRad(a));
  
  const d = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 ${sweep * pct > 180 ? 1 : 0} 0 ${arcX(endAngle)} ${arcY(endAngle)}`;
  const bgD = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${r} ${r} 0 1 0 ${arcX(startAngle - sweep + 0.01)} ${arcY(startAngle - sweep + 0.01)}`;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <svg width={size} height={size}>
        <path d={bgD} fill="none" stroke="var(--isa-border2)" strokeWidth={5} strokeLinecap="round" />
        {pct > 0.01 && (
          <path d={d} fill="none" stroke={col} strokeWidth={5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${col}88)` }} />
        )}
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={size * 0.18} fontWeight="700" fill={col} fontFamily="var(--font-mono)">
          {fmt(value)}
        </text>
        <text x={cx} y={cy + size * 0.15} textAnchor="middle" fontSize={size * 0.11} fill="var(--isa-text3)">
          {unit}
        </text>
      </svg>
      <span style={{ fontSize: 10, color: 'var(--isa-text2)', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}

export function BarMeter({ value, min, max, label, unit, normal, height = 60 }: any) {
  const safeVal = value ?? 0;
  const pct = Math.max(0, Math.min(100, ((safeVal - min) / (max - min)) * 100));
  const inNormal = safeVal >= normal[0] && safeVal <= normal[1];
  const col = inNormal ? 'var(--isa-green)' : safeVal < normal[0] * 0.85 ? 'var(--isa-red)' : 'var(--isa-amber)';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 44 }}>
      <span style={{ fontSize: 10, color: col, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
        {fmt(value)}
      </span>
      <div style={{ width: 20, height, background: 'var(--isa-border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{
            position: 'absolute', bottom: 0, width: '100%', height: `${pct}%`,
            background: col, transition: 'height 0.3s ease', borderRadius: 3,
            boxShadow: `0 0 6px ${col}66`
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: 'var(--isa-text3)', textAlign: 'center', lineHeight: 1.2 }}>
        {label}<br />
        <span style={{ color: 'var(--isa-text2)' }}>{unit}</span>
      </span>
    </div>
  );
}

export function Sparkline({ data, color }: any) {
  if (!data || data.length < 2) return null;
  const gradId = `sg-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} fill={`url(#${gradId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
