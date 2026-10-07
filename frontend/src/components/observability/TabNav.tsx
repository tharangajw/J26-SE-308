const TABS = [
  { id: 'overview',    label: 'Overview',    emoji: '◉',  desc: 'O-Score & KPIs' },
  { id: 'metrics',     label: 'Metrics',     emoji: '📈', desc: 'Prometheus' },
  { id: 'logs',        label: 'Logs',        emoji: '📃', desc: 'Loki' },
  { id: 'traces',      label: 'Traces',      emoji: '🔗', desc: 'Jaeger' },
  { id: 'cci',         label: 'CCI Audit',   emoji: '⊞',  desc: 'Blind Spots' },
  { id: 'rca',         label: 'AI Analysis', emoji: '⚡', desc: 'Root Cause' },
  { id: 'remediation', label: 'Remediation', emoji: '⚙',  desc: 'Fix Scripts' },
  { id: 'chaos',       label: 'Chaos Lab',   emoji: '☢',  desc: 'Fault Inject' },
];

interface Props { activeTab: string; onTabChange: (id: string) => void; }

export default function TabNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="w-full overflow-hidden">
      <div className="obs-tab-rail overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`obs-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`obs-tab-pill ${activeTab === tab.id ? 'active' : ''}`}
            aria-selected={activeTab === tab.id}
          >
            {activeTab === tab.id && <span className="obs-tab-dot" />}
            <span style={{ fontSize: 15 }}>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
