'use client';

import { useState } from 'react';
import BenefitTable from './BenefitTable';

/**
 * Card Component - Redesigned Card Tracker
 * 
 * Displays single credit card with:
 * - Card header (name, issuer, ROI badge)
 * - Renewal date and annual fee
 * - ROI value prominently displayed
 * - Benefit count
 * - Expandable benefits table (click to toggle)
 * 
 * Design:
 * - Background: var(--color-bg-primary)
 * - Border: 1px var(--color-border)
 * - Border-radius: 12px
 * - Shadow: var(--shadow-md)
 * - Hover: shadow-lg, translateY(-2px), cursor pointer
 * - Transitions: all 200ms ease-in-out
 * 
 * Interactions:
 * - Click card or "Expand" button to show/hide benefits table
 * - Benefits table is collapsible (toggle state)
 * - Smooth expand/collapse animation
 */

interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string; // Can be 'StatementCredit' | 'UsagePerk'
  resetCadence: string;
  timesUsed: number;
}

interface MasterCard {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
}

interface UserCard {
  id: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date;
  isOpen: boolean;
  masterCard: MasterCard;
  userBenefits: UserBenefit[];
}

interface CardProps {
  card: UserCard;
}

/**
 * Get resolved benefit value
 */
function getResolvedValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * Calculate effective ROI for card
 * ROI = Sum of extracted benefits - Net annual fee
 */
function getEffectiveROI(card: UserCard): number {
  let extracted = 0;
  for (const benefit of card.userBenefits) {
    if (benefit.isUsed) {
      extracted += getResolvedValue(benefit);
    }
  }

  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
  return extracted - annualFee;
}

/**
 * Calculate total uncaptured value
 */
function getUncapturedValue(card: UserCard): number {
  const now = new Date();
  let total = 0;

  for (const benefit of card.userBenefits) {
    if (
      !benefit.isUsed &&
      benefit.expirationDate &&
      benefit.expirationDate > now
    ) {
      total += getResolvedValue(benefit);
    }
  }

  return total;
}

/**
 * Format currency
 */
function formatCurrency(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  const isNegative = cents < 0;
  return isNegative ? `-$${Math.abs(Number(dollars))}` : `$${dollars}`;
}

/**
 * Format date as "Jan 15, 2024"
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Card({ card }: CardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const roi = getEffectiveROI(card);
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
        {/* Card Name + ROI Badge */}
        <div className="flex items-start justify-between mb-md gap-md">
          <div>
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
          </div>

          {/* ROI Badge - Right aligned */}
          <div
            className="px-md py-sm rounded-full text-white font-semibold text-xs whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: isPositiveROI
                ? 'var(--color-success-500)'
                : 'var(--color-danger-500)',
            }}
          >
            {formatCurrency(roi)}
          </div>
        </div>

        {/* Card metadata row */}
        <div
          className="flex items-center justify-between gap-md"
          style={{
            fontSize: 'var(--font-body-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div>
            <span>Renews {formatDate(card.renewalDate)}</span>
          </div>
          <div className="text-right">
            <span>Annual Fee: {formatCurrency(annualFee)}</span>
          </div>
        </div>
      </div>

      {/* Card Body - Main metrics */}
      <div className="p-lg">
        {/* Large ROI Value */}
        <div className="mb-lg">
          <p
            className="text-text-secondary mb-xs"
            style={{
              fontSize: 'var(--font-body-sm)',
              fontWeight: '600',
            }}
          >
            Net Benefit
          </p>
          <p
            className="font-bold"
            style={{
              fontSize: 'var(--font-h2)',
              color: isPositiveROI
                ? 'var(--color-success-500)'
                : 'var(--color-danger-500)',
            }}
          >
            {formatCurrency(roi)}
          </p>
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
            {formatCurrency(getUncapturedValue(card))}
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
            e.stopPropagation(); // Prevent card click from propagating
            setIsExpanded(!isExpanded);
          }}
          className="flex items-center gap-sm font-medium text-primary-500 transition-colors hover:text-primary-600"
          style={{ fontSize: 'var(--font-body-sm)' }}
          aria-label={isExpanded ? 'Collapse benefits' : 'Expand benefits'}
        >
          {isExpanded ? '▼' : '▶'} {isExpanded ? 'Hide' : 'View'} Benefits
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
