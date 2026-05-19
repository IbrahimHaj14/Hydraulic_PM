"use client";

import React, { useEffect, useState, useRef } from 'react';
import { ScadaSensors, ScadaHealth } from '@/lib/store';

interface PIDProps {
  sensors: ScadaSensors;
  health: ScadaHealth;
  scenarioKey: string;
}

const fmt = (v: number | undefined) => {
  if (v === undefined) return '--';
  return v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toString();
};

export default function ScadaPID({ sensors, health, scenarioKey }: PIDProps) {
  const t = useRef(0);
  const [dots, setDots] = useState<any[]>([]);
  
  const flowSpeed = health.pump > 60 ? 2.5 : health.pump > 30 ? 1.5 : 0.8;
  const scCol = scenarioKey === 'optimal' ? 'var(--isa-green)' : 'var(--isa-red)';
  const scShort = scenarioKey === 'optimal' ? 'NOMINAL' : 'FAULTED';

  const paths: Record<string, any> = {
    suction:  { d: "M 60 340 L 60 240", len: 100, col: 'var(--isa-oilDark)' },
    pressure: { d: "M 60 200 L 60 80 L 280 80", len: 260, col: 'var(--isa-oil)' },
    accum:    { d: "M 200 80 L 200 130", len: 50, col: 'var(--isa-oil)' },
    mainLine: { d: "M 280 80 L 380 80", len: 100, col: 'var(--isa-oil)' },
    valve:    { d: "M 380 80 L 380 180 L 320 180", len: 180, col: 'var(--isa-oil)' },
    return1:  { d: "M 320 180 L 120 180", len: 200, col: 'var(--isa-oilDark)' },
    cooler:   { d: "M 120 180 L 120 260", len: 80, col: 'var(--isa-oilDark)' },
    return2:  { d: "M 120 300 L 120 340 L 60 340", len: 90, col: 'var(--isa-oilDark)' },
  };

  useEffect(() => {
    const interval = setInterval(() => {
      t.current += flowSpeed;
      const speed = flowSpeed * 0.4;
      setDots(prev => {
        let next = prev.filter(d => d.progress < 1);
        if (Math.random() < 0.3) {
          const pathKeys = Object.keys(paths);
          const pk = pathKeys[Math.floor(Math.random() * pathKeys.length)];
          next.push({ id: Math.random(), pathKey: pk, progress: 0, col: paths[pk].col });
        }
        return next.map(d => ({ ...d, progress: d.progress + speed / paths[d.pathKey].len }));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [flowSpeed]);

  const interpolatePath = (key: string, p: number) => {
    const pts: Record<string, number[][]> = {
      suction:  [[60,340],[60,240]],
      pressure: [[60,200],[60,80],[280,80]],
      accum:    [[200,80],[200,130]],
      mainLine: [[280,80],[380,80]],
      valve:    [[380,80],[380,180],[320,180]],
      return1:  [[320,180],[120,180]],
      cooler:   [[120,180],[120,260]],
      return2:  [[120,260],[120,340],[60,340]],
    };
    const pts_ = pts[key];
    if (!pts_) return { x: 0, y: 0 };
    const totalLen = pts_.reduce((s, pt, i) => {
      if (i === 0) return s;
      const dx = pts_[i][0] - pts_[i-1][0], dy = pts_[i][1] - pts_[i-1][1];
      return s + Math.sqrt(dx*dx + dy*dy);
    }, 0);
    let target = p * totalLen;
    for (let i = 1; i < pts_.length; i++) {
      const dx = pts_[i][0] - pts_[i-1][0], dy = pts_[i][1] - pts_[i-1][1];
      const segLen = Math.sqrt(dx*dx + dy*dy);
      if (target <= segLen) {
        const t2 = target / segLen;
        return { x: pts_[i-1][0] + dx * t2, y: pts_[i-1][1] + dy * t2 };
      }
      target -= segLen;
    }
    return { x: pts_[pts_.length-1][0], y: pts_[pts_.length-1][1] };
  };

  const healthColor = (s: number) => s >= 75 ? 'var(--isa-green)' : s >= 40 ? 'var(--isa-amber)' : 'var(--isa-red)';

  return (
    <svg width="100%" viewBox="0 0 440 380" style={{ fontFamily: 'var(--font-mono)' }}>
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--isa-border)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      
      <rect width="440" height="380" fill="var(--isa-bg)" rx="8"/>
      <rect width="440" height="380" fill="url(#grid)" opacity="0.4" rx="8"/>

      {/* PIPES */}
      <path d="M 60 240 L 60 80 L 380 80" fill="none" stroke="var(--isa-border2)" strokeWidth={8} strokeLinecap="round"/>
      <path d="M 200 80 L 200 130" fill="none" stroke="var(--isa-border2)" strokeWidth={8} strokeLinecap="round"/>
      <path d="M 380 80 L 380 180 L 120 180" fill="none" stroke="var(--isa-border2)" strokeWidth={8} strokeLinecap="round"/>
      <path d="M 120 180 L 120 340 L 60 340 L 60 300" fill="none" stroke="var(--isa-border2)" strokeWidth={8} strokeLinecap="round"/>
      <path d="M 60 340 L 60 260" fill="none" stroke="var(--isa-border2)" strokeWidth={8} strokeLinecap="round"/>

      {/* Animated flow dots */}
      {dots.map(dot => {
        const pt = interpolatePath(dot.pathKey, dot.progress);
        if (!pt) return null;
        return <circle key={dot.id} cx={pt.x} cy={pt.y} r={3} fill={dot.col} opacity={0.9} style={{ filter: `drop-shadow(0 0 3px ${dot.col})` }}/>;
      })}

      {/* RESERVOIR */}
      <rect x={30} y={340} width={60} height={30} fill="var(--isa-panel2)" stroke="var(--isa-border2)" strokeWidth={1.5} rx={2}/>
      <rect x={38} y={346} width={44} height={18} fill="var(--isa-oilDark)" opacity={0.6} rx={1}/>
      <text x={60} y={375} textAnchor="middle" fill="var(--isa-text3)" fontSize={8}>RESERVOIR</text>

      {/* MOTOR */}
      <circle cx={60} cy={218} r={18} fill="var(--isa-panel2)" stroke="var(--isa-blue)" strokeWidth={1.5}/>
      <text x={60} y={222} textAnchor="middle" fill="var(--isa-blue)" fontSize={11} fontWeight="700">M</text>
      <text x={60} y={248} textAnchor="middle" fill="var(--isa-text3)" fontSize={7}>MOTOR</text>

      {/* PUMP */}
      <circle cx={60} cy={265} r={20} fill="var(--isa-panel2)" stroke={healthColor(health.pump)} strokeWidth={2}/>
      <path d="M 52 265 L 60 255 L 68 265" fill={healthColor(health.pump)} opacity={0.8}/>
      <path d="M 52 265 L 60 275 L 68 265" fill={healthColor(health.pump)} opacity={0.4}/>
      <text x={60} y={295} textAnchor="middle" fill={healthColor(health.pump)} fontSize={8} fontWeight="600">PUMP</text>
      <text x={60} y={304} textAnchor="middle" fill="var(--isa-text3)" fontSize={7}>{fmt(sensors?.PS1)}bar</text>

      {/* ACCUMULATOR */}
      <rect x={182} y={120} width={36} height={48} fill="var(--isa-panel2)" stroke={healthColor(health.accumulator)} strokeWidth={2} rx={4}/>
      <path d={`M 182 ${120+24*(1-health.accumulator/100)} L 218 ${120+24*(1-health.accumulator/100)} L 218 168 L 182 168 Z`} fill={healthColor(health.accumulator)} opacity={0.3}/>
      <line x1={182} x2={218} y1={144} y2={144} stroke="var(--isa-border2)" strokeWidth={1} strokeDasharray="3 2"/>
      <text x={200} y={180} textAnchor="middle" fill={healthColor(health.accumulator)} fontSize={8} fontWeight="600">ACCUM</text>
      <text x={200} y={189} textAnchor="middle" fill="var(--isa-text3)" fontSize={7}>{fmt(sensors?.PS4)}bar</text>

      {/* VALVE */}
      <rect x={360} y={155} width={40} height={40} fill="var(--isa-panel2)" stroke={healthColor(health.valve)} strokeWidth={2} rx={4}/>
      <path d="M 365 160 L 395 190 M 395 160 L 365 190" stroke={healthColor(health.valve)} strokeWidth={2} strokeLinecap="round" opacity={0.7}/>
      <line x1={380} x2={380} y1={145} y2={155} stroke={healthColor(health.valve)} strokeWidth={2}/>
      <text x={380} y={208} textAnchor="middle" fill={healthColor(health.valve)} fontSize={8} fontWeight="600">VALVE</text>
      <text x={380} y={217} textAnchor="middle" fill="var(--isa-text3)" fontSize={7}>{fmt(sensors?.FS1)} l/m</text>

      {/* COOLER */}
      <rect x={100} y={250} width={40} height={40} fill="var(--isa-panel2)" stroke={healthColor(health.cooler)} strokeWidth={2} rx={2}/>
      {[0,1,2,3].map(i => (
        <path key={i} d={`M ${104+i*8} 254 L ${104+i*8} 286`} stroke={healthColor(health.cooler)} strokeWidth={1.5} opacity={0.5}/>
      ))}
      <text x={120} y={305} textAnchor="middle" fill={healthColor(health.cooler)} fontSize={8} fontWeight="600">COOLER</text>
      <text x={120} y={314} textAnchor="middle" fill="var(--isa-text3)" fontSize={7}>{fmt(sensors?.TS1)}°C</text>

      {/* SENSOR LABELS */}
      {[
        { x: 90, y: 76, label: `PS1 ${fmt(sensors?.PS1)}` },
        { x: 290, y: 76, label: `PS6 ${fmt(sensors?.PS6)}` },
        { x: 290, y: 176, label: `PS2 ${fmt(sensors?.PS2)}` },
      ].map((s, i) => (
        <g key={i}>
          <rect x={s.x - 22} y={s.y - 9} width={44} height={14} fill="var(--isa-panel)" stroke="var(--isa-border2)" strokeWidth={0.5} rx={2}/>
          <text x={s.x} y={s.y} textAnchor="middle" fill="var(--isa-text2)" fontSize={7}>{s.label}</text>
        </g>
      ))}

      {/* SYSTEM STATUS BANNER */}
      <rect x={290} y={290} width={138} height={70} fill="var(--isa-panel)" stroke="var(--isa-border2)" strokeWidth={1} rx={6}/>
      <text x={359} y={305} textAnchor="middle" fill="var(--isa-text3)" fontSize={8} letterSpacing="0.1em">SYSTEM STATUS</text>
      <text x={359} y={328} textAnchor="middle" fill={scCol} fontSize={13} fontWeight="800" letterSpacing="0.05em">{scShort}</text>
      <text x={359} y={345} textAnchor="middle" fill="var(--isa-text2)" fontSize={8}>
        {`EPS1: ${fmt(sensors?.EPS1)}W`}
      </text>
      <text x={359} y={356} textAnchor="middle" fill="var(--isa-text2)" fontSize={8}>
        {`CE: ${fmt(sensors?.CE)}%  SE: ${fmt(sensors?.SE)}%`}
      </text>
    </svg>
  );
}
