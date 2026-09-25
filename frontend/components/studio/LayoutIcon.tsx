import type { LayoutId } from '@/lib/studio/types';

/** Düzen seçici için minik düzen şemaları */
export function LayoutIcon({ layout, className }: { layout: LayoutId; className?: string }) {
  const r = (x: number, y: number, w: number, h: number, k?: string) => <rect key={k ?? `${x}${y}${w}${h}`} x={x} y={y} width={w} height={h} rx={1.2} />;
  let shapes: JSX.Element[] = [];
  switch (layout) {
    case 'solo':
      shapes = [r(4, 3, 32, 18)];
      break;
    case 'thin':
      shapes = [r(4, 3, 7.4, 18), r(12.6, 3, 7.4, 18), r(21.2, 3, 7.4, 18), r(29.8, 3, 6.2, 18)];
      break;
    case 'group':
      shapes = [r(4, 3, 15.5, 8.5), r(20.5, 3, 15.5, 8.5), r(4, 12.5, 15.5, 8.5), r(20.5, 12.5, 15.5, 8.5)];
      break;
    case 'leader':
      shapes = [r(9, 2, 22, 12.5), r(7, 16, 8, 6), r(16, 16, 8, 6), r(25, 16, 8, 6)];
      break;
    case 'screen':
      shapes = [r(3, 4, 26, 16), r(30.5, 4, 6.5, 4.5), r(30.5, 9.75, 6.5, 4.5), r(30.5, 15.5, 6.5, 4.5)];
      break;
    case 'pip':
      shapes = [
        <rect key="bg" x={4} y={3} width={32} height={18} rx={1.2} />,
        <rect key="pip" x={25} y={14} width={9} height={5} rx={1} className="fill-background stroke-current" strokeWidth={1} />,
      ];
      break;
    case 'cinema':
      shapes = [
        <rect key="bg" x={4} y={3} width={32} height={18} rx={1.2} />,
        <rect key="a" x={12} y={15} width={7} height={4} rx={0.8} className="fill-background stroke-current" strokeWidth={0.8} />,
        <rect key="b" x={21} y={15} width={7} height={4} rx={0.8} className="fill-background stroke-current" strokeWidth={0.8} />,
      ];
      break;
  }
  return (
    <svg viewBox="0 0 40 24" className={className} fill="currentColor" aria-hidden>
      {shapes}
    </svg>
  );
}
