import { useState, useEffect } from 'react';
import {
  Network,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  Box,
  Calculator,
  Zap
} from 'lucide-react';

export const Phase2Dashboard = () => {
  const [avgBlast, setAvgBlast] = useState(0);
  const [avgApiChanges, setAvgApiChanges] = useState(0);
  const [prs, setPrs] = useState<any[]>([]);
  const [graph, setGraph] = useState({ nodes: [], edges: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/phase2/dashboard');
        if (response.ok) {
          const data = await response.json();
          setAvgBlast(data.averages.blastRadius);
          setAvgApiChanges(data.averages.apiChanges);
          setPrs(data.recentPRs || []);
          setGraph(data.graph || { nodes: [], edges: [] });
        }
      } catch (error) {
        console.error('Failed to fetch Phase 2 data', error);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full bg-background text-text-primary p-4 lg:p-6 overflow-y-auto">
      
      {/* ── Header ── */}
      <div className="flex flex-wrap lg:flex-nowrap justify-between items-center bg-surface border border-border rounded-xl p-4 shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <Network className="text-purple-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-text-primary tracking-wide">Blast Radius Assessor <span className="text-purple-400 border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 rounded text-xs ml-2 font-mono">Phase 2</span></h1>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mt-1">
              OpenAPI AST Diffing & Dependency Graph
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm bg-surface-secondary/50 px-6 py-2 rounded-lg border border-border/50">
          <div className="flex gap-2 items-center">
            <span className="text-text-muted">Target:</span>
            <span className="flex items-center gap-1.5 font-mono text-text-primary"><Box className="w-3.5 h-3.5 text-purple-400" /> rp-core-product</span>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-border pl-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            <span className="text-xs font-semibold">Listening</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Main (8 cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Top KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="bg-surface border border-border rounded-xl p-5 relative overflow-hidden flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg Blast Radius</div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-4xl font-bold text-purple-400 tracking-wide">{avgBlast}</div>
              </div>
              <div className="text-xs text-text-muted mb-4">Affected Downstream Services x API Changes</div>
              <div className="absolute -right-4 -bottom-4 opacity-5">
                <Zap className="w-32 h-32 text-purple-400" />
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2">Avg Breaking API Changes</div>
              <div className="text-4xl font-bold text-rose-400 mb-1">{avgApiChanges}</div>
              <div className="text-xs text-text-muted mb-4">per PR (OpenAPI Diff)</div>
              
              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="h-1.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(100, avgApiChanges * 10)}%` }} />
                </div>
              </div>
            </div>

          </div>
          
          {/* PR Webhook Feed */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border/50 flex justify-between items-center bg-surface-secondary/30">
              <div>
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
                  <GitPullRequest className="w-4 h-4 text-purple-400" /> Recent Blast Radius Assessments
                </div>
              </div>
            </div>
            <div className="divide-y divide-border/50">
              {prs.map((pr: any, idx: number) => (
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
                      <div className="text-[10px] text-text-muted uppercase mb-1">Downstream Count</div>
                      <div className="font-mono text-indigo-400">{pr.downstreamCount}</div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="text-[10px] text-text-muted uppercase mb-1">API Changes</div>
                      <div className="font-mono text-rose-400">{pr.apiChanges}</div>
                    </div>
                    <div className="bg-surface-secondary/50 p-2 rounded border border-border/50 w-24">
                      <div className="text-[10px] text-text-muted uppercase mb-1 text-center">Blast Radius</div>
                      <div className={`font-mono font-bold text-center ${pr.blastRadius > 5 ? 'text-rose-400' : 'text-purple-400'}`}>
                        {pr.blastRadius}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {prs.length === 0 && (
                <div className="p-8 text-center text-text-muted text-sm">
                  No Phase 2 data available yet. Open a PR with API changes!
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right Sidebar (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Formula Card */}
          <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-2xl rounded-full translate-x-8 -translate-y-8" />
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <Calculator className="w-5 h-5 text-purple-400" />
              <div className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">Calculation Logic</div>
            </div>
            
            <div className="relative z-10 mb-4 p-4 rounded-lg bg-black/40 border border-purple-500/20 font-mono text-[11px] text-text-primary overflow-x-auto leading-relaxed">
              <span className="text-purple-400">def</span> <span className="text-yellow-200">blast_radius</span>(api_changes, downstream):<br/>
              <br/>
              &nbsp;&nbsp;<span className="text-text-muted"># Simple multiplication of impact</span><br/>
              &nbsp;&nbsp;<span className="text-purple-400">return</span> api_changes * downstream
            </div>
            
            <p className="text-xs text-text-secondary leading-relaxed relative z-10 mb-4">
              Phase 2 uses <code>oasdiff</code> to detect breaking changes in OpenAPI specs between the PR branch and <code>main</code>. It cross-references this with the Service Dependency Graph to calculate the Blast Radius.
            </p>
          </div>

          {/* Graph Visualization Mock */}
          <div className="bg-surface border border-border rounded-xl p-5 flex flex-col">
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-4">Dependency Graph Nodes</div>
            <div className="p-4 bg-surface-secondary/30 border border-border/50 rounded-lg flex flex-col gap-3">
              {graph.nodes.length > 0 ? graph.nodes.map((n: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span className="font-mono text-text-primary">{n.id}</span>
                </div>
              )) : (
                <span className="text-xs text-text-muted">No dependencies found.</span>
              )}
              
              <div className="mt-4 pt-4 border-t border-border/50 text-xs text-text-secondary">
                {graph.edges.length} connections detected in Service Registry.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
