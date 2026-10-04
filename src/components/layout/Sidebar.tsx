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
  Eye,
  Zap,
  Shield,
  GitMerge,
  ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        twMerge(
          clsx(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-surface-secondary hover:text-text-primary',
            isActive
              ? 'bg-surface-secondary text-text-primary border border-border/50 shadow-sm'
              : 'text-text-secondary'
          )
        )
      }
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
      {label}
    </NavLink>
  );
};

interface NavGroupProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const NavGroup: React.FC<NavGroupProps> = ({ icon, label, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
      >
        <div className="flex items-center gap-3">
          {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
          {label}
        </div>
        <ChevronDown className={clsx('w-4 h-4 transition-transform', { '-rotate-90': !isOpen })} />
      </button>
      {isOpen && (
        <div className="ml-4 space-y-1 border-l border-border/60 pl-3 mt-1">
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
            <NavItem to="/" icon={<LayoutDashboard />} label="Overview" />
            <NavItem to="/assessment" icon={<Activity />} label="Assessment" />
            <NavGroup icon={<Eye />} label="Observability">
              <NavItem to="/dimensions/observability/overview" icon={<LayoutDashboard />} label="Overview" />
              <NavItem to="/dimensions/observability/detail" icon={<Activity />} label="Telemetry Explorer" />
              <NavItem to="/dimensions/observability/history" icon={<History />} label="O-Score History" />
              <NavItem to="/dimensions/observability/calculation" icon={<Calculator />} label="Calculation Logic" />
            </NavGroup>
            <NavGroup icon={<Zap />} label="Performance">
              <NavItem to="/dimensions/performance" icon={<LayoutDashboard />} label="Overview" />
            </NavGroup>
            <NavGroup icon={<Shield />} label="Resilience">
              <NavItem to="/dimensions/FaultToleranceDashboard" icon={<LayoutDashboard />} label="Overview" />
              <NavItem to="/dimensions/fault-tolerance/history" icon={<History />} label="R-Score History" />
              <NavItem to="/dimensions/fault-tolerance/calculation" icon={<Calculator />} label="Calculation Logic" />
            </NavGroup>
            <NavGroup icon={<GitMerge />} label="CI/CD Integration">
              <NavItem to="/dimensions/cicd" icon={<LayoutDashboard />} label="Overview" />
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
