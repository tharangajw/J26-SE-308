import React from 'react';
import { PageContainer } from '../components/layout/PageContainer';
import { PerformanceDataCollection as PerformanceDataCollectionView } from '../components/performanceDataCollection/PerformanceDataCollection';

export const PerformanceDataCollection: React.FC = () => <PageContainer className="space-y-6"><PerformanceDataCollectionView /></PageContainer>;