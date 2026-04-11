'use client';

/**
 * CardArt Component — Sprint 3: Card Identity
 *
 * A pure-CSS mini credit card visual that renders issuer-specific gradient
 * backgrounds, a decorative chip element, and a card-network indicator.
 * Designed to be lightweight (no images/SVGs), accessible (aria-hidden),
 * and responsive across three size presets.
 *
 * Brand gradient colors are intentionally hardcoded — they represent
 * real-world card colors and must not change with the app's theme.
 */

// ---------------------------------------------------------------------------
// Gradient lookup
// ---------------------------------------------------------------------------

export interface GradientConfig {
  from: string;
  to: string;
  /** Optional tertiary stop for richer metallic effects */
  via?: string;
  /** Chip accent colour (gold vs silver) */
  chipColor: 'gold' | 'silver';
}

/**
 * Card-name gradient map. Keyed by a normalised substring so partial
 * matches work (e.g. "Chase Sapphire Reserve Credit Card" still matches).
 */
const CARD_NAME_GRADIENTS: Record<string, GradientConfig> = {
  'sapphire reserve': {
    from: '#003087',
    to: '#0047AB',
    chipColor: 'gold',
  },
  'sapphire preferred': {
    from: '#1A3C6E',
    to: '#2D5FA0',
    chipColor: 'silver',
  },
  'amex platinum': {
    from: '#8A8D8F',
    to: '#C0C0C0',
    via: '#A8AAAC',
    chipColor: 'silver',
  },
  platinum: {
    from: '#8A8D8F',
    to: '#C0C0C0',
    via: '#A8AAAC',
    chipColor: 'silver',
  },
  'gold card': {
    from: '#B8860B',
    to: '#DAA520',
    via: '#C4972F',
    chipColor: 'gold',
  },
  'amex gold': {
    from: '#B8860B',
    to: '#DAA520',
    via: '#C4972F',
    chipColor: 'gold',
  },
  'venture x': {
    from: '#1C1C1E',
    to: '#3A3A3C',
    chipColor: 'gold',
  },
  prestige: {
    from: '#002D72',
    to: '#004B9D',
    chipColor: 'silver',
  },
  'premium rewards': {
    from: '#8B0000',
    to: '#CC0000',
    chipColor: 'silver',
  },
  'it business': {
    from: '#FF6600',
    to: '#FF8C00',
    chipColor: 'silver',
  },
  'discover it': {
    from: '#FF6600',
    to: '#FF8C00',
    chipColor: 'silver',
  },
  propel: {
    from: '#C8102E',
    to: '#D4A843',
    chipColor: 'gold',
  },
  'arrival plus': {
    from: '#0099CC',
    to: '#00BCD4',
    chipColor: 'silver',
  },
};

/** Issuer-level fallback gradients (less specific). */
const ISSUER_GRADIENTS: Record<string, GradientConfig> = {
  chase: {
    from: '#003087',
    to: '#0047AB',
    chipColor: 'gold',
  },
  'american express': {
    from: '#8A8D8F',
    to: '#C0C0C0',
    via: '#A8AAAC',
    chipColor: 'silver',
  },
  amex: {
    from: '#8A8D8F',
    to: '#C0C0C0',
    via: '#A8AAAC',
    chipColor: 'silver',
  },
  'capital one': {
    from: '#1C1C1E',
    to: '#3A3A3C',
    chipColor: 'gold',
  },
  citi: {
    from: '#002D72',
    to: '#004B9D',
    chipColor: 'silver',
  },
  citibank: {
    from: '#002D72',
    to: '#004B9D',
    chipColor: 'silver',
  },
  'bank of america': {
    from: '#8B0000',
    to: '#CC0000',
    chipColor: 'silver',
  },
  discover: {
    from: '#FF6600',
    to: '#FF8C00',
    chipColor: 'silver',
  },
  'wells fargo': {
    from: '#C8102E',
    to: '#D4A843',
    chipColor: 'gold',
  },
  barclays: {
    from: '#0099CC',
    to: '#00BCD4',
    chipColor: 'silver',
  },
};

const DEFAULT_GRADIENT: GradientConfig = {
  from: '#6B7280',
  to: '#9CA3AF',
  chipColor: 'silver',
};

/**
 * Resolve the gradient for a given card.
 * First tries a card-name match (more specific), then falls back to issuer.
 * Exported so other components can reuse the colour lookup.
 */
