import React, { createContext, useContext, useState, useEffect } from 'react';
import { TelemetryService } from '../services/telemetry';
import type { TelemetryData } from '../services/telemetry';

export interface HistoryRecord {
  date: string;
  oscore: number;
  cci: number;
  metrics: number;
  traces: number;
  logs: number;
  blindSpots: number;
  errorRate: number;
  latency: number;
  status: string;
}

interface TelemetryContextProps {
  telemetry: TelemetryData | null;
  oScore: number;
  cciIndex: number;
  history: HistoryRecord[];
}

const TelemetryContext = createContext<TelemetryContextProps | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [oScore, setOScore] = useState<number>(87.4); // default base score
  const [cciIndex, setCciIndex] = useState<number>(0);
  const [history, setHistory] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const data = await TelemetryService.getCombinedTelemetry();
      setTelemetry(data);
      
      if (data) {
        // Simple O-Score calculation for sync across tabs
        const baseScore = 80;
        const dynamicAdjustment = (data.metrics.cpuUsage < 80 ? 5 : 0) + (data.logs.errorCount === 0 ? 5 : 0);
        const newScore = baseScore + dynamicAdjustment;
        setOScore(newScore);

        const availableSources = Object.values(data.sources).filter(Boolean).length;
        const newCciIndex = Math.round((availableSources / 3) * 100);
        setCciIndex(newCciIndex);

        // Add to history
        setHistory(prev => {
          const newRecord: HistoryRecord = {
            date: new Date().toISOString(),
            oscore: newScore,
            cci: newCciIndex,
            metrics: data.sources.prometheus ? 1 : 0,
            traces: data.sources.jaeger ? 1 : 0,
            logs: data.sources.loki ? 1 : 0,
            blindSpots: 3 - availableSources,
            errorRate: data.traces.errorRate,
            latency: data.traces.latency,
            status: newScore >= 80 ? 'HEALTHY' : newScore >= 60 ? 'WARNING' : 'CRITICAL'
          };
          const updated = [...prev, newRecord];
          // Keep last 30 entries
          if (updated.length > 30) return updated.slice(updated.length - 30);
          return updated;
        });
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TelemetryContext.Provider value={{ telemetry, oScore, cciIndex, history }}>
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
