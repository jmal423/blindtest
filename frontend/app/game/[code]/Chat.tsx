'use client';

import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { useTranslation } from '@/lib/useTranslation';

interface ChatMessage {
  isSystem?: boolean;
  sender?: string;
  content: string;
  timestamp?: number;
}

const PLAYER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16'];

export default function Chat({ socket }: { socket: Socket | null }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev, { ...msg, timestamp: Date.now() }]);
    };
    socket.on('new_chat_message', handler);
    return () => { socket.off('new_chat_message', handler); };
  }, [socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim() || !socket) return;
    socket.emit('send_chat_message', { content: input.trim() });
    setInput('');
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getColor = (name?: string) => {
    if (!name) return '#6366f1';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return PLAYER_COLORS[Math.abs(hash) % PLAYER_COLORS.length];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">{t('chat_title')}</span>
        <span className="text-[10px] text-zinc-600">{messages.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-[11px] text-zinc-600 italic text-center py-4">{t('no_messages')}</p>
        )}
        {messages.map((m, i) => (
          m.isSystem ? (
            <div key={i} className="text-center py-1">
              <span className="text-[10px] font-bold text-yellow-400/80">{m.content}</span>
            </div>
          ) : (
            <div key={i} className="flex gap-1.5 items-baseline">
              <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{formatTime(m.timestamp)}</span>
              <span className="text-[11px] font-semibold shrink-0" style={{ color: getColor(m.sender) }}>{m.sender}</span>
              <span className="text-[11px] text-zinc-300 break-words">{m.content}</span>
            </div>
          )
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1.5 mt-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={t('message_placeholder')}
          maxLength={200}
          className="flex-1 px-3 py-1.5 text-[11px] bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[var(--primary)]/50 transition-colors"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="px-2.5 py-1.5 text-[11px] bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {t('send_btn')}
        </button>
      </div>
    </div>
  );
}