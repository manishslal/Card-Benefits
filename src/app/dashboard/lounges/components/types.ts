// ────────────────────────────────────────────────────────────
// Shared Types for the Lounge Finder feature
// ────────────────────────────────────────────────────────────

export interface Airport {
  iata_code: string;
  name: string;
  city: string;
  timezone: string;
}

export interface AccessOption {
  access_type: string;
  access_method: string;
  entry_cost: number;
  guest_limit: number | null;
  guest_fee: number | null;
  guest_conditions: string | null;
  has_conditions: boolean;
  conditions: Record<string, unknown>;
  notes: string | null;
  time_limit_hours: number | null;
}

export interface LoungeData {
  lounge_id: string;
  lounge_name: string;
  terminal: string;
  venue_type: string;
  operating_hours: Record<string, unknown> | null;
  amenities: Record<string, unknown> | null;
  detail_amenities: Record<string, unknown> | null;
  detail_last_fetched_at: string | null;
  source_url: string | null;
  image_url: string | null;
  may_deny_entry: boolean;
  is_airside: boolean | null;
  gate_proximity: string | null;
  access_options: AccessOption[];
  best_access_type: string;
  best_access_method: string;
}

export interface EligibleResponse {
  success: boolean;
  airport: string;
  airport_name: string | null;
  airport_timezone: string | null;
  total_lounges: number;
  free_access: number;
  day_pass_available: number;
  lounges: LoungeData[];
  error?: string;
}

// ────────────────────────────────────────────────────────────
// Venue type helpers
// ────────────────────────────────────────────────────────────

export const VENUE_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'lounge', label: 'Lounges' },
  { key: 'spa', label: 'Spa' },
  { key: 'restaurant', label: 'Dining' },
  { key: 'gaming', label: 'Gaming' },
  { key: 'sleep_pod', label: 'Sleep' },
  { key: 'wellness', label: 'Wellness' },
] as const;

// ────────────────────────────────────────────────────────────
// Open / closed status logic
// ────────────────────────────────────────────────────────────

export function isLoungeOpen(
  operatingHours: Record<string, unknown> | null,
  timezone: string | null,
): { isOpen: boolean; statusText: string } {
  if (!operatingHours || !timezone) {
    return { isOpen: false, statusText: 'Hours not available' };
  }

  // If the whole thing is a string (legacy format), parse it directly
  if (typeof operatingHours === 'string') {
    return parseTimeString(operatingHours as string, timezone);
  }

  const hours = operatingHours as Record<string, unknown>;

  // Determine today's day key in the airport timezone
  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  let todayKey: string;
  try {
    const now = new Date();
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(now).toLowerCase().slice(0, 3);
    todayKey = dayStr;
  } catch {
    todayKey = DAY_KEYS[new Date().getDay()];
  }

  // Look up today's hours, falling back to "daily"
  let todayHours: unknown = hours[todayKey] ?? hours['daily'] ?? null;

  // If still nothing, check for "text" key (some legacy data)
  if (!todayHours && hours['text']) {
    todayHours = hours['text'];
  }

  // If still nothing, try the first available value
  if (!todayHours) {
    const vals = Object.values(hours);
    if (vals.length > 0) todayHours = vals[0];
  }

  if (!todayHours) {
    return { isOpen: false, statusText: 'Hours not available' };
  }

  // Normalize to string
  let hoursStr: string;
  if (Array.isArray(todayHours)) {
    hoursStr = todayHours[0] as string;  // e.g. ["06:00-22:00"] → "06:00-22:00"
  } else if (typeof todayHours === 'string') {
    hoursStr = todayHours;
  } else {
    return { isOpen: false, statusText: 'Hours not available' };
  }

  if (!hoursStr) {
    return { isOpen: false, statusText: 'Hours not available' };
  }

  return parseTimeString(hoursStr, timezone);
}

