"use client";

import { FileText, CheckCircle2, Clock } from 'lucide-react';
import { useSimulationStore } from '@/lib/store';

// We'll use inline styles here for simplicity, but in a real app, use CSS modules
const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', color: 'var(--text-primary)' },
  tableContainer: { background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)', padding: '1.5rem', border: '1px solid var(--border-color)', flex: 1 },
  table: { width: '100%', borderCollapse: 'collapse' as const, textAlign: 'left' as const },
  th: { padding: '1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 500 },
  td: { padding: '1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' },
  badgeStatus: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem' },
  badgeOpen: { background: 'rgba(250, 173, 20, 0.1)', color: 'var(--status-warning)' },
  badgeDone: { background: 'rgba(82, 196, 26, 0.1)', color: 'var(--status-healthy)' },
  badgeCritical: { background: 'rgba(245, 34, 45, 0.1)', color: 'var(--status-critical)' },
};

export default function WorkOrdersPage() {
  const { isRunning, scenario } = useSimulationStore();
  
  // Create a dynamic list combining past and real-time generated orders
  const orders = [
    { id: 'WO-1049', asset: 'Cooling Unit A', issue: 'Radiator Fin Cleaning', date: '2026-05-15', status: 'completed' },
    { id: 'WO-1050', asset: 'Main Hydraulic Pump', issue: 'Routine Filter Replacement', date: '2026-05-16', status: 'completed' },
    { id: 'WO-1051', asset: 'Control Valve', issue: 'Seal Inspection', date: '2026-05-17', status: 'open' },
  ];

  // If simulation is running a scenario, dynamically inject a work order for it
  if (isRunning && scenario !== 'optimal') {
    orders.unshift({
      id: 'WO-1052',
      asset: scenario === 'pump-leak' ? 'Main Hydraulic Pump' : scenario === 'valve-degrade' ? 'Control Valve' : 'Accumulator',
      issue: `AI Prediction: Fix ${scenario.replace('-', ' ')}`,
      date: 'Just Now',
      status: 'critical'
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <FileText size={28} color="var(--accent-primary)" />
        Active Work Orders
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Order ID</th>
              <th style={styles.th}>Asset</th>
              <th style={styles.th}>Predicted Issue</th>
              <th style={styles.th}>Date Logged</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ ...styles.td, fontWeight: 600 }}>{o.id}</td>
                <td style={styles.td}>{o.asset}</td>
                <td style={styles.td}>{o.issue}</td>
                <td style={styles.td}>{o.date}</td>
                <td style={styles.td}>
                  {o.status === 'completed' && <span style={{ ...styles.badgeStatus, ...styles.badgeDone }}><CheckCircle2 size={14} /> Completed</span>}
                  {o.status === 'open' && <span style={{ ...styles.badgeStatus, ...styles.badgeOpen }}><Clock size={14} /> Scheduled</span>}
                  {o.status === 'critical' && <span style={{ ...styles.badgeStatus, ...styles.badgeCritical }}><Clock size={14} /> Immediate Action</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
