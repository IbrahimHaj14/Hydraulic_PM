"use client";

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import styles from './TelemetryChart.module.css';

interface TelemetryChartProps {
  title: string;
  dataKey: string;
  forecastDataKey?: string; // New prop for predictive forecast
  data: any[];
  color: string;
  unit: string;
  syncId?: string;
  currentValue?: number | string;
  eventTimestamp?: string;
  enableBrush?: boolean; // New prop for time-brush zooming
}

export default function TelemetryChart({ 
  title, 
  dataKey, 
  forecastDataKey,
  data, 
  color, 
  unit, 
  syncId = "rca-sync",
  currentValue,
  eventTimestamp,
  enableBrush = false
}: TelemetryChartProps) {

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={styles.customTooltip}>
          <div className={styles.tooltipLabel}>{label}</div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className={styles.tooltipValue} style={{ color: entry.color, marginTop: '2px' }}>
              {entry.name === forecastDataKey ? 'AI Forecast: ' : 'Actual: '} 
              {entry.value} {unit}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <div className={styles.chartTitle}>{title}</div>
        <div className={styles.valueIndicator}>
          {currentValue !== undefined ? `${currentValue} ${unit}` : '--'}
        </div>
      </div>
      <div className={styles.chartBody}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId={syncId} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis 
              dataKey="timestamp" 
              stroke="var(--text-muted)" 
              fontSize={12} 
              tickMargin={10}
              minTickGap={30}
            />
            <YAxis 
              stroke="var(--text-muted)" 
              fontSize={12} 
              domain={['auto', 'auto']}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '5 5' }} />
            
            {eventTimestamp && (
              <ReferenceLine 
                x={eventTimestamp} 
                stroke="var(--status-warning)" 
                strokeDasharray="3 3"
                label={{ position: 'top', value: 'Anomaly Injected', fill: 'var(--status-warning)', fontSize: 10 }}
              />
            )}

            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: color, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls={true}
            />

            {/* Predictive Forecast Line */}
            {forecastDataKey && (
              <Line 
                type="monotone" 
                dataKey={forecastDataKey} 
                stroke={color} 
                strokeWidth={2}
                strokeDasharray="5 5" 
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                connectNulls={true}
              />
            )}

            {/* Interactive Time-Brush Zooming */}
            {enableBrush && (
              <Brush 
                dataKey="timestamp" 
                height={20} 
                stroke="var(--text-muted)" 
                fill="var(--bg-secondary)"
                tickFormatter={() => ''}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
