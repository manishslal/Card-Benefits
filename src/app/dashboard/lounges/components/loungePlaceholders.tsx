'use client';

import React from 'react';

interface PlaceholderProps {
  venueType: string;
  className?: string;
}

/* ── Inline SVG illustrations per venue type ─────────────── */

const LoungeSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Armchair silhouette */}
    <ellipse cx="100" cy="110" rx="60" ry="8" style={{ fill: 'var(--color-primary)', opacity: 0.1 }} />
    <path
      d="M60 90 C60 65, 70 55, 100 55 C130 55, 140 65, 140 90 L140 100 L60 100 Z"
      style={{ fill: 'var(--color-primary)', opacity: 0.25 }}
    />
    <rect x="55" y="80" width="12" height="25" rx="6" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <rect x="133" y="80" width="12" height="25" rx="6" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <rect x="65" y="100" width="70" height="8" rx="4" style={{ fill: 'var(--color-primary)', opacity: 0.15 }} />
    {/* Ambient glow */}
    <circle cx="100" cy="35" r="12" style={{ fill: 'var(--color-primary)', opacity: 0.12 }} />
    <circle cx="100" cy="35" r="6" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
  </svg>
);

const SpaSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Leaf */}
    <path
      d="M100 30 C120 50, 130 80, 100 110 C70 80, 80 50, 100 30 Z"
      style={{ fill: 'var(--color-primary)', opacity: 0.2 }}
    />
    <path
      d="M100 45 L100 100"
      stroke="var(--color-primary)" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round"
    />
    {/* Water drop */}
    <path
      d="M68 65 C68 55, 60 50, 60 42 C60 50, 52 55, 52 65 C52 72, 56 78, 60 78 C64 78, 68 72, 68 65 Z"
      style={{ fill: 'var(--color-primary)', opacity: 0.15 }}
    />
    <path
      d="M155 58 C155 48, 147 43, 147 35 C147 43, 139 48, 139 58 C139 65, 143 71, 147 71 C151 71, 155 65, 155 58 Z"
      style={{ fill: 'var(--color-primary)', opacity: 0.12 }}
    />
  </svg>
);

const GamingSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Controller body */}
    <rect x="60" y="50" width="80" height="45" rx="22" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    {/* D-pad */}
    <rect x="78" y="64" width="4" height="16" rx="2" style={{ fill: 'var(--color-primary)', opacity: 0.3 }} />
    <rect x="72" y="70" width="16" height="4" rx="2" style={{ fill: 'var(--color-primary)', opacity: 0.3 }} />
    {/* Buttons */}
    <circle cx="120" cy="66" r="3" style={{ fill: 'var(--color-primary)', opacity: 0.3 }} />
    <circle cx="128" cy="72" r="3" style={{ fill: 'var(--color-primary)', opacity: 0.3 }} />
    {/* Handles */}
    <path
      d="M68 90 C62 100, 58 108, 62 112 C66 116, 72 112, 74 102 L78 90"
      style={{ fill: 'var(--color-primary)', opacity: 0.15 }}
    />
    <path
      d="M132 90 C138 100, 142 108, 138 112 C134 116, 128 112, 126 102 L122 90"
      style={{ fill: 'var(--color-primary)', opacity: 0.15 }}
    />
  </svg>
);

const SleepPodSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Moon */}
    <circle cx="130" cy="40" r="18" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <circle cx="138" cy="34" r="14" style={{ fill: 'var(--color-primary-light)' }} />
    {/* Stars */}
    <circle cx="80" cy="35" r="2" style={{ fill: 'var(--color-primary)', opacity: 0.25 }} />
    <circle cx="95" cy="25" r="1.5" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <circle cx="110" cy="30" r="1" style={{ fill: 'var(--color-primary)', opacity: 0.15 }} />
    <circle cx="70" cy="50" r="1.5" style={{ fill: 'var(--color-primary)', opacity: 0.18 }} />
    {/* Bed */}
    <rect x="55" y="85" width="90" height="12" rx="6" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <rect x="55" y="78" width="30" height="12" rx="5" style={{ fill: 'var(--color-primary)', opacity: 0.25 }} />
    <ellipse cx="100" cy="110" rx="50" ry="6" style={{ fill: 'var(--color-primary)', opacity: 0.08 }} />
  </svg>
);

const DiningSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Plate */}
    <ellipse cx="100" cy="82" rx="40" ry="38" style={{ fill: 'var(--color-primary)', opacity: 0.12 }} />
    <ellipse cx="100" cy="82" rx="28" ry="26" style={{ fill: 'var(--color-primary)', opacity: 0.08 }} />
    {/* Fork */}
    <rect x="50" y="40" width="2" height="60" rx="1" style={{ fill: 'var(--color-primary)', opacity: 0.25 }} />
    <rect x="46" y="40" width="2" height="20" rx="1" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    <rect x="54" y="40" width="2" height="20" rx="1" style={{ fill: 'var(--color-primary)', opacity: 0.2 }} />
    {/* Knife */}
    <rect x="148" y="40" width="2" height="60" rx="1" style={{ fill: 'var(--color-primary)', opacity: 0.25 }} />
    <path
      d="M148 40 C154 42, 155 50, 150 58"
      stroke="var(--color-primary)" strokeWidth="2" strokeOpacity="0.2" strokeLinecap="round" fill="none"
    />
  </svg>
);

const WellnessSvg = () => (
  <svg width="200" height="140" viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Heart */}
    <path
      d="M100 95 C85 80, 60 70, 60 55 C60 42, 72 35, 82 35 C90 35, 96 40, 100 48 C104 40, 110 35, 118 35 C128 35, 140 42, 140 55 C140 70, 115 80, 100 95 Z"
      style={{ fill: 'var(--color-primary)', opacity: 0.2 }}
    />
    {/* Pulse line */}
    <polyline
      points="55,75 80,75 88,60 96,90 104,55 112,80 120,75 145,75"
      stroke="var(--color-primary)" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
  </svg>
);

const VENUE_SVGS: Record<string, React.ReactNode> = {
  lounge: <LoungeSvg />,
  spa: <SpaSvg />,
  gaming: <GamingSvg />,
  sleep_pod: <SleepPodSvg />,
  restaurant: <DiningSvg />,
  dining: <DiningSvg />,
  wellness: <WellnessSvg />,
};

export function LoungePlaceholderImage({ venueType, className }: PlaceholderProps) {
  const svgContent = VENUE_SVGS[venueType] ?? VENUE_SVGS['lounge'];

  return (
    <div
      className={`w-full h-full flex items-center justify-center ${className ?? ''}`}
      style={{
        background: 'linear-gradient(135deg, var(--color-primary-light), var(--color-bg-secondary))',
      }}
    >
      {svgContent}
    </div>
  );
}

/**
 * Hook to manage image loading with fallback to placeholder.
 */
export function useLoungeImage(imageUrl: string | null, _venueType: string) {
  const [failed, setFailed] = React.useState(false);

  const showPlaceholder = !imageUrl || failed;

  return {
    showPlaceholder,
    onError: () => setFailed(true),
    reset: () => setFailed(false),
  };
}
