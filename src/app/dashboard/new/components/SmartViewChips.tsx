'use client';

import { memo, useCallback } from 'react';
import { Layers, Clock, TrendingUp, CircleDot } from 'lucide-react';

// ============================================================
// Types
// ============================================================

/** Identifiers for each smart view filter. */
export type SmartViewKey =
  | 'all'
  | 'expiring-soon'
  | 'highest-value'
  | 'unused';

export interface SmartViewChipsProps {
  /** The currently active smart view (controlled). */
  activeView: SmartViewKey;
  /** Called when the user selects a different smart view. */
  onSmartView: (view: SmartViewKey) => void;
}

interface ChipDef {
  key: SmartViewKey;
  label: string;
  icon: React.ReactNode;
}

// ============================================================
// Constants
// ============================================================

const SMART_VIEWS: ChipDef[] = [
  {
    key: 'all',
    label: 'All',
    icon: <Layers size={14} aria-hidden="true" />,
  },
  {
    key: 'expiring-soon',
    label: 'Expiring Soon',
    icon: <Clock size={14} aria-hidden="true" />,
  },
  {
    key: 'highest-value',
    label: 'Highest Value',
    icon: <TrendingUp size={14} aria-hidden="true" />,
  },
  {
    key: 'unused',
    label: 'Unused',
    icon: <CircleDot size={14} aria-hidden="true" />,
  },
];

// ============================================================
// Sub-component: individual chip button
// ============================================================

const SmartViewChip = memo(function SmartViewChip({
  chip,
  isActive,
  onSelect,
}: {
  chip: ChipDef;
  isActive: boolean;
  onSelect: (key: SmartViewKey) => void;
}) {
  const handleClick = useCallback(() => {
    onSelect(chip.key);
  }, [chip.key, onSelect]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
      aria-label={`Filter: ${chip.label}`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full border whitespace-nowrap transition-colors"
      style={{
        backgroundColor: isActive
          ? 'var(--color-primary)'
          : 'var(--color-bg)',
        borderColor: isActive
          ? 'var(--color-primary)'
          : 'var(--color-border)',
        color: isActive
          ? 'var(--color-text-inverse)'
          : 'var(--color-text-secondary)',
        transitionDuration: 'var(--duration-base)',
      }}
    >
      <span className="flex items-center" aria-hidden="true">
        {chip.icon}
      </span>
      {chip.label}
    </button>
  );
});

SmartViewChip.displayName = 'SmartViewChip';

// ============================================================
// Main component: SmartViewChips
// ============================================================

/**
 * SmartViewChips renders a horizontal row of pill/chip toggles for
 * quick-filter smart views (All, Expiring Soon, Highest Value, Unused).
 *
 * Exactly one chip is active at a time (radio group semantics).
 * Fully controlled: activeView and onSmartView come from the parent.
 */
const SmartViewChips = memo(function SmartViewChips({
  activeView,
  onSmartView,
}: SmartViewChipsProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = SMART_VIEWS.findIndex((v) => v.key === activeView);
      let nextIndex = -1;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          nextIndex =
            currentIndex < SMART_VIEWS.length - 1 ? currentIndex + 1 : 0;
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          nextIndex =
            currentIndex > 0 ? currentIndex - 1 : SMART_VIEWS.length - 1;
          break;
        default:
          return;
      }

      const nextView = SMART_VIEWS[nextIndex];
      onSmartView(nextView.key);
      // Move focus to the newly active chip
      const container = e.currentTarget;
      const buttons = container.querySelectorAll<HTMLButtonElement>(
        'button[role="radio"]',
      );
      buttons[nextIndex]?.focus();
    },
    [activeView, onSmartView],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Quick filter views"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide"
    >
      {SMART_VIEWS.map((chip) => (
        <SmartViewChip
          key={chip.key}
          chip={chip}
          isActive={chip.key === activeView}
          onSelect={onSmartView}
        />
      ))}
    </div>
  );
});

SmartViewChips.displayName = 'SmartViewChips';

export { SmartViewChips };
