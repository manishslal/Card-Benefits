import type { AccessOption } from './types';

export interface AccessStep {
  step: number;
  instruction: string;
}

export function generateAccessSteps(accessOption: AccessOption, _loungeName: string): AccessStep[] {
  const steps: AccessStep[] = [];
  let stepNum = 1;

  // Step: What to show at the door
  if (accessOption.access_method.includes('Priority Pass')) {
    steps.push({ step: stepNum++, instruction: 'Open your Priority Pass app or show your Priority Pass card' });
  } else if (accessOption.access_method.includes('Amex') || accessOption.access_method.includes('American Express')) {
    steps.push({ step: stepNum++, instruction: `Show your ${accessOption.access_method.split(' → ')[0]} card at the reception desk` });
  } else if (accessOption.access_method.includes('Chase')) {
    steps.push({ step: stepNum++, instruction: `Show your ${accessOption.access_method.split(' → ')[0]} card at the reception desk` });
  } else if (accessOption.access_method.includes('Capital One')) {
    steps.push({ step: stepNum++, instruction: `Show your ${accessOption.access_method.split(' → ')[0]} card at the reception desk` });
  } else if (accessOption.access_type === 'day_pass') {
    steps.push({ step: stepNum++, instruction: `Purchase a day pass for $${accessOption.entry_cost} at the door or in advance` });
  } else {
    steps.push({ step: stepNum++, instruction: `Present your ${accessOption.access_method.split(' → ')[0]} membership at the reception desk` });
  }

  const conditions = accessOption.conditions as Record<string, unknown> | null;
  if (conditions?.requires_same_day_flight) {
    steps.push({ step: stepNum++, instruction: 'Show your boarding pass for a same-day departing or connecting flight' });
  }
  if (conditions?.pre_booking_required) {
    steps.push({ step: stepNum++, instruction: 'Pre-booking is required — reserve your spot in advance via the lounge website' });
  }
  if (accessOption.guest_limit !== 0 && accessOption.guest_limit !== null) {
    steps.push({ step: stepNum++, instruction: 'Guest access may be available — check the lounge website for current guest policies' });
  }
  steps.push({ step: stepNum++, instruction: 'Walk in and enjoy — no reservation needed unless noted above' });
  return steps;
}
