import { TelemetryCollectorEngine } from '../src/collector';

async function testTelemetryCollector() {
  console.log('--- Testing Live Telemetry Collector Engine ---');
  const engine = new TelemetryCollectorEngine();
  
  try {
    const snapshot = await engine.collectServiceSnapshot('order-service');
    console.log('[OK] Telemetry snapshot collected. Source availability:');
    console.log(snapshot.sources);
    console.log(JSON.stringify(snapshot, null, 2));
  } catch (err: any) {
    console.log(`[INFO] Telemetry endpoints are currently offline.`);
    console.log(`Error details: ${err.message}`);
    console.log(`Start cluster with 'docker-compose up -d' to stream live telemetry.`);
  }
}

testTelemetryCollector().catch(console.error);
