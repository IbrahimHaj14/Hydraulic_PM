import React from 'react';
import styles from './Node.module.css';

interface SchematicNodeProps {
  label: string;
  icon: React.ReactNode;
  status: 'healthy' | 'warning' | 'critical' | 'idle';
  position: { top: string; left: string };
  telemetry?: string;
  ahi?: number;
  rul?: string;
  onClick?: () => void;
}

export default function SchematicNode({ label, icon, status, position, telemetry, ahi, rul, onClick }: SchematicNodeProps) {
  // Map 'idle' to no specific style class, default border
  const statusClass = status === 'idle' ? '' : styles[status];

  const getAhiColor = (value: number) => {
    if (value >= 75) return 'var(--status-healthy)';
    if (value >= 45) return 'var(--status-warning)';
    return 'var(--status-critical)';
  };

  return (
    <div 
      className={`${styles.node} ${statusClass} ${onClick ? styles.clickable : ''}`} 
      style={{ top: position.top, left: position.left }}
      onClick={onClick}
    >
      {telemetry && <div className={styles.telemetryBadge}>{telemetry}</div>}
      <div className={styles.iconWrapper}>
        {icon}
      </div>
      <div className={styles.label}>
        {label}
      </div>
      {/* Enterprise PdM Metrics */}
      {ahi !== undefined && (
        <div className={styles.ahiBar}>
          <div className={styles.ahiLabel}>
            <span>AHI</span>
            <span style={{ color: getAhiColor(ahi) }}>{ahi}%</span>
          </div>
          <div className={styles.ahiTrack}>
            <div 
              className={styles.ahiFill} 
              style={{ 
                width: `${ahi}%`, 
                backgroundColor: getAhiColor(ahi),
              }} 
            />
          </div>
        </div>
      )}
      {rul && (
        <div className={styles.rulBadge}>
          ⏱ RUL: {rul}
        </div>
      )}
    </div>
  );
}
