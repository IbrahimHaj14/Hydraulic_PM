const { Aedes } = require('aedes');
const aedes = new Aedes();
const httpServer = require('http').createServer();
const ws = require('websocket-stream');

const PORT = 9001;

ws.createServer({ server: httpServer }, aedes.handle);

httpServer.listen(PORT, function () {
  console.log(`[Mock Brain] Aedes MQTT broker running on ws://localhost:${PORT}`);
});

let currentScenario = 'optimal';
let isRunning = false;
let tickCount = 0;

// Listen to commands from Next.js UI
aedes.on('publish', function (packet, client) {
  if (packet.topic === 'hydrosense/commands') {
    try {
      const payload = JSON.parse(packet.payload.toString());
      console.log(`[Mock Brain] Received Command:`, payload);
      
      if (payload.command === 'start') {
        isRunning = true;
        currentScenario = payload.scenario || 'optimal';
        tickCount = 0;
      } else if (payload.command === 'stop') {
        isRunning = false;
        currentScenario = 'optimal';
        tickCount = 0;
      }
    } catch (e) {
      console.error('[Mock Brain] Failed to parse command', e);
    }
  }
});

// ─── AI Inference Engine (Simulated) ─────────────────────────────────────────
// Computes per-component Asset Health Index (AHI), Remaining Useful Life (RUL),
// and Explainable AI (XAI) diagnostics from raw sensor telemetry.
// Architecture: Each component gets its own AHI based on sensors most relevant
// to its failure mode. System AHI = min(components) per series configuration.

function computePumpAHI(pumpRpm, coolerTemp) {
  // Pump health: 70% RPM efficiency + 30% fluid temp (seal integrity indicator)
  const rpmScore = Math.max(0, Math.min(100, ((pumpRpm - 1000) / (2400 - 1000)) * 100));
  const tempScore = Math.max(0, Math.min(100, ((80 - coolerTemp) / (80 - 45)) * 100));
  return Math.max(0, Math.min(100, Math.round(rpmScore * 0.70 + tempScore * 0.30)));
}

function computeValveAHI(valveOpen, pumpRpm) {
  // Valve health: 80% position accuracy + 20% pump compensation (indirect stress)
  const positionScore = Math.max(0, Math.min(100, valveOpen));
  const compensationScore = Math.max(0, Math.min(100, 100 - Math.abs(pumpRpm - 2400) / 10));
  return Math.max(0, Math.min(100, Math.round(positionScore * 0.80 + compensationScore * 0.20)));
}

function computeCoolerAHI(coolerTemp) {
  // Cooler health: 90% temp deviation from nominal + 10% stability margin
  const tempScore = Math.max(0, Math.min(100, ((80 - coolerTemp) / (80 - 45)) * 100));
  const stabilityScore = Math.max(0, Math.min(100, coolerTemp < 60 ? 100 : (80 - coolerTemp) / 20 * 100));
  return Math.max(0, Math.min(100, Math.round(tempScore * 0.90 + stabilityScore * 0.10)));
}

function computeAccumulatorAHI(accPressure) {
  // Accumulator health: 85% pre-charge pressure + 15% system stability
  const pressureScore = Math.max(0, Math.min(100, ((accPressure - 50) / (95 - 50)) * 100));
  const stabilityScore = Math.max(0, Math.min(100, accPressure > 70 ? 100 : (accPressure - 50) / 20 * 100));
  return Math.max(0, Math.min(100, Math.round(pressureScore * 0.85 + stabilityScore * 0.15)));
}

function computeRUL(ahi) {
  // RUL in hours, inversely proportional to AHI degradation
  if (ahi >= 90) return { value: 10000, unit: 'hrs', label: '>10,000 hrs' };
  if (ahi >= 75) return { value: 720, unit: 'hrs', label: '~720 hrs (30 days)' };
  if (ahi >= 60) return { value: 168, unit: 'hrs', label: '~168 hrs (7 days)' };
  if (ahi >= 45) return { value: 48, unit: 'hrs', label: '~48 hrs' };
  if (ahi >= 30) return { value: 12, unit: 'hrs', label: '~12 hrs' };
  return { value: 2, unit: 'hrs', label: 'CRITICAL: <2 hrs' };
}

