"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, LayoutDashboard, GitGraph, FileText, Settings } from 'lucide-react';
import styles from './Sidebar.module.css';

const navItems = [
  { href: '/', icon: LayoutDashboard, label: 'Command Center' },
  { href: '/digital-twin', icon: GitGraph, label: 'Rig Digital Twin' },
  { href: '/rca', icon: Activity, label: 'RCA Console' },
  { href: '/work-orders', icon: FileText, label: 'Work Orders' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <Activity size={24} />
        HydroSense AI
      </div>
      <nav className={styles.nav}>
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`${styles.navItem} ${pathname === href ? styles.navItemActive : ''}`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
