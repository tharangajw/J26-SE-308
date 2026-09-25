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
      </TelemetryProvider>
    </ChaosProvider>
  )
}

export default App
