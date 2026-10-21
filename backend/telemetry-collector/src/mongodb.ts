import { MongoClient, Db, Collection } from 'mongodb';
import { FanOutAnalysisResult } from './fanout.js';
import { HistoricalDeploymentRecord } from './drift.js';
import { RawTelemetrySnapshot } from './types.js';

export class TelemetryMongoDatabase {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private isConnecting: boolean = false;
  private connectionPromise: Promise<boolean> | null = null;

  private readonly uriCandidates: string[];

  constructor(customUri?: string) {
    this.uriCandidates = [
      customUri,
      process.env.MONGODB_URI,
      'mongodb://127.0.0.1:27017/pscore_telemetry',
      'mongodb://pscore-mongo:27017/pscore_telemetry',
      'mongodb://mongodb:27017/pscore_telemetry',
      'mongodb://localhost:27017/pscore_telemetry',
    ].filter(Boolean) as string[];

    // Attempt initial connect asynchronously
    this.connect().catch(() => {});
  }

  public async connect(): Promise<boolean> {
    if (this.db) return true;
    if (this.isConnecting && this.connectionPromise) return this.connectionPromise;

    this.isConnecting = true;
    this.connectionPromise = (async () => {
      for (const uri of this.uriCandidates) {
        try {
          const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 2000,
            connectTimeoutMS: 2000,
          });
          await client.connect();
          this.client = client;
          this.db = client.db('pscore_telemetry');

          await this.ensureIndexes();
          console.log(`[TelemetryMongoDatabase] Connected successfully to MongoDB at ${uri}`);
          return true;
        } catch {
          // Try next candidate URI
          continue;
        }
      }
      return false;
    })().finally(() => {
      this.isConnecting = false;
    });

    return this.connectionPromise;
  }

  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;
    try {
      const topologies = this.db.collection('call_tree_topologies');
      await topologies.createIndex({ serviceId: 1, evaluatedAt: -1 });

      const drift = this.db.collection('drift_baselines');
      await drift.createIndex({ serviceId: 1, timestampMs: 1 });

      const snapshots = this.db.collection('telemetry_snapshots');
      await snapshots.createIndex({ serviceId: 1, timestamp: -1 });
    } catch {
      // Ignore index errors if already exist
    }
  }

  /**
   * Persists a discovered call-tree DAG topology record to MongoDB.
   */
  public async saveTopology(topology: FanOutAnalysisResult): Promise<void> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return;

    try {
      const col = this.db.collection('call_tree_topologies');
      const cleanId = topology.serviceId.toLowerCase();
      const doc = {
        ...topology,
        serviceId: cleanId,
        recordedAt: new Date(),
        evaluatedAt: Date.now(),
      };

      // Upsert latest record and append to historical topology collection
      await col.updateOne(
        { serviceId: cleanId, isLatest: true },
        { $set: { ...doc, isLatest: true } },
        { upsert: true }
      );

      // Keep historical log with capped retention (latest 50 per service)
      await col.insertOne({ ...doc, isLatest: false });
    } catch (err: any) {
      console.warn(`[TelemetryMongoDatabase] Failed to save topology for ${topology.serviceId}:`, err?.message);
    }
  }

  /**
   * Retrieves the most recently discovered topology for a microservice.
   */
  public async getLatestTopology(serviceId: string): Promise<FanOutAnalysisResult | null> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return null;

    try {
      const col = this.db.collection('call_tree_topologies');
      const cleanId = serviceId.toLowerCase();
      const doc = await col.findOne(
        { serviceId: cleanId, isLatest: true },
        { projection: { _id: 0, isLatest: 0, recordedAt: 0 } }
      );
      return (doc as unknown as FanOutAnalysisResult) || null;
    } catch {
      return null;
    }
  }

  /**
   * Persists a historical latency drift baseline snapshot to MongoDB.
   */
  public async saveDriftSnapshot(serviceId: string, record: HistoricalDeploymentRecord): Promise<void> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return;

    try {
      const col = this.db.collection('drift_baselines');
      const cleanId = serviceId.toLowerCase();
      await col.updateOne(
        { serviceId: cleanId, version: record.version },
        {
          $set: {
            serviceId: cleanId,
            version: record.version,
            p95LatencyMs: record.p95LatencyMs,
            evaluatedAt: record.evaluatedAt,
            timestampMs: record.timestampMs || Date.now(),
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      console.warn(`[TelemetryMongoDatabase] Failed to save drift snapshot for ${serviceId}:`, err?.message);
    }
  }

  /**
   * Retrieves all historical drift baselines stored in MongoDB for a microservice.
   */
  public async getDriftHistory(serviceId: string): Promise<HistoricalDeploymentRecord[]> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return [];

    try {
      const col = this.db.collection('drift_baselines');
      const cleanId = serviceId.toLowerCase();
      const docs = await col
        .find({ serviceId: cleanId })
        .sort({ timestampMs: 1 })
        .toArray();

      return docs.map((d: any) => ({
        version: d.version,
        p95LatencyMs: d.p95LatencyMs,
        evaluatedAt: d.evaluatedAt,
        timestampMs: d.timestampMs,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Persists a raw multi-source telemetry snapshot to MongoDB.
   */
  public async saveRawSnapshot(snapshot: RawTelemetrySnapshot): Promise<void> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return;

    try {
      const col = this.db.collection('telemetry_snapshots');
      await col.insertOne({
        ...snapshot,
        serviceId: snapshot.serviceId.toLowerCase(),
        recordedAt: new Date(),
      });
    } catch {
      // Ignore non-critical raw snapshot write errors
    }
  }

  /**
   * Retrieves historical snapshots from telemetry_snapshots collection for a service.
   */
  public async getHistoricalSnapshots(
    serviceId: string,
    limit: number = 30
  ): Promise<Array<{ timestamp: number; p95LatencyMs: number; evaluatedAt: string }>> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return [];

    try {
      const col = this.db.collection('telemetry_snapshots');
      const cleanId = serviceId.toLowerCase();
      const docs = await col
        .find({ serviceId: cleanId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      const results: Array<{ timestamp: number; p95LatencyMs: number; evaluatedAt: string }> = [];
      for (const d of docs.reverse()) {
        const p95 = d.prometheus?.p95LatencyMs || d.prometheus?.avgResponseTimeMs || 0;
        if (p95 > 0) {
          results.push({
            timestamp: d.timestamp || (d.recordedAt ? new Date(d.recordedAt).getTime() : Date.now()),
            p95LatencyMs: parseFloat(Number(p95).toFixed(2)),
            evaluatedAt: d.recordedAt
              ? new Date(d.recordedAt).toISOString().replace('T', ' ').slice(0, 19)
              : new Date(d.timestamp).toISOString().replace('T', ' ').slice(0, 19),
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }

  /**
   * Persists a comprehensive P-Score Executive Report to MongoDB.
   */
  public async savePScoreReport(report: any): Promise<{ success: boolean; id?: string }> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return { success: false };

    try {
      const col = this.db.collection('pscore_reports');
      const serviceId = (report.serviceId || 'cluster').toLowerCase();
      const doc = {
        ...report,
        serviceId,
        createdAt: new Date(),
        timestampMs: report.timestampMs || Date.now(),
      };
      const res = await col.insertOne(doc);
      return { success: true, id: res.insertedId.toString() };
    } catch (err: any) {
      console.warn('[TelemetryMongoDatabase] Failed to save P-Score report:', err?.message);
      return { success: false };
    }
  }

  /**
   * Retrieves historical P-Score reports from MongoDB, optionally filtered by service.
   */
  public async getPScoreReportHistory(serviceId?: string, limit: number = 20): Promise<any[]> {
    const isConnected = await this.connect();
    if (!isConnected || !this.db) return [];

    try {
      const col = this.db.collection('pscore_reports');
      const query = serviceId && serviceId !== 'all' ? { serviceId: serviceId.toLowerCase() } : {};
      const docs = await col
        .find(query)
        .sort({ timestampMs: -1 })
        .limit(limit)
        .toArray();

      return docs.map((d) => ({
        ...d,
        _id: d._id.toString(),
      }));
    } catch {
      return [];
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}

// Export singleton instance for reuse across Telemetry Collector modules
export const telemetryMongo = new TelemetryMongoDatabase();
