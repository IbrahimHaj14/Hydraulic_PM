import React from 'react';
import styles from './DashboardLayout.module.css';
import Sidebar from '../Sidebar/Sidebar';
import Topbar from '../Topbar/Topbar';
import SimulationEngine from '../../SimulationEngine';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className={styles.container}>
      <SimulationEngine />
      <Sidebar />
      <div className={styles.mainContent}>
        <Topbar />
        <main className={styles.scrollArea}>
          {children}
        </main>
      </div>
    </div>
  );
}
