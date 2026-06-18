'use client';

const GROUP_LABELS: Record<string, string> = {
  portuguese: '🇵🇹 Português',
  brazilian: '🇧🇷 Brasileiro',
  united_states: '🇺🇸 Estados Unidos',
  united_kingdom: '🇬🇧 Reino Unido',
  french: '🇫🇷 Français',
  spanish: '🇪🇸 Español',
  global_other: '🌍 Outros',
};

interface GenreSelectProps {
  value: string;
  onChange: (val: string) => void;
  genres: { id: string; label: string; group?: string }[];
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export default function GenreSelect({ value, onChange, genres, placeholder = 'Genre...', className = '', compact = false }: GenreSelectProps) {
  const groups = new Map<string, { id: string; label: string }[]>();
  for (const g of genres) {
    if (g.id === 'UNCLASSIFIED') continue;
    const key = g.group || 'global_other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }

  const baseStyle = compact
    ? 'text-[9px] px-1.5 py-0.5 max-w-[110px]'
    : 'text-[10px] px-2 py-1.5 max-w-[140px]';

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`${baseStyle} rounded-lg border outline-none ${className}`}
      style={{
        backgroundColor: 'color-mix(in srgb, var(--surface) 80%, transparent)',
        borderColor: 'color-mix(in srgb, var(--foreground) 15%, transparent)',
        color: 'var(--foreground)',
      }}
    >
      <option value="">{placeholder}</option>
      {Array.from(groups.entries()).map(([groupKey, gs]) => (
        <optgroup key={groupKey} label={GROUP_LABELS[groupKey] || groupKey}>
          {gs.map(g => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
