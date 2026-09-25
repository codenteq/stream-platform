import { Logo } from '@/components/app/Logo';
import { ProgramMonitor } from '@/components/app/ProgramMonitor';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[380px] py-10">
            <h1 className="font-display text-[32px] font-bold leading-tight">{title}</h1>
            <p className="mt-2 text-muted-foreground">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
          </div>
        </div>
      </div>
      <div className="hidden items-center justify-center bg-muted p-12 lg:flex">
        <ProgramMonitor className="w-full max-w-[620px]" />
      </div>
    </div>
  );
}