function computeXAI(scenario, tickCount, pumpRpm, coolerTemp, valveOpen, accPressure) {
  // Explainable AI: confidence level + human-readable root cause
  const degradationProgress = Math.min(tickCount / 50, 1);
  const confidence = Math.round(60 + degradationProgress * 38); // 60-98%

  const insights = {
    'optimal': {
      confidence: 12,
      rootCause: 'No anomalies detected. All parameters within nominal operating envelope.',
      affectedSensor: 'None',
      recommendation: 'Continue standard monitoring schedule.',
    },
    'pump-leak': {
      confidence,
      rootCause: `Pump RPM dropped to ${Math.round(pumpRpm)} (nominal: 2400). Cooler temp rising to ${coolerTemp.toFixed(1)}°C indicates internal fluid bypass. Pattern matches hydraulic seal degradation fingerprint (ISO 4406:2021).`,
      affectedSensor: 'PS-101 (Pump Discharge Pressure), TS-201 (Fluid Temperature)',
      recommendation: 'Immediate inspection of pump mechanical seals. Prepare replacement seal kit P/N HYD-SEAL-4406.',
    },
    'valve-degrade': {
      confidence,
      rootCause: `Valve actuation at ${Math.round(valveOpen)}% (nominal: 100%). Pump RPM compensating at ${Math.round(pumpRpm)}. Spool erosion pattern detected per API 598 leakage classification.`,
      affectedSensor: 'VS-301 (Valve Position Sensor), PS-101 (Pump Discharge)',
      recommendation: 'Schedule valve spool replacement within RUL window. Cross-reference with last maintenance log.',
    },
    'accumulator-fail': {
      confidence,
      rootCause: `Accumulator pre-charge at ${accPressure.toFixed(1)} PSI (nominal: 90 PSI). Nitrogen bladder integrity compromised. Failure mode consistent with fatigue cracking per ASME PCC-2.`,
      affectedSensor: 'PS-401 (Accumulator Pressure Transducer)',
      recommendation: 'Isolate accumulator. Perform nitrogen pre-charge test per OEM spec. Replace bladder if delta-P > 5 PSI.',
    },
  };

  return insights[scenario] || insights['optimal'];
}

// ─── Telemetry Generator Loop (10Hz = 100ms) ────────────────────────────────
setInterval(() => {
  if (!isRunning) return;

  tickCount++;

  let pumpRpm = 2400 + (Math.random() * 50 - 25);
  let coolerTemp = 50 + (Math.random() * 2 - 1);
  let valveOpen = 100;
  let accPressure = 90 + (Math.random() * 2 - 1);

  // Apply scenario degradation
  if (currentScenario === 'pump-leak') {
    pumpRpm -= tickCount * 2;
    coolerTemp += tickCount * 0.05;
  } else if (currentScenario === 'valve-degrade') {
    valveOpen -= tickCount * 0.15;
    pumpRpm += tickCount * 0.5;
  } else if (currentScenario === 'accumulator-fail') {
    accPressure -= tickCount * 0.12;
  }

  // Clamp values to physically meaningful ranges
  pumpRpm = Math.max(0, pumpRpm);
  coolerTemp = Math.max(20, coolerTemp);
  valveOpen = Math.max(0, Math.min(100, valveOpen));
  accPressure = Math.max(0, accPressure);

  // Compute per-component AI metrics
  const pumpAhi = computePumpAHI(pumpRpm, coolerTemp);
  const valveAhi = computeValveAHI(valveOpen, pumpRpm);
  const coolerAhi = computeCoolerAHI(coolerTemp);
  const accAhi = computeAccumulatorAHI(accPressure);

  // System AHI = min(components) — series configuration (weakest link)
  const systemAhi = Math.min(pumpAhi, valveAhi, coolerAhi, accAhi);

  const xai = computeXAI(currentScenario, tickCount, pumpRpm, coolerTemp, valveOpen, accPressure);

  const telemetry = {
    timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 1 }),
    pumpRpm: Math.round(pumpRpm),
    coolerTemp: Math.round(coolerTemp * 10) / 10,
    valveOpen: Math.max(0, Math.round(valveOpen)),
    accPressure: Math.round(accPressure * 10) / 10,
    // Enterprise PdM Metrics — per-component
    systemAhi,
    components: {
      pump:        { ahi: pumpAhi,   rul: computeRUL(pumpAhi) },
      valve:       { ahi: valveAhi,  rul: computeRUL(valveAhi) },
      cooler:      { ahi: coolerAhi, rul: computeRUL(coolerAhi) },
      accumulator: { ahi: accAhi,    rul: computeRUL(accAhi) },
    },
    xai,
    // Legacy (kept for backward compat)
    ahi: systemAhi,
    rul: computeRUL(systemAhi),
  };

  aedes.publish({
    topic: 'hydrosense/telemetry/live',
    payload: JSON.stringify(telemetry),
    qos: 0,
    retain: false
  });

}, 100);
