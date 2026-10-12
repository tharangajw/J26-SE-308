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
  calculation: TelemetryData['calculation'] | null;
}

const TelemetryContext = createContext<TelemetryContextProps | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [oScore, setOScore] = useState<number>(0);
  const [cciIndex, setCciIndex] = useState<number>(0);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [calculation, setCalculation] = useState<TelemetryData['calculation'] | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const data = await TelemetryService.getCombinedTelemetry();
      setTelemetry(data);
      
      if (data) {
        setOScore(data.calculation.oScore);
        setCciIndex(data.calculation.cciIndex);
        setCalculation(data.calculation);
        setHistory(data.history.map(record => ({
          date: record.timestamp,
          oscore: record.oscore,
          cci: record.cci_index,
          metrics: data.calculation.scoreBreakdown.metricsCoverage,
          traces: data.calculation.scoreBreakdown.tracePropagation,
          logs: data.calculation.scoreBreakdown.logStructuralIntegrity,
          blindSpots: record.blind_spot_count,
          errorRate: data.traces.errorRate,
          latency: data.traces.latency,
          status: data.calculation.status,
        })));
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TelemetryContext.Provider value={{ telemetry, oScore, cciIndex, history, calculation }}>
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
