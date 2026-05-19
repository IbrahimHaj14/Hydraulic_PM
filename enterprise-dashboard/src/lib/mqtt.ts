"use client";

import { useEffect, useRef } from 'react';
import mqtt from 'mqtt';
import { useSimulationStore, TelemetryData } from './store';

const MQTT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_URL || 'ws://localhost:9001';
const TELEMETRY_TOPIC = 'hydrosense/telemetry/live';
const COMMAND_TOPIC = 'hydrosense/commands';

export function useMqtt() {
  const { setMqttConnected, updateTelemetry, isRunning, scenario } = useSimulationStore();
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  
  // Throttling state
  const lastUpdateRef = useRef<number>(0);
  const THROTTLE_MS = 100; // 10Hz UI refresh rate

  useEffect(() => {
    // Connect to Mosquitto via WebSockets
    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId: `hydrosense_web_${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 5000,
    });

    clientRef.current = client;

    client.on('connect', () => {
      console.log('Connected to MQTT Broker via WebSockets');
      setMqttConnected(true);
      
      // Subscribe with QoS 0 for high-frequency telemetry
      client.subscribe(TELEMETRY_TOPIC, { qos: 0 });
    });

    client.on('message', (topic, message) => {
      if (topic === TELEMETRY_TOPIC) {
        // Implement Throttling (only update Zustand if THROTTLE_MS has passed)
        const now = Date.now();
        if (now - lastUpdateRef.current >= THROTTLE_MS) {
          try {
            const data: TelemetryData = JSON.parse(message.toString());
            updateTelemetry(data);
            lastUpdateRef.current = now;
          } catch (e) {
            console.error('Failed to parse telemetry JSON:', e);
          }
        }
      }
    });

    client.on('disconnect', () => {
      console.log('Disconnected from MQTT Broker');
      setMqttConnected(false);
    });

    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      client.end();
    });

    return () => {
      if (clientRef.current) {
        clientRef.current.end();
      }
    };
  }, [setMqttConnected, updateTelemetry]);

  // Command Publishing Helper
  const publishCommand = (command: 'start' | 'stop', currentScenario?: string) => {
    if (clientRef.current && clientRef.current.connected) {
      const payload = JSON.stringify({
        command,
        scenario: currentScenario || scenario,
        timestamp: new Date().toISOString()
      });
      // Publish commands with QoS 1 to ensure delivery to the AI Brain
      clientRef.current.publish(COMMAND_TOPIC, payload, { qos: 1 });
      console.log(`Published command: ${payload}`);
    } else {
      console.warn('MQTT Client not connected. Cannot publish command.');
    }
  };

  return { publishCommand };
}
