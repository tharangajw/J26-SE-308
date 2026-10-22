import React, { useMemo, useState } from 'react';

interface GraphNode {
  id: string;
  label: string;
}
interface GraphEdge {
  source: string;
  target: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const W = 380;
const H = 300;
const CX = W / 2;
const CY = H / 2 - 4;
const R_LAYOUT = 105;
const R_NODE = 26;

/** Color by how many services depend on this node (blast risk). */
const riskColor = (consumers: number) =>
  consumers > 1 ? '#f43f5e' : consumers === 1 ? '#a855f7' : '#10b981';

export const ServiceDependencyGraph: React.FC<Props> = ({ nodes, edges }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    const ids = nodes.map(n => n.id);
    const pos: Record<string, { x: number; y: number }> = {};
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      pos[id] = ids.length === 1
        ? { x: CX, y: CY }
        : { x: CX + R_LAYOUT * Math.cos(angle), y: CY + R_LAYOUT * Math.sin(angle) };
    });
    const incoming: Record<string, number> = {};
    const outgoing: Record<string, number> = {};
    ids.forEach(id => { incoming[id] = 0; outgoing[id] = 0; });
    edges.forEach(e => {
      if (e.target in incoming) incoming[e.target]++;
      if (e.source in outgoing) outgoing[e.source]++;
    });
    return { pos, incoming, outgoing };
  }, [nodes, edges]);

  const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const sx = a.x + ux * (R_NODE + 2);
    const sy = a.y + uy * (R_NODE + 2);
    const ex = b.x - ux * (R_NODE + 7);
    const ey = b.y - uy * (R_NODE + 7);
    // bend the line so opposite-direction edges don't overlap
    const mx = (sx + ex) / 2 - uy * dist * 0.16;
    const my = (sy + ey) / 2 + ux * dist * 0.16;
    return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
  };

  const isActiveEdge = (e: GraphEdge) => hovered === null || e.source === hovered || e.target === hovered;
  const isActiveNode = (id: string) =>
    hovered === null ||
    id === hovered ||
    edges.some(e => (e.source === hovered && e.target === id) || (e.target === hovered && e.source === id));

  return (
    <div className="relative rounded-lg bg-background/60 border border-border/50 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
        <defs>
          <radialGradient id="graphBg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
          </marker>
          <marker id="arrowDim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#52525b" />
          </marker>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R_LAYOUT + 40} fill="url(#graphBg)" />
        <circle cx={CX} cy={CY} r={R_LAYOUT} fill="none" stroke="#3f3f46" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.6" />

        {/* Edges (consumer -> provider) with flowing "request" animation */}
        {edges.map((e, i) => {
          const a = layout.pos[e.source];
          const b = layout.pos[e.target];
          if (!a || !b) return null;
          const active = isActiveEdge(e);
          return (
            <path
              key={`${e.source}-${e.target}-${i}`}
              d={edgePath(a, b)}
              fill="none"
              stroke={active ? '#a78bfa' : '#3f3f46'}
              strokeWidth={active ? 1.8 : 1}
              strokeDasharray="5 4"
              markerEnd={active ? 'url(#arrow)' : 'url(#arrowDim)'}
              opacity={active ? 0.95 : 0.35}
              style={{ transition: 'opacity 0.2s, stroke 0.2s' }}
            >
              <animate attributeName="stroke-dashoffset" from="18" to="0" dur="1.2s" repeatCount="indefinite" />
            </path>
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const p = layout.pos[n.id];
          if (!p) return null;
          const consumers = layout.incoming[n.id] ?? 0;
          const color = riskColor(consumers);
          const active = isActiveNode(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x}, ${p.y})`}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'pointer', opacity: active ? 1 : 0.3, transition: 'opacity 0.2s' }}
            >
              {/* pulse ring for services many others depend on */}
              {consumers > 1 && (
                <circle r={R_NODE} fill="none" stroke={color} strokeWidth="1.5">
                  <animate attributeName="r" from={R_NODE} to={R_NODE + 14} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle r={R_NODE} fill="#0f0f12" stroke={color} strokeWidth={hovered === n.id ? 3 : 2} filter="url(#nodeGlow)" />
              <circle r={R_NODE - 7} fill={color} opacity="0.18" />
              <text textAnchor="middle" dy="-1" fontSize="13" fontWeight="700" fill={color} fontFamily="ui-monospace, monospace">
                {consumers}
              </text>
              <text textAnchor="middle" dy="9" fontSize="6" fill="#a1a1aa" fontFamily="ui-monospace, monospace">
                callers
              </text>
              <text textAnchor="middle" y={R_NODE + 14} fontSize="10" fontWeight="600" fill="#e4e4e7" fontFamily="ui-monospace, monospace">
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pb-2.5 text-[10px] text-text-muted font-mono">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> 0 callers</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> 1 caller</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> 2+ callers</span>
      </div>
    </div>
  );
};
