'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, SendHorizontal } from 'lucide-react';
import { UserAvatar } from '@/components/app/UserAvatar';
import type { ChatMessage } from '@/lib/studio/types';
import { cn } from '@/lib/utils';

export function ChatPanel({ messages, localIdentity, onSend }: { messages: ChatMessage[]; localIdentity: string; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <MessageSquare className="mb-2 h-6 w-6" />
            <p className="text-sm">Özel sohbet</p>
            <p className="mt-1 text-xs">Mesajlar yalnızca stüdyodakiler tarafından görülür, yayına çıkmaz.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.identity === localIdentity;
          return (
            <div key={m.id} className={cn('flex gap-2', mine && 'flex-row-reverse')}>
              <UserAvatar name={m.name} size={26} className="mt-0.5" />
              <div className={cn('max-w-[80%]', mine && 'text-right')}>
                <p className="text-[11px] text-muted-foreground">
                  {mine ? 'Siz' : m.name} · {new Date(m.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p
                  className={cn(
                    'mt-0.5 inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-left text-sm',
                    mine ? 'rounded-tr-sm bg-primary text-primary-foreground' : 'rounded-tl-sm bg-secondary'
                  )}
                >
                  {m.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Stüdyoya mesaj yazın…"
          maxLength={500}
          className="h-10 flex-1 rounded-full border bg-muted/50 px-4 text-sm outline-none focus:border-primary focus:bg-background"
        />
        <button type="submit" disabled={!text.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Gönder">
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
