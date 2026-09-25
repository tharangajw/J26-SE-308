import React, { createContext, useContext, useState, useEffect } from 'react';
import { TelemetryService } from '../services/telemetry';
import type { TelemetryData } from '../services/telemetry';

interface TelemetryContextProps {
  telemetry: TelemetryData | null;
  oScore: number;
}

const TelemetryContext = createContext<TelemetryContextProps | undefined>(undefined);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [oScore, setOScore] = useState<number>(87.4); // default base score

  useEffect(() => {
    const fetchData = async () => {
      const data = await TelemetryService.getCombinedTelemetry();
      setTelemetry(data);
      
      if (data) {
        // Simple O-Score calculation for sync across tabs
        // (Metrics 35% + Logs 30% + Traces 35%)
        // This is a placeholder calculation that you can adjust
        const baseScore = 80;
        const dynamicAdjustment = (data.metrics.cpuUsage < 80 ? 5 : 0) + (data.logs.errorCount === 0 ? 5 : 0);
        setOScore(baseScore + dynamicAdjustment);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <TelemetryContext.Provider value={{ telemetry, oScore }}>
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
