import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { AnomalyService, type ServiceAnomalyEvaluation } from '../../services/anomaly';
import { TelemetryService } from '../../services/telemetry';
import { ShieldAlert, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AnomalyPanel: React.FC = () => {
  const [evaluations, setEvaluations] = useState<ServiceAnomalyEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveAnomalies = async () => {
    setIsLoading(true);
    try {
      const discovery = await TelemetryService.discoverServices();
      const targetServices = discovery.allServices.slice(0, 4);

      if (targetServices.length === 0) {
        setEvaluations([]);
        return;
      }

      const results = await Promise.all(
        targetServices.map((svc) => AnomalyService.evaluateService(svc))
      );

      setEvaluations(results);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Anomaly service unreachable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveAnomalies();
    const interval = setInterval(fetchLiveAnomalies, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeAnomalyCount = evaluations.filter((e) => e.prediction.is_anomaly).length;

  return (
    <Card className="bg-surface border-border">
      <CardHeader className="flex-row items-center justify-between border-b border-border/60 pb-3">
        <div>
          <CardTitle className="text-sm uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-brand-perf" />
            Live Isolation Forest Anomaly Detection
          </CardTitle>
          <p className="mt-1 text-xs text-text-muted">
            Evaluated by FastAPI Isolation Forest model on port 8000
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeAnomalyCount > 0 ? (
            <Badge variant="destructive">{activeAnomalyCount} active anomalies</Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-0.5">
              <ShieldCheck className="h-3 w-3 text-emerald-400" /> All Normal
            </span>
          )}
          <Link
            to="/dimensions/performance/anomaly"
            className="text-xs text-brand-perf hover:underline inline-flex items-center gap-1 font-mono ml-2"
          >
            Detailed Engine <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {isLoading && evaluations.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-perf" />
            Evaluating service feature vectors via Isolation Forest...
          </div>
        ) : error && evaluations.length === 0 ? (
          <div className="p-6 text-center text-xs text-rose-400">
            {error} (Ensure `docker start pscore-anomaly-detection` is running on port 8000)
          </div>
        ) : (
          <table className="w-full min-w-[650px] text-left text-sm font-mono">
            <thead className="bg-surface-secondary/50 text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Service</th>
                <th className="px-4 py-3 font-medium">Uptime</th>
                <th className="px-4 py-3 font-medium">CPU / Mem (Norm)</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Anomaly Score</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs">
              {evaluations.map((item) => {
                const pred = item.prediction;
                return (
                  <tr key={item.serviceId} className="hover:bg-surface-secondary/30">
                    <td className="px-6 py-3 font-semibold text-text-primary">
                      {item.serviceId}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {item.rawMetrics.uptimeSeconds}s
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.normalizedFeatures.cpuNorm.toFixed(2)} / {item.normalizedFeatures.memoryNorm.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {item.rawMetrics.p95LatencyMs.toFixed(1)} ms
                    </td>
                    <td className="px-4 py-3 font-bold text-text-primary">
                      {pred.anomaly_score.toFixed(3)}
                    </td>
                    <td className="px-6 py-3">
                      {pred.prefiltered ? (
                        <span className="rounded bg-sky-500/20 text-sky-400 px-2 py-0.5 text-[10px] font-semibold">
                          PREFILTERED (90s)
                        </span>
                      ) : pred.is_anomaly ? (
                        <Badge variant="destructive">ANOMALY</Badge>
                      ) : (
                        <span className="rounded bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                          NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
};
