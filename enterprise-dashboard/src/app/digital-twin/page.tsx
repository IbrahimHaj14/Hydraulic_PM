"use client";

import dynamic from 'next/dynamic';

const DigitalTwin = dynamic(() => import('@/features/digital-twin/DigitalTwin'), { ssr: false });

export default function DigitalTwinPage() {
  return (
    <div style={{ height: '100%', width: '100%', padding: 0, margin: 0 }}>
      <DigitalTwin />
    </div>
  );
}
