import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Search, Filter, AlertTriangle } from 'lucide-react';

const generateLogStats = () => {
  const data = [];
  const now = new Date();
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60000 * 5); // 5 min intervals
    data.push({
      time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      info: Math.floor(Math.random() * 500) + 200,
      error: Math.floor(Math.random() * 10) + (Math.random() > 0.8 ? 50 : 0) // Occasional spikes
    });
  }
  return data;
};

const MOCK_LOGS = [
  { time: '10:45:12.342', level: 'ERROR', service: 'order-service', msg: 'Failed to process payment for order #8329', traceId: 'a3f92b...' },
  { time: '10:45:12.110', level: 'INFO',  service: 'payment-gateway', msg: 'Payment request initiated for user 921', traceId: 'a3f92b...' },
  { time: '10:45:11.905', level: 'INFO',  service: 'order-service', msg: 'Validating cart inventory', traceId: 'a3f92b...' },
  { time: '10:45:09.554', level: 'WARN',  service: 'user-service', msg: 'High latency detected in db query', traceId: 'c9d12a...' },
  { time: '10:45:08.201', level: 'INFO',  service: 'api-gateway', msg: 'GET /api/orders/8329 - 200 OK', traceId: 'a3f92b...' },
  { time: '10:45:05.100', level: 'ERROR', service: 'book-service', msg: 'Connection timeout to MongoDB', traceId: '-' },
  { time: '10:45:02.000', level: 'INFO',  service: 'api-gateway', msg: 'POST /api/users/login - 200 OK', traceId: 'f1e2d3...' },
];

export default function LogsDashboard({ data }: any) {
  const logData = useMemo(() => generateLogStats(), []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800/90 border border-slate-700 p-3 rounded-lg shadow-xl backdrop-blur-md text-slate-200">
          <p className="text-slate-300 text-sm mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }} className="text-sm font-semibold">
              {p.name}: {p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Log Volume Chart */}
      <div className="obs-glass p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart className="w-5 h-5 text-indigo-400" />
            <h3 className="text-slate-300 font-medium">Log Volume (Last 2 Hours)</h3>
          </div>
          {data?.details?.log_error_count > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {data.details.log_error_count} Errors detected
            </div>
          )}
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={logData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickMargin={10} minTickGap={30} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="info" name="Info Logs" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
              <Bar dataKey="error" name="Error Logs" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log Explorer UI */}
      <div className="obs-glass p-0 overflow-hidden flex flex-col">
        {/* Search & Filter Bar */}
        <div className="border-b border-slate-700/50 p-4 bg-slate-800/30 flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search logs... (e.g., status:error service:order-service)" 
              className="w-full bg-slate-900/50 border border-slate-700 rounded-md py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-300 hover:bg-slate-700 transition-colors">
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Log Stream */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/50 text-slate-400 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-medium w-40">Timestamp</th>
                <th className="px-4 py-3 font-medium w-24">Level</th>
                <th className="px-4 py-3 font-medium w-40">Service</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium w-32">Trace ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono text-xs">
              {MOCK_LOGS.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-2.5 text-slate-500">{log.time}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      log.level === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      log.level === 'WARN'  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-indigo-300">{log.service}</td>
                  <td className={`px-4 py-2.5 truncate max-w-md ${log.level === 'ERROR' ? 'text-rose-300' : 'text-slate-300'}`}>
                    {log.msg}
                  </td>
                  <td className="px-4 py-2.5 text-sky-400 hover:underline cursor-pointer">
                    {log.traceId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