function parseTimeString(
  hoursStr: string,
  timezone: string,
): { isOpen: boolean; statusText: string } {
  // Handle 24 hours
  if (/24\s*hours?/i.test(hoursStr)) {
    return { isOpen: true, statusText: 'Open 24 hours' };
  }

  // Match time patterns: "6:00am-11:00pm", "06:00-23:00", "5:00am – 11:00pm"
  const timePattern = /(\d{1,2}):(\d{2})\s*(am|pm)?[\s–\-—]+(\d{1,2}):(\d{2})\s*(am|pm)?/i;
  const match = hoursStr.match(timePattern);
  if (!match) {
    // Can't parse but we have the raw string — show it
    return { isOpen: false, statusText: hoursStr };
  }

  const toMinutes = (h: number, m: number, ampm?: string): number => {
    let hours = h;
    if (ampm) {
      const period = ampm.toLowerCase();
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
    }
    return hours * 60 + m;
  };

  const openMinutes = toMinutes(
    parseInt(match[1], 10),
    parseInt(match[2], 10),
    match[3],
  );
  const closeMinutes = toMinutes(
    parseInt(match[4], 10),
    parseInt(match[5], 10),
    match[6],
  );

  // Get current time in the airport's timezone
  let currentMinutes: number;
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);

    const currentHour = parseInt(
      parts.find((p) => p.type === 'hour')?.value ?? '0',
      10,
    );
    const currentMinute = parseInt(
      parts.find((p) => p.type === 'minute')?.value ?? '0',
      10,
    );
    currentMinutes = currentHour * 60 + currentMinute;
  } catch {
    // Timezone invalid — fall back to local time
    const now = new Date();
    currentMinutes = now.getHours() * 60 + now.getMinutes();
  }

  // Handle overnight hours (e.g., 10pm – 6am)
  let isOpen: boolean;
  if (closeMinutes > openMinutes) {
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } else {
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  // Format friendly times
  const formatTime = (mins: number) => {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ampm = h >= 12 ? 'pm' : 'am';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return m === 0 ? `${h}${ampm}` : `${h}:${m.toString().padStart(2, '0')}${ampm}`;
  };

  if (isOpen) {
    return {
      isOpen: true,
      statusText: `Open now · Closes ${formatTime(closeMinutes)}`,
    };
  }
  return {
    isOpen: false,
    statusText: `Closed · Opens ${formatTime(openMinutes)}`,
  };
}

// ────────────────────────────────────────────────────────────
// Amenity definitions
// ────────────────────────────────────────────────────────────

export interface AmenityDef {
  key: string;
  label: string;
  iconName: string;
}

export const AMENITY_DEFS: AmenityDef[] = [
  { key: 'has_wifi', label: 'WiFi', iconName: 'Wifi' },
  { key: 'has_showers', label: 'Showers', iconName: 'ShowerHead' },
  { key: 'has_hot_food', label: 'Hot Food', iconName: 'Coffee' },
  { key: 'has_bar', label: 'Bar', iconName: 'Wine' },
  { key: 'has_premium_bar', label: 'Premium Bar', iconName: 'Wine' },
  { key: 'has_spa', label: 'Spa', iconName: 'Sparkles' },
  { key: 'has_quiet_zone', label: 'Quiet Zone', iconName: 'Moon' },
  { key: 'has_business_center', label: 'Business Center', iconName: 'Monitor' },
];

// ────────────────────────────────────────────────────────────
// Recent airports localStorage helpers
// ────────────────────────────────────────────────────────────

const RECENT_KEY = 'recentAirports';
const MAX_RECENTS = 3;

export function getRecentAirports(): Airport[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Airport[];
  } catch {
    return [];
  }
}

export function saveRecentAirport(airport: Airport): void {
  if (typeof window === 'undefined') return;
  try {
    const recents = getRecentAirports().filter(
      (a) => a.iata_code !== airport.iata_code,
    );
    recents.unshift(airport);
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(recents.slice(0, MAX_RECENTS)),
    );
  } catch {
    // localStorage quota exceeded — silently ignore
  }
}

// Placeholder to avoid empty-file lint warning
const _placeholder = null;
void _placeholder;
