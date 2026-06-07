'use client';

import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface ChatMessage {
  isSystem?: boolean;
  sender?: string;
  content: string;
}

export default function Chat({ socket }: { socket: Socket | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
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

  return (
    <div className="flex flex-col h-full border-t border-white/10 pt-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Chat</p>
      <div className="flex-1 overflow-y-auto space-y-1 max-h-40 pr-1 scrollbar-thin">
        {messages.length === 0 && (
          <p className="text-[11px] text-zinc-600 italic">No messages yet...</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`text-xs leading-relaxed ${m.isSystem ? 'text-center italic font-bold text-yellow-400' : ''}`}>
            {m.isSystem ? (
              <span>{m.content}</span>
            ) : (
              <span><span className="text-zinc-400">{m.sender}: </span><span className="text-zinc-200">{m.content}</span></span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-1 mt-1">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Chat..."
          maxLength={200}
          className="flex-1 px-2 py-1 text-xs bg-white/5 border border-white/10 rounded text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button onClick={send} disabled={!input.trim()} className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white rounded transition-colors">
          Send
        </button>
      </div>
    </div>
  );
}
