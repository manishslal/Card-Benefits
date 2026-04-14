'use client';

import { useRef, useState, useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';

/**
 * SwipeToBenefitUsed — swipe-right gesture wrapper for benefit cards (mobile)
 *
 * Architecture decisions:
 * - Uses NATIVE touch event listeners (non-passive touchmove) so we can call
 *   preventDefault() to stop the browser from scrolling during a horizontal swipe.
 *   React's synthetic onTouchMove is registered passive since React 17, making
 *   preventDefault() a no-op there.
 * - `touch-action: pan-y` on the container tells the compositor "you handle
 *   vertical scroll; we own horizontal gestures" — belt + suspenders.
 * - Internal offset tracked via ref (offsetRef) to avoid stale closures in the
 *   touchEnd handler. State (displayOffset) drives rendering only.
 * - Slide-out animation: on trigger the card translateX's to the container width
 *   and opacity fades to 0. After the CSS transition completes (~300ms) we call
 *   onMarkUsed which triggers the parent's optimistic update and unmounts us.
 * - Colors use design tokens (--color-success, --color-success-light) — no
 *   hard-coded rgba values.
 * - touchcancel is handled identically to touchend for robustness.
 * - Pending timeouts are tracked and cleared on effect cleanup / unmount.
 */

/* ─── Tuning constants ─────────────────────────────────────── */
/** Minimum dampened px to trigger the action */
const SWIPE_THRESHOLD = 90;
/** Raw px of movement before we lock the swipe direction */
const DIRECTION_LOCK_PX = 10;
/** Rubber-band dampening (< 1 = resistance) */
const DAMPING = 0.55;
/** Max dampened offset while dragging */
const MAX_OFFSET = 180;

type SwipePhase = 'idle' | 'swiping' | 'animating-out' | 'success';

interface SwipeToBenefitUsedProps {
  children: React.ReactNode;
  benefitId: string;
  isUsed: boolean;
  onMarkUsed?: (benefitId: string) => void;
  disabled?: boolean;
}

export function SwipeToBenefitUsed({
  children,
  benefitId,
  isUsed,
  onMarkUsed,
  disabled = false,
}: SwipeToBenefitUsedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Internal refs — never trigger renders ── */
  const offsetRef = useRef(0);
  const phaseRef = useRef<SwipePhase>('idle');

  /* ── Render-driving state ── */
  const [displayOffset, setDisplayOffset] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>('idle');

  const isSwipeEnabled = !disabled && !isUsed && !!onMarkUsed;

  /* Stable ref for latest onMarkUsed — avoids stale closures in timeouts */
  const onMarkUsedRef = useRef(onMarkUsed);
  useEffect(() => { onMarkUsedRef.current = onMarkUsed; }, [onMarkUsed]);

  /* Reset when the benefit is marked used externally (e.g. via button click).
     Skip reset if we're mid-animation — our own timeout will handle it. */
  useEffect(() => {
    if (isUsed && phaseRef.current === 'idle') {
      offsetRef.current = 0;
      setDisplayOffset(0);
      setPhase('idle');
    }
  }, [isUsed]);

  /* ─── Native touch listeners (non-passive touchmove) ─────── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isSwipeEnabled) return;

    let startX = 0;
    let startY = 0;
    let dirLock: 'h' | 'v' | null = null;
    const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

    /* ── Preflight: Check for prefers-reduced-motion ── */
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onTouchStart = (e: TouchEvent) => {
      if (phaseRef.current !== 'idle') return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dirLock = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (
        phaseRef.current === 'animating-out' ||
        phaseRef.current === 'success'
      ) {
        return;
      }

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      /* Lock direction on first significant movement */
      if (!dirLock) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        // If vertical movement is dominant → let the browser scroll
        if (absDy > DIRECTION_LOCK_PX && absDy > absDx) {
          dirLock = 'v';
          return;
        }
        // If horizontal movement is dominant → we own this gesture
        if (absDx > DIRECTION_LOCK_PX) {
          dirLock = 'h';
          phaseRef.current = 'swiping';
          setPhase('swiping');
        }
        return; // wait until direction is determined
      }

      if (dirLock === 'v') return;

      /* We own this gesture — prevent the browser from scrolling */
      e.preventDefault();

      if (dx > 0) {
        const prevOffset = offsetRef.current;
        const dampened = Math.min(dx * DAMPING, MAX_OFFSET);
        offsetRef.current = dampened;
        setDisplayOffset(dampened);

        /* Haptic tick when crossing the threshold */
        if (prevOffset < SWIPE_THRESHOLD && dampened >= SWIPE_THRESHOLD) {
          try {
            navigator?.vibrate?.(10);
          } catch {
            /* no haptic support — fine */
          }
        }
      } else {
        // Left swipe (negative dx) — clamp to 0
        offsetRef.current = 0;
        setDisplayOffset(0);
      }
    };

    const onTouchEnd = () => {
      if (
        phaseRef.current === 'animating-out' ||
        phaseRef.current === 'success'
      ) {
        return;
      }

      if (dirLock !== 'h') {
        // No horizontal gesture detected — reset
        dirLock = null;
        if (phaseRef.current === 'swiping') {
          phaseRef.current = 'idle';
          setPhase('idle');
        }
        return;
      }

      const offset = offsetRef.current;

      if (offset >= SWIPE_THRESHOLD) {
        /* ── Triggered! Slide the card off the right edge ── */
        phaseRef.current = 'animating-out';
        setPhase('animating-out');

        const cardWidth = el.offsetWidth || 320;
        offsetRef.current = cardWidth + 20;
        setDisplayOffset(cardWidth + 20);

        /* After the slide-out CSS transition, show success + call handler.
           The parent's optimistic update (setBenefits) fires synchronously
           inside onMarkUsed which will unmount this component — so the
           success overlay only flashes for one React render. That's fine
           because the card reappears in the "Used" accordion. */
        const slideOutMs = prefersReducedMotion ? 10 : 300;
        const t1 = setTimeout(() => {
          phaseRef.current = 'success';
          setPhase('success');
          onMarkUsedRef.current?.(benefitId);

          /* Auto-reset (in case the parent does NOT immediately set isUsed) */
          const t2 = setTimeout(() => {
            offsetRef.current = 0;
            phaseRef.current = 'idle';
            setDisplayOffset(0);
            setPhase('idle');
          }, 900);
          pendingTimeouts.push(t2);
        }, slideOutMs);
        pendingTimeouts.push(t1);
      } else {
        /* Below threshold — spring back */
        offsetRef.current = 0;
        setDisplayOffset(0);
        phaseRef.current = 'idle';
        setPhase('idle');
      }

      dirLock = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      pendingTimeouts.forEach(clearTimeout);
    };
  }, [isSwipeEnabled, benefitId]);

  /* ─── Derived values for rendering ─── */
  const progress = Math.min(displayOffset / SWIPE_THRESHOLD, 1);
  const isPastThreshold = progress >= 1;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-lg"
      style={{
        /* Let the browser handle vertical scroll; we own horizontal */
        touchAction: isSwipeEnabled ? 'pan-y' : undefined,
      }}
    >
      {/* ── Green reveal layer (behind the card) ── */}
      {isSwipeEnabled && (displayOffset > 0 || phase === 'success') && (
        <>
          {/* Solid green backdrop — opacity ramps up with progress */}
          <div
            className="absolute inset-0 rounded-lg"
            style={{
              backgroundColor: 'var(--color-success)',
              opacity:
                isPastThreshold || phase === 'success' ? 1 : progress * 0.85,
              transition:
                phase === 'swiping' ? 'none' : 'opacity 0.2s ease',
            }}
            aria-hidden="true"
          />

          {/* Checkmark + "Used" text */}
          <div
            className="absolute inset-y-0 left-0 flex items-center pl-4 z-[1]"
            style={{
              opacity: Math.max(0, (progress - 0.2) / 0.8),
              transition:
                phase === 'swiping' ? 'none' : 'opacity 0.15s ease',
            }}
            aria-hidden="true"
          >
            <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
              <Check
                size={20}
                strokeWidth={2.5}
                style={{
                  transform: `scale(${0.7 + progress * 0.45})`,
                  transition:
                    phase === 'swiping' ? 'none' : 'transform 0.15s ease',
                }}
              />
              {isPastThreshold && <span>Used</span>}
            </div>
          </div>
        </>
      )}

      {/* ── Success confirmation overlay (briefly visible if parent
           doesn't unmount us immediately via optimistic update) ── */}
      {phase === 'success' && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 rounded-lg pointer-events-none"
          style={{ backgroundColor: 'var(--color-success-light)' }}
        >
          <div
            className="flex items-center gap-2 font-semibold animate-scale-in"
            style={{
              color: 'var(--color-success)',
              fontSize: 'var(--text-body-sm)',
            }}
          >
            <Check size={20} strokeWidth={2.5} />
            <span>Marked as Used</span>
          </div>
        </div>
      )}

      {/* ── Card content — translates right on swipe ── */}
      <div
        style={{
          transform: `translateX(${displayOffset}px)`,
          opacity: phase === 'animating-out' ? 0 : 1,
          transition:
            phase === 'swiping'
              ? 'none' // immediate tracking during drag
              : phase === 'animating-out'
                ? 'transform 0.3s var(--ease-out, cubic-bezier(0, 0, 0.2, 1)), opacity 0.25s ease'
                : 'transform 0.3s var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1)), opacity 0.25s ease',
          willChange: phase === 'swiping' ? 'transform' : undefined,
        }}
      >
        {children}
      </div>

      {/* ── Swipe hint — subtle left-edge chevron for discoverability ── */}
      {isSwipeEnabled && displayOffset === 0 && phase === 'idle' && (
        <div
          className="absolute inset-y-0 left-0 w-5 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <ChevronRight
            size={12}
            style={{
              color: 'var(--color-success)',
              opacity: 0.4,
            }}
          />
        </div>
      )}
    </div>
  );
}
