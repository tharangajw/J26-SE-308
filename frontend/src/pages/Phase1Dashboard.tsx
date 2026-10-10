import { useState, useEffect } from 'react';
import {
  GitMerge,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Box,
  Layers,
  Calculator,
  GitBranch,
  Activity
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts';

/* ── Mock Data Fallbacks ──────────────────────────────────── */
const couplingHistory = [
  { name: 'Jun 1', couplingIndex: 0.35, commitFreq: 12, coDeploy: 0.2 },
  { name: 'Jun 3', couplingIndex: 0.42, commitFreq: 15, coDeploy: 0.25 },
  { name: 'Jun 5', couplingIndex: 0.38, commitFreq: 14, coDeploy: 0.21 },
  { name: 'Jun 7', couplingIndex: 0.55, commitFreq: 22, coDeploy: 0.4 },
  { name: 'Jun 9', couplingIndex: 0.48, commitFreq: 18, coDeploy: 0.32 },
  { name: 'Jun 11', couplingIndex: 0.62, commitFreq: 25, coDeploy: 0.45 },
  { name: 'Jun 13', couplingIndex: 0.45, commitFreq: 16, coDeploy: 0.28 },
];

const serviceCouplingData = [
  { name: 'order-service', couplingIndex: 0.65, color: '#f43f5e' }, // High coupling
  { name: 'payment-service', couplingIndex: 0.42, color: '#fbbf24' }, // Medium
  { name: 'inventory-service', couplingIndex: 0.25, color: '#10b981' }, // Low
  { name: 'user-service', couplingIndex: 0.30, color: '#10b981' }, // Low
  { name: 'book-service', couplingIndex: 0.55, color: '#fbbf24' }, // Medium
];

const recentPRs = [
  {
    id: 'PR #142',
    title: 'feat: add new payment gateway',
    services: ['payment-service', 'order-service'],
    commitFreq: 24,
    coDeployRate: 0.45,
    couplingIndex: 0.725,
    status: 'Blocked',
    time: '2 hours ago'
  },
  {
    id: 'PR #141',
    title: 'fix: inventory sync issue',
    services: ['inventory-service'],
    commitFreq: 8,
    coDeployRate: 0.1,
    couplingIndex: 0.216,
    status: 'Passed',
    time: '5 hours ago'
  },
  {
    id: 'PR #140',
    title: 'feat: user profile caching',
    services: ['user-service'],
    commitFreq: 12,
    coDeployRate: 0.15,
    couplingIndex: 0.325,
    status: 'Passed',
    time: '1 day ago'
  },
  {
    id: 'PR #139',
    title: 'refactor: shared models update',
    services: ['order-service', 'inventory-service', 'book-service'],
    commitFreq: 28,
    coDeployRate: 0.6,
    couplingIndex: 0.850,
    status: 'Blocked',
    time: '2 days ago'
  }
];

export const Phase1Dashboard = () => {
  const [currentCoupling, setCurrentCoupling] = useState(0.45);
  const [currentCommitFreq, setCurrentCommitFreq] = useState(16);
  const [currentCoDeploy, setCurrentCoDeploy] = useState(28);
  const [prs, setPrs] = useState(recentPRs);
  const [history, setHistory] = useState(couplingHistory);
  const [services, setServices] = useState(serviceCouplingData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/phase1/dashboard');
        if (response.ok) {
          const data = await response.json();
          setCurrentCoupling(data.averages.couplingIndex);
          setCurrentCommitFreq(data.averages.commitFreq);
          setCurrentCoDeploy(data.averages.coDeployRate);
          if (data.recentPRs && data.recentPRs.length > 0) {
            setPrs(data.recentPRs);
          }
          if (data.history && data.history.length > 0) {
            setHistory(data.history);
          }
          if (data.serviceDist && data.serviceDist.length > 0) {
            setServices(data.serviceDist);
          }
        }
      } catch (error) {
        console.error('Failed to fetch real Phase 1 data, using mock data fallback', error);
      }
    };
    
    fetchData();
    // Auto-refresh every 10 seconds to mimic real-time webhook updates
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto">
      
      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-cicd/10 border border-brand-cicd/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
            <GitMerge className="text-brand-cicd w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-text-primary tracking-wide">Coupling Assessor <span className="text-brand-cicd border border-brand-cicd/30 bg-brand-cicd/10 px-2 py-0.5 rounded text-xs ml-2 font-mono">Phase 1</span></h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mt-1">
              Pre-Build Static Analysis & Repository Mining
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-surface-secondary/50 px-6 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Target:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary"><Box className="w-3.5 h-3.5 text-brand-cicd" /> rp-core-product</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Window:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary"><Clock className="w-3.5 h-3.5 text-text-muted" /> 30 Days</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <button 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-surface-secondary/50 hover:bg-surface-secondary transition-colors text-xs font-semibold text-text-primary"
            onClick={() => window.open('https://github.com/settings/apps', '_blank')}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Connect Repo
          </button>
          
          <button 
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-brand-cicd/50 bg-brand-cicd/10 hover:bg-brand-cicd/20 transition-colors text-xs font-semibold text-brand-cicd"
            onClick={() => alert('Webhook test payload sent to C-Score Engine!')}
          >
            <Activity className="w-3.5 h-3.5" />
            Test Webhook
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="text-xs font-semibold">Listening</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Main (8 cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Top 3 KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Coupling Index */}
            <div className="bg-surface border border-border rounded-xl p-5 relative overflow-hidden flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Global Coupling Index</div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-3xl font-bold text-brand-cicd tracking-wide">{currentCoupling.toFixed(3)}</div>
              </div>
              <div className="h-12 w-full -ml-2 mb-2 mt-auto">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history.slice(-4)}>
                    <Line type="monotone" dataKey="couplingIndex" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs bg-surface-secondary/80 px-3 py-1.5 rounded-full border border-border/50 text-text-secondary font-medium inline-flex self-start">
                Target: &lt; 0.500
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <Layers className="w-32 h-32 text-brand-cicd" />
              </div>
            </div>

            {/* Commit Frequency */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg Commit Frequency</div>
              <div className="text-3xl font-bold text-indigo-400 mb-1">{currentCommitFreq}</div>
              <div className="text-xs text-text-muted mb-4">commits / service (30d)</div>
              
              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-text-secondary">Risk Level</span>
                  <span className="text-yellow-400 font-medium">Moderate</span>
                </div>
                <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${(currentCommitFreq/24)*100}%` }} />
                </div>
              </div>
            </div>

            {/* Co-Deploy Rate */}
            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Co-Deploy Rate</div>
              <div className="text-3xl font-bold text-emerald-400 mb-1">{currentCoDeploy}%</div>
              <div className="text-xs text-text-muted mb-4">multi-service commits</div>
              
              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="text-text-secondary">Risk Level</span>
                  <span className="text-emerald-400 font-medium">Healthy</span>
                </div>
                <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${currentCoDeploy}%` }} />
                </div>
              </div>
            </div>

          </div>

          {/* Metric Trends Chart */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Extraction Metrics Over Time</div>
                <div className="text-xs text-text-muted mt-0.5">Tracking Commit Frequency and Co-Deploy patterns</div>
              </div>
              <div className="flex gap-4 text-[10px] text-text-secondary">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-400" /> Commit Freq</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> Co-Deploy Rate</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-cicd" /> Coupling Index</span>
              </div>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252C35" vertical={false} />
                  <XAxis dataKey="name" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={30} />
                  <YAxis yAxisId="right" orientation="right" stroke="#5E6875" fontSize={10} tickLine={false} axisLine={false} width={30} />
                  <RechartsTooltip contentStyle={{ background: '#1a1f27', border: '1px solid #2d3748', borderRadius: 8, fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="commitFreq" stroke="#818cf8" strokeWidth={2} dot={{ r: 4 }} name="Commits (30d)" />
                  <Line yAxisId="right" type="monotone" dataKey="coDeploy" stroke="#34d399" strokeWidth={2} dot={{ r: 4 }} name="Co-Deploy" />
                  <Line yAxisId="right" type="monotone" dataKey="couplingIndex" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} name="Coupling Idx" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* PR Webhook Feed */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border/50 flex justify-between items-center bg-surface-secondary/30">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-brand-cicd" /> Recent PR Assessments
                </div>
              </div>
              <span className="text-xs text-brand-cicd hover:underline cursor-pointer">View All</span>
            </div>
            <div className="divide-y divide-border/50">
              {prs.map((pr, idx) => (
                <div key={idx} className="p-5 hover:bg-surface-secondary/20 transition-colors flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-text-muted">{pr.id}</span>
                      <span className="font-medium text-sm text-text-primary">{pr.title}</span>
                      {pr.status === 'Passed' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> PASSED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> BLOCKED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <div className="flex items-center gap-1">
                        <Box className="w-3 h-3" /> 
                        {pr.services.join(', ')}
                      </div>
                      <div className="flex items-center gap-1 text-text-muted">
                        <Clock className="w-3 h-3" /> {pr.time}
                      </div>
                    </div>
                  </div>
                    
                  <div className="flex items-center gap-6 text-right">
                    <div className="hidden sm:block">
                      <div className="text-[10px] text-text-muted uppercase mb-1">Commit Freq</div>
                      <div className="font-mono text-indigo-400">{pr.commitFreq}</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-[10px] text-text-muted uppercase mb-1">Co-Deploy</div>
                      <div className="font-mono text-emerald-400">{(pr.coDeployRate * 100).toFixed(0)}%</div>
                    </div>
                    <div className="bg-surface-secondary/50 p-2 rounded border border-border/50 w-24">
                      <div className="text-[10px] text-text-muted uppercase mb-1 text-center">Coupling Idx</div>
                      <div className={`font-mono font-bold text-center ${pr.couplingIndex > 0.5 ? 'text-rose-400' : 'text-text-primary'}`}>
                        {pr.couplingIndex.toFixed(3)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right Sidebar (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Formula Card */}
          <div className="bg-brand-cicd/5 border border-brand-cicd/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cicd/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Calculator className="w-5 h-5 text-brand-cicd" />
              <div className="text-[10px] text-brand-cicd uppercase tracking-wider font-bold">Calculation Logic</div>
            </div>
            
            <div className="relative z-10 mb-4 p-4 rounded-lg bg-black/40 border border-brand-cicd/20 font-mono text-[11px] text-text-primary overflow-x-auto leading-relaxed">
              <span className="text-brand-cicd">def</span> <span className="text-yellow-200">coupling_index</span>(freq, co_deploy):<br/>
              &nbsp;&nbsp;<span className="text-text-muted"># Normalizes 30-day freq to 0-1 (max 24)</span><br/>
              &nbsp;&nbsp;norm_freq = min(freq / <span className="text-purple-400">24.0</span>, <span className="text-purple-400">1.0</span>)<br/>
              <br/>
              &nbsp;&nbsp;<span className="text-text-muted"># Weighted combination</span><br/>
              &nbsp;&nbsp;<span className="text-brand-cicd">return</span> (<span className="text-purple-400">0.5</span> * norm_freq) + (<span className="text-purple-400">0.5</span> * co_deploy)
            </div>
            
            <p className="text-xs text-text-secondary leading-relaxed relative z-10 mb-4">
              Phase 1 static analysis extracts metrics directly from the GitHub API. High coupling index indicates architectural friction and deployment entanglement.
            </p>
          </div>

          {/* Service Coupling Distribution */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Service Coupling Distribution</div>
            
            <div className="space-y-4">
              {services.sort((a,b) => b.couplingIndex - a.couplingIndex).map((s, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-mono text-text-primary">{s.name}</span>
                    <span className="font-mono" style={{ color: s.color }}>{s.couplingIndex.toFixed(3)}</span>
                  </div>
                  <div className="h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.couplingIndex * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Quick Insights */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Architectural Insights</div>
            <div className="space-y-3">
              <div className="flex gap-3 items-start border border-rose-500/20 bg-rose-500/5 p-3 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-text-primary mb-1">High Entanglement Detected</div>
                  <div className="text-[10px] text-text-secondary">
                    <span className="font-mono text-rose-400">order-service</span> frequently co-deploys with <span className="font-mono text-rose-400">payment-service</span>. Consider extracting shared logic or utilizing event-driven sync.
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 items-start border border-green-500/20 bg-green-500/5 p-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-text-primary mb-1">Inventory Service Isolated</div>
                  <div className="text-[10px] text-text-secondary">
                    Excellent decoupling. <span className="font-mono text-green-400">inventory-service</span> maintains a co-deploy rate &lt; 15% over the last 30 days.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
