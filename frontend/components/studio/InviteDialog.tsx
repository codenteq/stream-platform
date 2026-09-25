'use client';

import { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { studioInviteUrl } from '@/lib/api';

export function InviteDialog({ open, onOpenChange, studioCode }: { open: boolean; onOpenChange: (o: boolean) => void; studioCode: string }) {
  const [copied, setCopied] = useState(false);
  const url = studioInviteUrl(studioCode);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-primary">
            <Link2 className="h-5 w-5" />
          </div>
          <DialogTitle>Misafir davet et</DialogTitle>
          <DialogDescription>
            Bu linki paylaşın. Misafirler hesap açmadan tarayıcıdan katılır ve siz sahneye ekleyene kadar kuliste bekler.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
          <Button onClick={copy} className="shrink-0 gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Kopyalandı' : 'Kopyala'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
