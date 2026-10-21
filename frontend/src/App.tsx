import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { ChaosProvider } from './context/ChaosContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { Layout } from './components/layout/Layout';
import { Overview } from './pages/Overview';
import { DimensionPage } from './pages/DimensionPage';
import { Assessment } from './pages/Assessment';
import { Architecture } from './pages/Architecture';
import { Reports } from './pages/Reports';
import { Observability } from './pages/Observability';
import { ObservabilityDashboard } from './pages/ObservabilityDashboard';
import { ObservabilityHistory } from './pages/ObservabilityHistory';
import { PerformanceDataCollection } from './pages/PerformanceDataCollection';
import { DataPipelineOutputs } from './pages/DataPipelineOutputs';
import { DriftAnalysisPage } from './pages/DriftAnalysisPage';
import { AnomalyDetectionPage } from './pages/AnomalyDetectionPage';
import { FanOutAnalysisPage } from './pages/FanOutAnalysisPage';
import { PerformanceDimensionPage } from './pages/PerformanceDimensionPage';
import { FaultToleranceDashboard } from './components/resilience/FaultToleranceDashboard';
import { FaultToleranceCalculation } from './components/resilience/FaultToleranceCalculation';
import { ResilienceHistory } from './components/resilience/ResilienceHistory';
import { Phase1Dashboard } from './pages/Phase1Dashboard';
import { Phase2Dashboard } from './pages/Phase2Dashboard';
import { Phase3Dashboard } from './pages/Phase3Dashboard';
import { CiCdOverview } from './pages/CiCdOverview';

function App() {
  return (
    <ChaosProvider>
      <TelemetryProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="dimensions/observability" element={<ObservabilityDashboard />} />
            <Route path="dimensions/observability/overview" element={<ObservabilityDashboard />} />
            <Route path="dimensions/observability/detail" element={<Observability />} />
            <Route path="dimensions/observability/cci-audit" element={<Observability />} />
            <Route path="dimensions/observability/ai-analysis" element={<Observability />} />
            <Route path="dimensions/observability/remediation" element={<Observability />} />
            <Route path="dimensions/observability/calculation" element={<Observability />} />
            <Route path="dimensions/observability/history" element={<ObservabilityHistory />} />
            <Route path="dimensions/performance" element={<PerformanceDimensionPage />} />
            <Route path="dimensions/performance/collection" element={<PerformanceDataCollection />} />
            <Route path="dimensions/performance/pipeline" element={<DataPipelineOutputs />} />
            <Route path="dimensions/performance/drift" element={<DriftAnalysisPage />} />
            <Route path="dimensions/performance/fanout" element={<FanOutAnalysisPage />} />
            <Route path="dimensions/performance/anomaly" element={<AnomalyDetectionPage />} />
            <Route path="dimensions/FaultToleranceDashboard" element={<FaultToleranceDashboard />} />
            <Route path="dimensions/fault-tolerance/chaos" element={<FaultToleranceDashboard standaloneChaos />} />
            <Route path="dimensions/fault-tolerance/calculation" element={<FaultToleranceCalculation />} />
            <Route path="dimensions/fault-tolerance/history" element={<ResilienceHistory />} />
            <Route path="dimensions/cicd" element={<CiCdOverview />} />
            <Route path="dimensions/:dimensionId" element={<DimensionPage />} />
            <Route path="phase1/coupling" element={<Phase1Dashboard />} />
            <Route path="phase2/blast-radius" element={<Phase2Dashboard />} />
            <Route path="phase3/telemetry" element={<Phase3Dashboard />} />
            <Route path="assessment" element={<Assessment />} />
            <Route path="architecture" element={<Architecture />} />
            <Route path="evidence" element={<div className="p-8">Evidence Review is integrated into Assessment</div>} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<div className="p-8">Settings interface placeholder</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
      </TelemetryProvider>
    </ChaosProvider>
  )
}

export default App
