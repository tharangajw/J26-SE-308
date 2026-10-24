import React from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Cpu, 
  HardDrive, 
  AlertTriangle, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Database,
  Server,
  Calculator,
  Flame,
  Clock,
  Zap
} from 'lucide-react';

const runtimeRules = [
  { 
    title: 'Availability', 
    description: 'Up to 26.63 points; normalized availability is availability ÷ 99%.',
    icon: 'Activity',
    threshold: '>= 99.0%',
    points: 26.63
  },
  { 
    title: 'CPU load', 
    description: 'Up to 3.26 points; lower CPU utilization scores higher against the 70% reference.',
    icon: 'Cpu',
    threshold: '< 70%',
    points: 3.26
  },
  { 
    title: 'Memory load', 
    description: 'Up to 3.26 points; lower memory utilization scores higher against the 75% reference.',
    icon: 'HardDrive',
    threshold: '< 75%',
    points: 3.26
  },
  { 
    title: 'Error rate', 
    description: 'Up to 14.86 points; lower error rate scores higher against the 1% reference.',
    icon: 'AlertTriangle',
    threshold: '< 1.0%',
    points: 14.86
  },
  { 
    title: 'Pod restarts',
    description: 'Up to 5.41 points; fewer restarts score higher against the 2 restart reference.',
    icon: 'RefreshCw',
    threshold: '< 2',
    points: 5.41
  },
  { 
    title: 'MTTR', 
    description: 'Up to 14.05 points; lower MTTR scores higher against the 15 second reference.',
    icon: 'Clock',
    threshold: '<= 15s',
    points: 14.05
  },
  { 
    title: 'Response Time', 
    description: 'Up to 8.42 points; lower latency scores higher against the 50 ms reference.',
    icon: 'Zap',
    threshold: '< 50ms',
    points: 8.42
  },
  { 
    title: 'Failover Success', 
    description: 'Up to 24.11 points; normalized failover success is success rate ÷ 100%.',
    icon: 'CheckCircle2',
    threshold: '100%',
    points: 24.11
  },
];

const assessmentCriteria = [
  { criterion: 'Circuit Breakers', weight: '1.5', description: 'Prevents cascading failures by stopping repeated calls to failing services' },
  { criterion: 'Chaos Engineering', weight: '1.0', description: 'Proactive fault injection to test resilience' },
];

const iconMap: Record<string, any> = {
  Activity,
  Cpu,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle2,
};

