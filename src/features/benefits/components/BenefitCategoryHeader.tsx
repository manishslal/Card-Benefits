'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { BenefitCategory } from '@/lib/benefit-categories';
import {
  Plane, Utensils, Armchair, Hotel, Music, Tv, Tag,
  DollarSign, Star, Shield, Heart, Car, Landmark, Zap,
} from 'lucide-react';

interface BenefitCategoryHeaderProps {
  category: BenefitCategory;
  benefitCount: number;
  usedCount: number;
  urgentCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
}

const iconMap: Record<string, React.ElementType> = {
  Plane,
  Utensils,
  Armchair,
  Hotel,
  Music,
  Tv,
  Tag,
  DollarSign,
  Star,
  Shield,
  Heart,
  Car,
  Landmark,
  Zap,
};

function getCountSummary(total: number, used: number): string {
  if (used === total && total > 0) return 'All used ✓';
  if (used === 0) return `${total} available`;
  return `${used} of ${total} used`;
}

export const BenefitCategoryHeader = React.memo(function BenefitCategoryHeader({
  category,
  benefitCount,
  usedCount,
  urgentCount,
  isCollapsed,
  onToggle,
}: BenefitCategoryHeaderProps) {
  const IconComponent = iconMap[category.icon] || Zap;
  const summary = getCountSummary(benefitCount, usedCount);
  // Urgent categories cannot be collapsed
  const canCollapse = urgentCount === 0;

  return (
    <button
      type="button"
      onClick={() => { if (canCollapse) onToggle(); }}
      className="col-span-full w-full flex items-center gap-3 py-2.5 px-1 transition-colors"
      style={{
        cursor: canCollapse ? 'pointer' : 'default',
        borderBottom: '1px solid var(--color-border)',
        background: 'transparent',
      }}
      aria-expanded={!isCollapsed}
      aria-label={`${category.label} section, ${summary}, ${isCollapsed ? 'collapsed' : 'expanded'}`}
    >
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
      >
        <IconComponent
          size={15}
          style={{ color: 'var(--color-primary)' }}
          aria-hidden="true"
        />
      </div>

      <span
        className="font-semibold text-sm"
        style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--color-text)',
        }}
      >
        {category.label}
      </span>

      <span className="flex-1" />

      <span
        className="text-xs"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {summary}
      </span>

      {canCollapse && (
        <ChevronDown
          size={16}
          className="flex-shrink-0"
          style={{
            color: 'var(--color-text-secondary)',
            transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 200ms ease',
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
});

BenefitCategoryHeader.displayName = 'BenefitCategoryHeader';
export default BenefitCategoryHeader;
