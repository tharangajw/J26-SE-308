import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { ActiveFault, ActiveChaosEvent } from '../data/mockData';

export interface ChaosHistoryItem {
  id: string;
  experiment_type: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  message: string;
}

interface ChaosContextType {
  activeFaults: ActiveFault[];
  setActiveFaults: React.Dispatch<React.SetStateAction<ActiveFault[]>>;
  activeChaosEvent: ActiveChaosEvent | null;
  setActiveChaosEvent: React.Dispatch<React.SetStateAction<ActiveChaosEvent | null>>;
  chaosHistory: ChaosHistoryItem[];
  setChaosHistory: React.Dispatch<React.SetStateAction<ChaosHistoryItem[]>>;
  addChaosHistory: (item: Omit<ChaosHistoryItem, 'id'>) => void;
  updateLastHistoryStatus: (status: 'completed' | 'failed', message: string) => void;
}

const ChaosContext = createContext<ChaosContextType | undefined>(undefined);

export const ChaosProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeFaults, setActiveFaults] = useState<ActiveFault[]>([]);
  const [activeChaosEvent, setActiveChaosEvent] = useState<ActiveChaosEvent | null>(null);
  const [chaosHistory, setChaosHistory] = useState<ChaosHistoryItem[]>([]);

  const addChaosHistory = (item: Omit<ChaosHistoryItem, 'id'>) => {
    const newItem = { ...item, id: `h-${Date.now()}-${Math.random()}` };
    setChaosHistory(prev => [newItem, ...prev]);
  };

  const updateLastHistoryStatus = (status: 'completed' | 'failed', message: string) => {
    setChaosHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      newHistory[0] = { ...newHistory[0], status, message };
      return newHistory;
    });
  };

  return (
    <ChaosContext.Provider value={{
      activeFaults, setActiveFaults,
      activeChaosEvent, setActiveChaosEvent,
      chaosHistory, setChaosHistory,
      addChaosHistory, updateLastHistoryStatus
    }}>
      {children}
    </ChaosContext.Provider>
  );
};

export const useChaosContext = () => {
  const context = useContext(ChaosContext);
  if (context === undefined) {
    throw new Error('useChaosContext must be used within a ChaosProvider');
  }
  return context;
};
