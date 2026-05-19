"use client";

import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineCardProps {
  title: string;
  dataKey: string;
  data: any[];
  color: string;
  unit: string;
  currentValue?: number;
  isHealthy?: boolean;
}

export default function SparklineCard({ title, dataKey, data, color, unit, currentValue, isHealthy = true }: SparklineCardProps) {
  const actualData = data.filter(d => d[dataKey] !== null && d[dataKey] !== undefined);
  const statusColor = isHealthy ? 'var(--status-healthy)' : 'var(--status-warning)';

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${isHealthy ? 'var(--border-color)' : 'rgba(255,170,0,0.25)'}`,
      borderRadius: 'var(--border-radius-md)',
      padding: '0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {title}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
            {currentValue !== undefined ? (typeof currentValue === 'number' ? currentValue.toFixed(1) : currentValue) : '--'}
            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>{unit}</span>
          </div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, marginTop: 3, flexShrink: 0 }} />
      </div>
      <div style={{ height: 44 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={actualData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <YAxis domain={['auto', 'auto']} hide />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={isHealthy ? color : 'var(--status-warning)'}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: '0.6rem', color: statusColor, fontWeight: 600, letterSpacing: '0.05em' }}>
        {isHealthy ? '● NOMINAL' : '● MONITORING'}
      </div>
    </div>
  );
}
