'use client';

interface ProgressMeterProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

export function ProgressMeter({ label, value, max, color }: ProgressMeterProps) {
  const percentage = Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-medium mb-1.5">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-200 tabular-nums">
          {value.toLocaleString()} / {max.toLocaleString()} ({percentage}%)
        </span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
