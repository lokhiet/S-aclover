import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PixelCloverIcon } from './PixelIcons';

interface BurstLeaf {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  durationMs: number;
  sizeClass: string;
}

interface CloverBurst {
  id: number;
  x: number;
  y: number;
  leaves: BurstLeaf[];
}

const MAX_CONCURRENT_BURSTS = 2;
const BURST_CLEANUP_MS = 600;

function createBurstLeaves(): BurstLeaf[] {
  // 5 crisp pixel four-leaf clovers (within 4–6) radiating ~24–32px from click point
  const count = 5;
  const baseAngle = Math.random() * Math.PI * 2;

  return Array.from({ length: count }, (_, idx) => {
    const sector = (Math.PI * 2 * idx) / count;
    const angleJitter = (Math.random() - 0.5) * 0.42;
    const angle = baseAngle + sector + angleJitter;
    const radius = 23 + Math.random() * 9; // ~23px–32px (~30px radius)
    const dx = Math.round(Math.cos(angle) * radius);
    const dy = Math.round(Math.sin(angle) * radius);
    const rot = Math.round((Math.random() > 0.5 ? 1 : -1) * (16 + Math.random() * 22));
    const durationMs = Math.round(470 + Math.random() * 110); // 470–580ms (within 450–600ms)
    const sizeClass = idx % 2 === 0 ? 'w-3.5 h-3.5' : 'w-3 h-3';

    return {
      id: idx,
      dx,
      dy,
      rot,
      durationMs,
      sizeClass,
    };
  });
}

export default function CloverClickBurst() {
  const [bursts, setBursts] = useState<CloverBurst[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      // Trigger strictly on primary left mouse click (button === 0)
      if (event.button !== 0) return;

      // Respect prefers-reduced-motion: disable burst completely
      if (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }

      const id = nextIdRef.current++;
      const newBurst: CloverBurst = {
        id,
        x: event.clientX,
        y: event.clientY,
        leaves: createBurstLeaves(),
      };

      setBursts((prev) => {
        if (prev.length >= MAX_CONCURRENT_BURSTS) {
          const evicted = prev.slice(0, prev.length - (MAX_CONCURRENT_BURSTS - 1));
          for (const oldBurst of evicted) {
            const oldTimer = timersRef.current.get(oldBurst.id);
            if (oldTimer) {
              clearTimeout(oldTimer);
              timersRef.current.delete(oldBurst.id);
            }
          }
          return [...prev.slice(prev.length - (MAX_CONCURRENT_BURSTS - 1)), newBurst];
        }
        return [...prev, newBurst];
      });

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, BURST_CLEANUP_MS);

      timersRef.current.set(id, timer);
    };

    // Capture phase + passive ensures burst coordinates register immediately alongside any button/tab click without blocking or delaying native actions
    window.addEventListener('pointerdown', handlePointerDown, {
      capture: true,
      passive: true,
    });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, {
        capture: true,
      });
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-[60] select-none"
    >
      {bursts.map((burst) =>
        burst.leaves.map((leaf) => {
          const style = {
            left: `${burst.x}px`,
            top: `${burst.y}px`,
            animationDuration: `${leaf.durationMs}ms`,
            '--burst-x': `${leaf.dx}px`,
            '--burst-y': `${leaf.dy}px`,
            '--burst-rot': `${leaf.rot}deg`,
          } as CSSProperties;

          return (
            <span
              key={`${burst.id}-${leaf.id}`}
              style={style}
              className="clover-burst-leaf block"
            >
              <PixelCloverIcon className={`${leaf.sizeClass} block`} />
            </span>
          );
        }),
      )}
    </div>
  );
}
