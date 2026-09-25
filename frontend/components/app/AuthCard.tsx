import { Logo } from '@/components/app/Logo';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/60 px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-[420px] rounded-2xl border bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
    </div>
  );
}
