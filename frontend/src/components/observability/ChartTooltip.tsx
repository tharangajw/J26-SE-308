export const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-text-primary shadow-sm">
        <p className="mb-1 text-sm text-text-secondary">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-medium">
            {p.name}: {p.value.toFixed ? p.value.toFixed(1) : p.value} {p.unit || ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};
