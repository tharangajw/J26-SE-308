import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  Settings, 
  Network, 
  FileCheck, 
  FileText,
  Calculator,
  History,
  ServerCog,
  Eye,
  Zap,
  Shield,
  Flame,
  GitMerge,
  ChevronDown,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  Wrench,
  GitPullRequest
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  end?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, end = false }) => {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        twMerge(
          clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors min-w-0',
            'hover:bg-surface-secondary hover:text-text-primary',
            isActive
              ? 'bg-surface-secondary text-text-primary border border-border/50 shadow-sm'
              : 'text-text-secondary'
          )
        )
      }
    >
      <span className="shrink-0 w-4 h-4 flex items-center justify-center text-text-muted">
        {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4 shrink-0' })}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="shrink-0 rounded-full border border-brand-obs/40 bg-brand-obs/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-obs">
          {badge}
        </span>
      )}
    </NavLink>
  );
};

interface NavGroupProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
}

const NavGroup: React.FC<NavGroupProps> = ({ icon, label, children, defaultOpen = false, compact = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between rounded-md text-sm font-medium transition-colors text-text-secondary hover:bg-surface-secondary hover:text-text-primary',
          compact ? 'px-2 py-1.5' : 'px-3 py-2'
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 w-4 h-4 flex items-center justify-center">
            {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4 shrink-0' })}
          </span>
          <span className="truncate">{label}</span>
        </div>
        <ChevronDown className={clsx('w-4 h-4 shrink-0 transition-transform', { '-rotate-90': !isOpen })} />
      </button>
      {isOpen && (
        <div className={clsx(
          'space-y-1 border-l border-border/60 mt-1',
          compact ? 'ml-2 pl-2' : 'ml-4 pl-2.5'
        )}>
          {children}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 h-screen border-r border-border bg-background flex flex-col fixed left-0 top-0">
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-text-primary flex items-center justify-center">
            <Network className="w-4 h-4 text-background" />
          </div>
          <span className="font-semibold text-sm tracking-wide">ArchMaturity</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-text-muted">General</div>
          <nav className="space-y-1">
            <NavItem to="/" icon={<LayoutDashboard />} label="Overview" end={true} />
            <NavItem to="/assessment" icon={<Activity />} label="Assessment" />
            <NavGroup icon={<Eye />} label="Observability">
              <NavItem to="/dimensions/observability/overview" icon={<LayoutDashboard />} label="Overview" />
              <NavItem to="/dimensions/observability/detail" icon={<Activity />} label="Telemetry Explorer" />
              <NavItem to="/dimensions/observability/cci-audit" icon={<FileCheck />} label="CCI Audit" />
              <NavItem to="/dimensions/observability/history" icon={<History />} label="O-Score History" />
              <NavItem to="/dimensions/observability/calculation" icon={<Calculator />} label="Calculation Logic" />
              <NavGroup icon={<Sparkles />} label="AI & Operations" defaultOpen={true} compact>
                <NavItem to="/dimensions/observability/ai-analysis" icon={<Sparkles />} label="AI Analysis" badge="New" />
                <NavItem to="/dimensions/observability/remediation" icon={<Wrench />} label="Remediation" badge="AI" />
              </NavGroup>
            </NavGroup>
            <NavGroup icon={<Zap />} label="Performance">
              <NavItem to="/dimensions/performance/collection" icon={<ServerCog />} label="1. Telemetry Collection" />
              <NavItem to="/dimensions/performance/drift" icon={<TrendingUp />} label="2A. Latency Drift (40%)" />
              <NavItem to="/dimensions/performance/fanout" icon={<GitMerge />} label="2B. Call-Tree Fan-Out (40%)" />
              <NavItem to="/dimensions/performance/anomaly" icon={<ShieldAlert />} label="2C. ML Anomaly (20%)" />
              <NavItem to="/dimensions/performance" icon={<LayoutDashboard />} label="3. Composite P-Score" end />
              <NavItem to="/dimensions/performance/calculation" icon={<Calculator />} label="Calculation Logic" />
            </NavGroup>
            <NavGroup icon={<Shield />} label="Fault Tolerance">
              <NavItem to="/dimensions/FaultToleranceDashboard" icon={<LayoutDashboard />} label="Overview" />
              <NavLink
                to="/dimensions/fault-tolerance/chaos"
                className={({ isActive }) => twMerge(clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
                  'hover:bg-surface-secondary hover:text-text-primary',
                  isActive
                    ? 'bg-surface-secondary text-text-primary border border-border/50 shadow-sm'
                    : 'text-text-secondary'
                ))}
              >
                <Flame className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">Chaos Engineering Suite</span>
              </NavLink>
              <NavItem to="/dimensions/fault-tolerance/history" icon={<History />} label="R-Score History" />
              <NavItem to="/dimensions/fault-tolerance/calculation" icon={<Calculator />} label="Calculation Logic" />
            </NavGroup>
            <NavGroup icon={<GitMerge />} label="CI/CD Integration" defaultOpen={true}>
              <NavItem to="/dimensions/cicd" icon={<LayoutDashboard />} label="Overview" end={true} />
              <NavItem to="/phase1/coupling" icon={<GitPullRequest />} label="Phase 1: Coupling" />
              <NavItem to="/phase2/blast-radius" icon={<Network />} label="Phase 2: Blast Radius" />
              <NavItem to="/phase3/telemetry" icon={<Activity />} label="Phase 3: Telemetry" />
              <NavItem to="/dimensions/cicd/calculation" icon={<Calculator />} label="Calculation Logic" />
            </NavGroup>
          </nav>
        </div>

        <div>
          <div className="px-3 mb-2 text-[10px] uppercase tracking-wider font-semibold text-text-muted">Analysis</div>
          <nav className="space-y-1">
            <NavItem to="/architecture" icon={<Network />} label="Architecture" />
            <NavItem to="/evidence" icon={<FileCheck />} label="Evidence" />
            <NavItem to="/reports" icon={<FileText />} label="Reports" />
          </nav>
        </div>
      </div>

      <div className="p-3 border-t border-border/50">
        <div className="px-3 py-2 rounded bg-surface-secondary/50 border border-border/50 mb-2 flex flex-col gap-1">
          <span className="text-xs font-medium text-text-primary">Research Project v2.1</span>
          <span className="text-[10px] text-text-muted">Assessment Profile Active</span>
        </div>
        <nav className="space-y-1">
          <NavItem to="/settings" icon={<Settings />} label="Settings" />
        </nav>
      </div>
    </aside>
  );
};
