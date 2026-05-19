import React, { Suspense } from 'react';
import RcaConsole from '@/features/rca/RcaConsole';

export default function RcaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 'var(--space-xl)', color: 'var(--text-primary)' }}>Loading RCA Console...</div>}>
      <RcaConsole />
    </Suspense>
  );
}
