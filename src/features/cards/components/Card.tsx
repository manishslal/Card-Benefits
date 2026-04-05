'use client';

import { useState } from 'react';
import { BenefitTable } from '@/features/benefits';
import { CreditCard, Calendar, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { getEffectiveROI, getUncapturedValue } from '@/features/cards/lib/calculations';
import { formatDateForUser } from '@/features/benefits/lib';
import type { UserCard } from '@/features/cards/lib/calculations';

/**
 * Card Component - Redesigned Card Tracker (Enhanced with Lucide Icons)
 *
 * Displays single credit card with:
 * - Card header with CreditCard icon (name, issuer, ROI badge)
 * - Renewal date with Calendar icon and annual fee
 * - Premium ROI display with TrendingUp/TrendingDown indicators
 * - Benefit count
 * - Expandable benefits table (click to toggle)
 * - Lucide icons for consistent visual language
 */

interface CardProps {
  card: UserCard;
  playerName?: string;
}


function formatCurrency(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  const isNegative = cents < 0;
  return isNegative ? `-$${Math.abs(Number(dollars))}` : `$${dollars}`;
}

/**
 * Format date for display in the user's local timezone
 * Uses UTC-aware formatting from benefitDates.ts for consistency
 */
function formatDate(date: Date): string {
  return formatDateForUser(date);
}

export default function Card({ card, playerName }: CardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const roi = getEffectiveROI(card, card.userBenefits);
  const isPositiveROI = roi >= 0;
  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
  const usedBenefitsCount = card.userBenefits.filter((b) => b.isUsed).length;
  const cardName = card.customName || card.masterCard.cardName;

  return (
    <div
      className="rounded-lg border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-primary)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-md)',
      }}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }
      }}
      aria-expanded={isExpanded}
    >
      {/* Card Header */}
      <div className="p-lg border-b" style={{ borderColor: 'var(--color-border)' }}>
        {/* Card Name + Issuer + ROI Badge */}
        <div className="flex items-start justify-between mb-md gap-md">
          <div className="flex items-start gap-md flex-1">
            {/* Card Icon */}
            <div className="flex-shrink-0 mt-1" style={{ color: 'var(--color-primary-500)' }}>
              <CreditCard className="w-5 h-5" />
            </div>
            
            <div className="flex-1">
              <h3
                className="font-semibold text-text-primary"
                style={{ fontSize: 'var(--font-h3)' }}
              >
                {cardName}
              </h3>
              <p
                className="text-text-secondary mt-xs"
                style={{ fontSize: 'var(--font-body-sm)' }}
              >
                {card.masterCard.issuer}
              </p>
              {playerName && (
                <p
                  className="text-text-tertiary mt-xs"
                  style={{ fontSize: 'var(--font-body-xs)' }}
                >
                  {playerName}
                </p>
              )}
            </div>
          </div>

          {/* ROI Badge - Right aligned with Icon, max-width constraint */}
          <div
            className="px-md py-sm rounded-full text-white font-semibold text-xs whitespace-nowrap flex items-center gap-xs"
            style={{
              backgroundColor: isPositiveROI
                ? 'var(--color-success-500)'
                : 'var(--color-danger-500)',
              maxWidth: '180px',
              flexShrink: 0,
              minWidth: 'auto',
            }}
          >
            {isPositiveROI ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {formatCurrency(roi)}
          </div>
        </div>

        {/* Card metadata row - Renewal Date + Annual Fee */}
        <div
          className="flex items-center justify-between gap-md"
          style={{
            fontSize: 'var(--font-body-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div className="flex items-center gap-sm">
            <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }} />
            <span>Renews {formatDate(card.renewalDate)}</span>
          </div>
          <div className="text-right">
            <span>Fee: {formatCurrency(annualFee)}</span>
          </div>
        </div>
      </div>

      {/* Card Body - Main metrics */}
      <div className="p-lg">
        {/* Large ROI Value - Net Benefit Section (PROMINENT) */}
        <div className="mb-lg p-md rounded-lg" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <p
            className="text-text-secondary mb-sm"
            style={{
              fontSize: 'var(--font-body-sm)',
              fontWeight: '600',
            }}
          >
            Net Benefit
          </p>
          <div className="flex items-baseline gap-md">
            <p
              className="font-bold"
              style={{
                fontSize: 'var(--font-h1)',
                color: isPositiveROI
                  ? 'var(--color-success-500)'
                  : 'var(--color-danger-500)',
              }}
            >
              {formatCurrency(roi)}
            </p>
            {isPositiveROI ? (
              <TrendingUp className="w-6 h-6" style={{ color: 'var(--color-success-500)' }} />
            ) : (
              <TrendingDown className="w-6 h-6" style={{ color: 'var(--color-danger-500)' }} />
            )}
          </div>
        </div>

        {/* Benefit Summary */}
        <div className="grid grid-cols-2 gap-md">
          {/* Used Benefits */}
          <div>
            <p
              className="text-text-secondary"
              style={{ fontSize: 'var(--font-body-sm)' }}
            >
              Used Benefits
            </p>
            <p
              className="font-semibold text-text-primary text-lg"
              style={{ fontSize: '20px' }}
            >
              {usedBenefitsCount}
            </p>
          </div>

          {/* Total Benefits */}
          <div>
            <p
              className="text-text-secondary"
              style={{ fontSize: 'var(--font-body-sm)' }}
            >
              Total Benefits
            </p>
            <p
              className="font-semibold text-text-primary text-lg"
              style={{ fontSize: '20px' }}
            >
              {card.userBenefits.length}
            </p>
          </div>
        </div>

        {/* Uncaptured Value */}
        <div className="mt-lg pt-lg border-t" style={{ borderColor: 'var(--color-border)' }}>
          <p
            className="text-text-secondary text-xs mb-xs"
            style={{ fontSize: 'var(--font-body-sm)' }}
          >
            Uncaptured Potential
          </p>
          <p
            className="font-semibold text-text-primary"
            style={{
              fontSize: 'var(--font-h3)',
              color: 'var(--color-alert-600)',
            }}
          >
            {formatCurrency(getUncapturedValue(card.userBenefits))}
          </p>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <div
        className="px-lg py-md border-t flex items-center justify-between"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
          style={{ fontSize: 'var(--font-body-sm)' }}
          aria-label={isExpanded ? 'Collapse benefits' : 'Expand benefits'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
          {isExpanded ? 'Hide' : 'View'} Benefits
        </button>
        <p
          className="text-text-secondary"
          style={{ fontSize: 'var(--font-body-sm)' }}
        >
          {card.userBenefits.length} benefit{card.userBenefits.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Expanded Benefits Table */}
      {isExpanded && (
        <div
          className="px-lg pb-lg border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <BenefitTable benefits={card.userBenefits} />
        </div>
      )}
    </div>
  );
}
