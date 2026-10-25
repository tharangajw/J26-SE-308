// Navigation for the Observability detail, CCI, RCA, remediation, and calculation views.
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'logs', label: 'Logs' },
  { id: 'traces', label: 'Traces' },
  { id: 'chaos', label: 'Chaos Lab' },
];

interface Props { activeTab: string; onTabChange: (id: string) => void; }

export default function TabNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          id={`obs-tab-${tab.id}`}
          type="button"
          onClick={() => onTabChange(tab.id)}
          aria-selected={activeTab === tab.id}
          className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            activeTab === tab.id
              ? 'border-brand-obs/60 bg-brand-obs/10 text-brand-obs'
              : 'border-border bg-surface-secondary/40 text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
