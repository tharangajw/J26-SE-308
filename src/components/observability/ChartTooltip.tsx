import React from 'react';

export const ChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md text-slate-200">
        <p className="text-slate-300 text-sm mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="text-sm font-semibold">
            {p.name}: {p.value.toFixed ? p.value.toFixed(1) : p.value} {p.unit || ''}
          </p>
        ))}
      </div>
    );
  }
  return null;
};
