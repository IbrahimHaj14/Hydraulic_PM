import React from 'react';
import { Settings, Server, Bell, Shield } from 'lucide-react';

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column' as const, gap: '1.5rem', maxWidth: '800px' },
  header: { display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', color: 'var(--text-primary)' },
  section: { background: 'var(--bg-secondary)', borderRadius: 'var(--border-radius-md)', padding: '1.5rem', border: '1px solid var(--border-color)', marginBottom: '1rem' },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.125rem', color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', color: 'var(--text-secondary)' },
  input: { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', width: '250px' },
  toggle: { width: '40px', height: '20px', background: 'var(--accent-primary)', borderRadius: '10px', position: 'relative' as const },
  toggleKnob: { width: '16px', height: '16px', background: '#fff', borderRadius: '50%', position: 'absolute' as const, right: '2px', top: '2px' }
};

export default function SettingsPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Settings size={28} color="var(--accent-primary)" />
        System Settings
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}><Server size={18} /> MQTT Broker Configuration</div>
        <div style={styles.row}>
          <span>Broker WebSocket URL</span>
          <input style={styles.input} defaultValue="ws://localhost:9001" readOnly />
        </div>
        <div style={styles.row}>
          <span>Telemetry Topic</span>
          <input style={styles.input} defaultValue="hydrosense/telemetry/live" readOnly />
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}><Bell size={18} /> Alert Preferences</div>
        <div style={styles.row}>
          <span>Push Notifications for CRITICAL alerts</span>
          <div style={styles.toggle}><div style={styles.toggleKnob} /></div>
        </div>
        <div style={styles.row}>
          <span>Email Maintenance Reports</span>
          <div style={styles.toggle}><div style={styles.toggleKnob} /></div>
        </div>
      </div>
    </div>
  );
}
