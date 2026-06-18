'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getBackendLogs } from '@/lib/api';

export default function LogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await getBackendLogs(200);
      if (res.ok) { setLines(res.lines); setError(null); }
      else { setError(res.error || 'Failed'); }
    } catch { setError('Failed to load logs'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);
  useEffect(() => { if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backend Logs</h1>
        <div className="flex gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${autoRefresh ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-foreground/60'} `}>
            {autoRefresh ? '● Live' : 'Auto-refresh'}
          </button>
          <button onClick={load} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all">Refresh</button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm text-red-400" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-foreground/40 text-sm">Loading logs...</p>
      ) : lines.length === 0 ? (
        <p className="text-foreground/40 text-sm">No logs available.</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#0a0a0f', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="p-4 font-mono text-[11px] leading-relaxed max-h-[70vh] overflow-y-auto" style={{ color: '#a0a0b0' }}>
            {lines.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap hover:bg-white/[0.02] px-1 py-0.5 rounded"
                style={{
                  color: line.includes('error') || line.includes('Error') || line.includes('ERR')
                    ? '#ef4444'
                    : line.includes('warning') || line.includes('Warning')
                    ? '#f59e0b'
                    : line.includes('[Fill]') || line.includes('[AI]')
                    ? '#60a5fa'
                    : line.includes('[DB]')
                    ? '#34d399'
                    : 'inherit'
                }}>
                {line}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="px-4 py-2 text-[10px] border-t border-white/5 flex justify-between text-foreground/30">
            <span>{lines.length} lines</span>
            <span>Backend console output</span>
          </div>
        </div>
      )}
    </div>
  );
}