export const FaultToleranceCalculation: React.FC = () => {
  return (
    <div className="h-full bg-background text-text-primary p-6 overflow-y-auto w-full">
      <div className="mb-8 w-full">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted mb-4">
          <ShieldAlert className="h-4 w-4 text-brand-fault" aria-hidden="true" />
          Engineering dimension
        </div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2 mb-3">
          <Calculator className="w-6 h-6 text-brand-fault" />
          How We Calculate Fault Tolerance
        </h1>
        <p className="text-text-muted text-sm">
          A detailed breakdown of the algorithms, data sources, and formulas used by our engine to assess system resilience and fault tolerance capabilities in real-time.
        </p>
      </div>

      <div className="space-y-8 w-full pb-10">
        
        {/* Phase 1: Runtime Resilience Score */}
        <section className="bg-surface border border-border rounded-xl p-6 shadow-sm w-full">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Phase 1: Runtime Resilience Score (R-Score)</h2>
              <p className="text-sm text-text-muted mt-1">AHP weighted resilience score using eight metrics normalized to 0–1, where higher always means better resilience.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
                <Server className="w-4 h-4" /> Data Source
              </h3>
              <p className="text-sm">Real-time telemetry from active microservices including CPU, memory, latency, error rates, availability, pod restart counts, MTTR, and failover success rate.</p>
              <div className="mt-3 p-2 bg-blue-400/10 rounded border border-blue-400/30">
                <p className="text-xs text-blue-400"><strong>Normalization:</strong> Availability and failover are divided by their target; adverse metrics are inverted against their reference limits and clamped to 0–1.</p>
              </div>
            </div>
            <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4" /> Logic Algorithm
              </h3>
              <p className="text-sm">Each normalized metric contributes its AHP weight multiplied by its 0–1 normalized value. Outcome and recovery metrics carry most of the score.</p>
              <div className="mt-3 p-2 bg-orange-400/10 rounded border border-orange-400/30">
                <p className="text-xs text-orange-400"><strong>AHP weights:</strong> Availability 26.63%, failover 24.11%, error rate 14.86%, MTTR 14.05%, latency 8.42%, restarts 5.41%, CPU 3.26%, memory 3.26%.</p>
              </div>
            </div>
          </div>

          <div className="bg-background border border-border rounded-lg p-5 flex flex-col justify-center mb-6">
            <div className="text-center mb-4">
              <span className="text-xs font-mono text-blue-400 bg-blue-400/10 px-2 py-1 rounded">R-Score Formula</span>
            </div>
            <div className="bg-surface-secondary p-3 rounded text-center text-sm font-mono text-text-primary mb-4 border border-border/50 shadow-inner">
              R-Score = 100 × (0.2663A + 0.2411F + 0.1486E + 0.1405T + 0.0842L + 0.0541R + 0.0326C + 0.0326M)
            </div>
            <div className="text-sm border-l-2 border-brand-fault pl-3 py-1">
              <strong className="text-text-primary">Variables:</strong> A=availability ÷ 99%, F=failover ÷ 100%; E, T, L, R, C, and M are the inverted normalized error, MTTR, latency, restart, CPU, and memory values. Every value is clamped to 0–1. Maximum score: 100 points.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {runtimeRules.map((rule) => {
              const IconComponent = iconMap[rule.icon];
              return (
                <div key={rule.title} className="bg-background border border-border p-4 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-fault"></div>
                  <div className="flex items-center gap-2 mb-2">
                    {IconComponent && <IconComponent className="w-4 h-4 text-brand-fault" />}
                    <h4 className="font-bold text-sm">{rule.title}</h4>
                  </div>
                  <p className="text-xs text-text-muted mb-2">{rule.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono bg-surface-secondary px-2 py-1 rounded border border-border/50">
                      Threshold: {rule.threshold}
                    </span>
                    <span className="text-xs font-bold text-brand-fault">+{rule.points} pts</span>
                  </div>
                </div>
              );
            })}
          </div>

        </section>

        {/* Phase 2: Calculation Process */}
        <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Phase 2: Calculation Process</h2>
              <p className="text-sm text-text-muted mt-1">Step-by-step algorithm for computing the resilience score.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-fault/20 text-brand-fault flex items-center justify-center text-xs font-bold">1</div>
                  <h3 className="font-bold text-sm">Collect Metrics</h3>
                </div>
                <p className="text-sm text-text-muted ml-9">Read CPU, memory, latency, errors, availability, pod restarts, MTTR, and failover data from all active services.</p>
              </div>
              <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-fault/20 text-brand-fault flex items-center justify-center text-xs font-bold">2</div>
                  <h3 className="font-bold text-sm">Aggregate Data</h3>
                </div>
                <p className="text-sm text-text-muted ml-9">Calculate averages for CPU, memory, latency, error rate, MTTR, and failover success. Count offline services(Pods) and total restarts.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-fault/20 text-brand-fault flex items-center justify-center text-xs font-bold">3</div>
                  <h3 className="font-bold text-sm">Evaluate Rules</h3>
                </div>
              <p className="text-sm text-text-muted ml-9">Normalize each aggregate against its reference target, invert adverse metrics, and clamp all results to 0–1.</p>
              </div>
              <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 h-6 rounded-full bg-brand-fault/20 text-brand-fault flex items-center justify-center text-xs font-bold">4</div>
                  <h3 className="font-bold text-sm">Compute Score</h3>
                </div>
                <p className="text-sm text-text-muted ml-9">Multiply each normalized value by its AHP weight, sum the contributions, and publish the R-Score (0–100).</p>
              </div>
            </div>
          </div>
        </section>

        {/* Phase 3: Worked Example */}
        <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Phase 3: Example Metric Inputs</h2>
              <p className="text-sm text-text-muted mt-1">The example values below are illustrative; the live R-Score uses the normalized AHP weighted formula above.</p>
            </div>
          </div>

          <div className="bg-background border border-border p-5 rounded-lg">
            <p className="text-sm text-text-secondary mb-4">
              <strong className="text-text-primary">Scenario:</strong> Let's say your system has these current metrics:
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Availability</div>
                <div className="font-mono font-bold text-green-400">99.2%</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">CPU</div>
                <div className="font-mono font-bold text-green-400">45%</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Memory</div>
                <div className="font-mono font-bold text-red-400">82%</div>
                <div className="text-xs text-red-400 mt-1">✗ Fail</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Error Rate</div>
                <div className="font-mono font-bold text-green-400">0.3%</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Pod Restarts</div>
                <div className="font-mono font-bold text-green-400">0</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">MTTR</div>
                <div className="font-mono font-bold text-red-400">18s</div>
                <div className="text-xs text-red-400 mt-1">✗ Fail</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Response Time</div>
                <div className="font-mono font-bold text-green-400">26ms</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
              <div className="bg-surface-secondary p-3 rounded-lg border border-border/50 text-center">
                <div className="text-xs text-text-muted mb-1">Failover</div>
                <div className="font-mono font-bold text-green-400">100%</div>
                <div className="text-xs text-green-400 mt-1">✓ Pass</div>
              </div>
            </div>

            <div className="bg-surface-secondary p-4 rounded border border-border/50 mb-4">
              <div className="text-xs text-text-muted mb-3 text-center">Step-by-Step Calculation:</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>Availability contributes: <span className="text-green-400 font-bold">+26.63 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">26.63 × 1 = 26.63</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>CPU contributes: <span className="text-green-400 font-bold">+1.17 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">3.26 × (1 − 45/70) = 1.17</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>Memory (M) fails: <span className="text-red-400 font-bold">+0 points</span></span>
                  <span className="font-mono text-xs bg-red-400/10 px-2 py-1 rounded">3.26 × clamp(1 − 82/75) = 0</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>Error Rate contributes: <span className="text-green-400 font-bold">+10.40 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">14.86 × (1 − 0.3/1) = 10.40</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>Pod Restarts contribute: <span className="text-green-400 font-bold">+5.41 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">5.41 × (1 − 0/2) = 5.41</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>MTTR (T) fails: <span className="text-red-400 font-bold">+0 points</span></span>
                  <span className="font-mono text-xs bg-red-400/10 px-2 py-1 rounded">14.05 × clamp(1 − 18/15) = 0</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <span>Latency contributes: <span className="text-green-400 font-bold">+4.04 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">8.42 × (1 − 26/50) = 4.04</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Failover contributes: <span className="text-green-400 font-bold">+24.11 points</span></span>
                  <span className="font-mono text-xs bg-green-400/10 px-2 py-1 rounded">24.11 × (100/100) = 24.11</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t-2 border-brand-fault text-center">
                <div className="font-mono font-bold text-lg">
                  Total: 26.63 + 1.17 + 0 + 10.40 + 5.41 + 0 + 4.04 + 24.11 = <span className="text-brand-fault text-2xl">71.8 points</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm bg-orange-400/10 p-3 rounded-lg border border-orange-400/30">
              <XCircle className="w-5 h-5 text-orange-400 shrink-0" />
              <span className="text-text-secondary"><strong className="text-text-primary">Result:</strong> 71.8/100 points. Reduced memory and recovery performance lower the score; outcome and recovery metrics carry the largest influence.</span>
            </div>
          </div>
        </section>

        {/* Phase 4: Engineering Assessment Criteria */}
        <section className="bg-surface border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Phase 4: Engineering Assessment Criteria</h2>
              <p className="text-sm text-text-muted mt-1">Weighted evaluation of architectural fault tolerance capabilities (separate from live R-Score).</p>
            </div>
          </div>

          <div className="bg-surface-secondary/50 p-4 rounded-lg border border-border/50 mb-6">
            <p className="text-sm text-text-primary">
              <strong className="text-brand-fault">Weight System:</strong> Higher weights (1.5x) give criteria more influence on the overall dimension score. Critical resilience patterns like Circuit Breakers and Failover have higher weights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessmentCriteria.map((item) => (
              <div key={item.criterion} className="bg-background border border-border p-4 rounded-lg flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-fault/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand-fault">{item.weight}x</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-text-primary">{item.criterion}</h4>
                  <p className="text-xs text-text-muted mt-1">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Phase 5: Supporting Recovery Signals */}
        <section className="bg-brand-fault/5 border border-brand-fault/20 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 rounded-full bg-brand-fault/20 text-brand-fault flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Phase 5: Supporting Recovery Signals</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-background p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-5 h-5 text-brand-fault" />
                <h3 className="font-bold text-sm">MTTR Dynamics</h3>
              </div>
              <p className="text-xs text-text-muted">
                <strong className="text-text-primary">Normal:</strong> 12 seconds<br/>
                <strong className="text-text-primary">Degraded:</strong> 18 seconds<br/>
                Increases when services are offline or degraded.
              </p>
            </div>

            <div className="bg-background p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-brand-fault" />
                <h3 className="font-bold text-sm">Failover Success Rate</h3>
              </div>
              <p className="text-xs text-text-muted">
                <strong className="text-text-primary">Healthy:</strong> 100%<br/>
                <strong className="text-text-primary">1 Service Affected:</strong> 80%<br/>
                <strong className="text-text-primary">Multiple Affected:</strong> 65%
              </p>
            </div>

            <div className="bg-background p-4 rounded-lg border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-brand-fault" />
                <h3 className="font-bold text-sm">Chaos Experiments</h3>
              </div>
              <p className="text-xs text-text-muted">
                Injects fault scenarios: Service outage, latency spikes, API errors, CPU stress, memory pressure, rate limiting, and cascading failures.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