export function getCardGradient(cardName: string, issuer: string): GradientConfig {
  const normName = (cardName ?? '').toLowerCase();
  const normIssuer = (issuer ?? '').toLowerCase();

  // 1. Card-name match (substring check so partial names still hit)
  for (const [key, config] of Object.entries(CARD_NAME_GRADIENTS)) {
    if (normName.includes(key)) return config;
  }

  // 2. Issuer fallback
  for (const [key, config] of Object.entries(ISSUER_GRADIENTS)) {
    if (normIssuer.includes(key) || normIssuer === key) return config;
  }

  // 3. Default neutral
  return DEFAULT_GRADIENT;
}

// ---------------------------------------------------------------------------
// Network label map
// ---------------------------------------------------------------------------

const NETWORK_LABELS: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'MC',
  amex: 'AMEX',
  discover: 'DISCOVER',
  other: '',
};

// ---------------------------------------------------------------------------
// Luminance helper — determines if network text should be dark or light
// ---------------------------------------------------------------------------

function hexToLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isLightGradient(gradient: GradientConfig): boolean {
  // Network text sits at bottom-right (the 'to' end of 135deg gradient)
  return hexToLuminance(gradient.to) > 0.35;
}

// ---------------------------------------------------------------------------
// Size presets (width x height in px, aspect ratio ~10:7)
// ---------------------------------------------------------------------------

interface SizeDimensions {
  width: number;
  height: number;
  chipW: number;
  chipH: number;
  networkFontSize: number;
  chipRadius: number;
}

const SIZE_MAP: Record<'sm' | 'md' | 'lg', SizeDimensions> = {
  sm: { width: 40, height: 28, chipW: 8,  chipH: 6,  networkFontSize: 5,  chipRadius: 1 },
  md: { width: 64, height: 45, chipW: 12, chipH: 9,  networkFontSize: 7,  chipRadius: 1.5 },
  lg: { width: 80, height: 56, chipW: 16, chipH: 12, networkFontSize: 9,  chipRadius: 2 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CardArtProps {
  cardName: string;
  issuer: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardArt({
  cardName,
  issuer,
  type,
  size = 'md',
  className = '',
}: CardArtProps) {
  const gradient = getCardGradient(cardName, issuer);
  const dims = SIZE_MAP[size];
  const networkLabel = NETWORK_LABELS[type] ?? '';
  const light = isLightGradient(gradient);

  // Adaptive network text color: dark on light gradients, white on dark
  const networkColor = light ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)';
  const networkShadow = light ? '0 0.5px 1px rgba(255,255,255,0.5)' : '0 0.5px 1px rgba(0,0,0,0.4)';

  // Build the CSS gradient string
  const gradientCSS = gradient.via
    ? `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.via} 50%, ${gradient.to} 100%)`
    : `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`;

  // Chip colour stops
  const chipBg =
    gradient.chipColor === 'gold'
      ? 'linear-gradient(135deg, #D4AF37 0%, #F5D060 50%, #C5A028 100%)'
      : 'linear-gradient(135deg, #C0C0C0 0%, #E8E8E8 50%, #A8A8A8 100%)';

  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-shrink-0 rounded-md overflow-hidden ${className}`}
      style={{
        width: dims.width,
        height: dims.height,
        background: gradientCSS,
        boxShadow: '0 1px 3px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.15)',
        borderTop: '1px solid rgba(255,255,255,0.25)',
        borderLeft: '1px solid rgba(255,255,255,0.10)',
        borderRight: '1px solid rgba(0,0,0,0.08)',
        borderBottom: '1px solid rgba(0,0,0,0.12)',
        position: 'relative',
      }}
    >
      {/* Decorative chip */}
      <span
        style={{
          position: 'absolute',
          top: '22%',
          left: '12%',
          width: dims.chipW,
          height: dims.chipH,
          borderRadius: dims.chipRadius,
          background: chipBg,
          boxShadow: '0 0.5px 1px rgba(0,0,0,0.25)',
        }}
      />

      {/* Network indicator (bottom-right) */}
      {networkLabel && (
        <span
          style={{
            position: 'absolute',
            bottom: '10%',
            right: '8%',
            fontSize: dims.networkFontSize,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1,
            color: networkColor,
            textShadow: networkShadow,
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            userSelect: 'none',
            pointerEvents: 'none' as const,
          }}
        >
          {networkLabel}
        </span>
      )}
    </span>
  );
}

export default CardArt;