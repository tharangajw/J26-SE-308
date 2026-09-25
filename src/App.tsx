import { Routes, Route, BrowserRouter } from 'react-router-dom';
import { ChaosProvider } from './context/ChaosContext';
import { Layout } from './components/layout/Layout';
import { Overview } from './pages/Overview';
import { DimensionPage } from './pages/DimensionPage';
import { Assessment } from './pages/Assessment';
import { Architecture } from './pages/Architecture';
import { Reports } from './pages/Reports';
import { CICDDashboard } from './pages/CICDDashboard';
import { CICDPhases } from './pages/CICDPhases';
import { CICDRisk } from './pages/CICDRisk';
import { CICDCScore } from './pages/CICDCScore';
import { CICDTopology } from './pages/CICDTopology';
import { CICDAlerts } from './pages/CICDAlerts';
import { AIProposal } from './pages/AIProposal';
import { CICDCalculation } from './pages/CICDCalculation';
import { FaultToleranceDashboard } from './components/FaultTolerance/FaultToleranceDashboard';
import { FaultToleranceCalculation } from './pages/FaultToleranceCalculation';
import { Observability } from './pages/Observability';
import { ObservabilityDashboard } from './pages/ObservabilityDashboard';
import { ObservabilityHistory } from './pages/ObservabilityHistory';
import { Performance } from './pages/Performance';

function App() {
  return (
    <ChaosProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="dimensions/observability" element={<ObservabilityDashboard />} />
            <Route path="dimensions/performance/calculation" element={<Performance />} />
            <Route path="dimensions/performance" element={<Performance />} />
            <Route path="dimensions/fault-tolerance/overview" element={<FaultToleranceDashboard />} />
            <Route path="dimensions/fault-tolerance/calculation" element={<FaultToleranceCalculation />} />
            <Route path="dimensions/cicd" element={<CICDDashboard />} />
            <Route path="dimensions/cicd/overview" element={<CICDDashboard />} />
            <Route path="dimensions/cicd/proposal" element={<AIProposal />} />
            <Route path="dimensions/cicd/phases" element={<CICDPhases />} />
            <Route path="dimensions/cicd/calculation" element={<CICDCalculation />} />
            <Route path="dimensions/cicd/risk" element={<CICDRisk />} />
            <Route path="dimensions/cicd/cscore" element={<CICDCScore />} />
            <Route path="dimensions/cicd/topology" element={<CICDTopology />} />
            <Route path="dimensions/cicd/alerts" element={<CICDAlerts />} />
            <Route path="dimensions/performance" element={<Performance />} />
            <Route path="dimensions/performance/calculation" element={<Performance />} />
            <Route path="dimensions/observability/overview" element={<ObservabilityDashboard />} />
            <Route path="dimensions/observability/detail" element={<Observability />} />
            <Route path="dimensions/observability/calculation" element={<Observability />} />
            <Route path="dimensions/observability/history" element={<ObservabilityHistory />} />
            <Route path="dimensions/:dimensionId" element={<DimensionPage />} />
            <Route path="assessment" element={<Assessment />} />
            <Route path="architecture" element={<Architecture />} />
            <Route path="evidence" element={<div className="p-8">Evidence Review is integrated into Assessment</div>} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<div className="p-8">Settings interface placeholder</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ChaosProvider>
  )
}

export default App
