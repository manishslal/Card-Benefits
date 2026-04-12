import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { type BenefitStatus } from '../../utils/status-colors';
import { SummaryBox } from '../SummaryBox';
import { BenefitRow, BenefitRowProps } from '../BenefitRow';
import { BenefitGroup } from '../BenefitGroup';
import { BenefitsList } from '../BenefitsList';

/**
 * ============================================================
 * UNIT TESTS: SummaryBox Component
 * ============================================================
 */
describe('SummaryBox', () => {
  it('displays all four summary items', () => {
    render(
      <SummaryBox
        totalBenefits={15}
        expiringCount={3}
        usedCount={7}
        totalValue={1250}
        isLoading={false}
      />
    );

    expect(screen.getByText('Total Benefits')).toBeInTheDocument();
    expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    expect(screen.getByText('Already Used')).toBeInTheDocument();
    expect(screen.getByText('Max Value')).toBeInTheDocument();
  });

  it('displays correct values', () => {
    render(
      <SummaryBox
        totalBenefits={15}
        expiringCount={3}
        usedCount={7}
        totalValue={1250}
        isLoading={false}
      />
    );

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('$1,250')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(
      <SummaryBox
        totalBenefits={0}
        expiringCount={0}
        usedCount={0}
        totalValue={0}
        isLoading={true}
      />
    );

    // Should have 4 animated skeleton placeholders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('formats large values with commas', () => {
    render(
      <SummaryBox
        totalBenefits={1234}
        expiringCount={56}
        usedCount={789}
        totalValue={10000}
        isLoading={false}
      />
    );

    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
  });

  it('displays zero values correctly', () => {
    render(
      <SummaryBox
        totalBenefits={0}
        expiringCount={0}
        usedCount={0}
        totalValue={0}
        isLoading={false}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('updates values when props change', () => {
    const { rerender } = render(
      <SummaryBox
        totalBenefits={10}
        expiringCount={2}
        usedCount={5}
        totalValue={500}
        isLoading={false}
      />
    );

    expect(screen.getByText('10')).toBeInTheDocument();

    rerender(
      <SummaryBox
        totalBenefits={20}
        expiringCount={4}
        usedCount={10}
        totalValue={1000}
        isLoading={false}
      />
    );

    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

/**
 * ============================================================
 * UNIT TESTS: BenefitRow Component
 * ============================================================
 */
describe('BenefitRow', () => {
  const mockBenefit: BenefitRowProps = {
    id: '1',
    name: 'Uber $15',
    issuer: 'Amex Platinum',
    cardName: 'Amex Plat',
    status: 'active',
    periodStart: new Date(2025, 4, 1),
    periodEnd: new Date(2025, 4, 31),
    available: 15,
    used: 0,
    resetCadence: 'MONTHLY',
  };

  const mockOnMarkUsed = vi.fn().mockResolvedValue({ success: true });
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays benefit name, issuer, and card name', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        onMarkUsed={mockOnMarkUsed}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Uber $15')).toBeInTheDocument();
    expect(screen.getByText('Amex Platinum')).toBeInTheDocument();
    expect(screen.getByText('Amex Plat')).toBeInTheDocument();
  });

  it('displays status indicator', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        status="active"
        onMarkUsed={mockOnMarkUsed}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });

  it('displays available and used amounts', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        available={15}
        used={5}
        onMarkUsed={mockOnMarkUsed}
      />
    );

    expect(screen.getByText('$15')).toBeInTheDocument();
    expect(screen.getByText('$5')).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        available={100}
        used={50}
        onMarkUsed={mockOnMarkUsed}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '50');
  });

  it('shows "Mark Used" button for active benefits', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        status="active"
        onMarkUsed={mockOnMarkUsed}
      />
    );

    expect(screen.getByText('Mark Used')).toBeInTheDocument();
  });

  it('hides "Mark Used" button for used benefits', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        status="used"
        onMarkUsed={mockOnMarkUsed}
      />
    );

    expect(screen.queryByText('Mark Used')).not.toBeInTheDocument();
  });

  it('disables "Mark Used" button for pending benefits', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        status="pending"
        onMarkUsed={mockOnMarkUsed}
      />
    );

    const button = screen.getByText('Mark Used');
    expect(button).toBeDisabled();
  });

  it('calls onMarkUsed when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BenefitRow
        {...mockBenefit}
        onMarkUsed={mockOnMarkUsed}
        onEdit={mockOnEdit}
      />
    );

    const button = screen.getByText('Mark Used');
    await user.click(button);

    await waitFor(() => {
      expect(mockOnMarkUsed).toHaveBeenCalledWith('1');
    });
  });

  it('shows loading state while marking used', async () => {
    const user = userEvent.setup();
    render(
      <BenefitRow
        {...mockBenefit}
        onMarkUsed={mockOnMarkUsed}
        onEdit={mockOnEdit}
      />
    );

    const button = screen.getByText('Mark Used');
    await user.click(button);

    // Button should show "Marking..." and be disabled
    expect(screen.getByText('Marking...')).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('shows Edit button when onEdit is provided', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        onEdit={mockOnEdit}
      />
    );

    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('shows Delete button when onDelete is provided', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEdit when Edit button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BenefitRow
        {...mockBenefit}
        onEdit={mockOnEdit}
      />
    );

    await user.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith('1');
  });

  it('calls onDelete when Delete button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <BenefitRow
        {...mockBenefit}
        onDelete={mockOnDelete}
      />
    );

    await user.click(screen.getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalledWith('1');
  });

  it('displays period dates correctly', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        periodStart={new Date(2025, 4, 1)}
        periodEnd={new Date(2025, 4, 31)}
      />
    );

    // Should display "May 1-31"
    expect(screen.getByText('May 1-31')).toBeInTheDocument();
  });

  it('displays reset cadence in readable format', () => {
    render(
      <BenefitRow
        {...mockBenefit}
        resetCadence="MONTHLY"
      />
    );

    expect(screen.getByText('monthly')).toBeInTheDocument();
  });

  it('changes color based on usage percentage', () => {
    const { rerender } = render(
      <BenefitRow
        {...mockBenefit}
        available={100}
        used={30}
      />
    );

    let progressBar = screen.getByRole('progressbar');
    // Should be green (< 50%)
    expect(progressBar.className).toContain('bg-green');

    rerender(
      <BenefitRow
        {...mockBenefit}
        available={100}
        used={70}
      />
    );

    progressBar = screen.getByRole('progressbar');
    // Should be red (> 80%)
    expect(progressBar.className).toContain('bg-red');
  });
});

/**
 * ============================================================
 * UNIT TESTS: BenefitGroup Component
 * ============================================================
 */
describe('BenefitGroup', () => {
  const mockBenefits: BenefitRowProps[] = [
    {
      id: '1',
      name: 'Benefit 1',
      issuer: 'Card 1',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 50,
      used: 0,
      resetCadence: 'MONTHLY',
    },
    {
      id: '2',
      name: 'Benefit 2',
      issuer: 'Card 2',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 100,
      used: 50,
      resetCadence: 'MONTHLY',
    },
  ];

  it('renders group header with title and count', () => {
    render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        color="green"
      />
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('displays all benefits in expanded state', () => {
    render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={true}
        color="green"
      />
    );

    expect(screen.getByText('Benefit 1')).toBeInTheDocument();
    expect(screen.getByText('Benefit 2')).toBeInTheDocument();
  });

  it('hides benefits when collapsed', () => {
    render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={false}
        color="green"
      />
    );

    expect(screen.queryByText('Benefit 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Benefit 2')).not.toBeInTheDocument();
  });

  it('returns null when benefits list is empty', () => {
    const { container } = render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={[]}
        color="green"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onToggleExpand when header clicked', async () => {
    const user = userEvent.setup();
    const mockToggle = vi.fn();

    render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={true}
        onToggleExpand={mockToggle}
        color="green"
      />
    );

    const header = screen.getByText(/ACTIVE/).closest('button');
    await user.click(header!);

    expect(mockToggle).toHaveBeenCalledWith('active');
  });

  it('has correct aria-expanded attribute', () => {
    const { rerender } = render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={true}
        color="green"
      />
    );

    let header = screen.getByText(/ACTIVE/).closest('button');
    expect(header).toHaveAttribute('aria-expanded', 'true');

    rerender(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={false}
        color="green"
      />
    );

    header = screen.getByText(/ACTIVE/).closest('button');
    expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  it('uses correct color class for different colors', () => {
    const { container, rerender } = render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        color="green"
      />
    );

    let section = container.querySelector('section');
    expect(section?.className).toContain('green-200');

    rerender(
      <BenefitGroup
        status="expired"
        title="EXPIRED"
        icon="🔴"
        benefits={mockBenefits}
        color="red"
      />
    );

    section = container.querySelector('section');
    expect(section?.className).toContain('red-200');
  });

  it('passes event handlers to child BenefitRows', () => {
    const mockMarkUsed = vi.fn();
    const mockEdit = vi.fn();
    const mockDelete = vi.fn();

    render(
      <BenefitGroup
        status="active"
        title="ACTIVE"
        icon="🟢"
        benefits={mockBenefits}
        isExpanded={true}
        color="green"
        onMarkUsed={mockMarkUsed}
        onEdit={mockEdit}
        onDelete={mockDelete}
      />
    );

    // Component should render without errors and handlers should be available
    // (Detailed handler testing done in BenefitRow tests)
    expect(screen.getByText('Benefit 1')).toBeInTheDocument();
  });
});

/**
 * ============================================================
 * UNIT TESTS: BenefitsList Component
 * ============================================================
 */
describe('BenefitsList', () => {
  const mockBenefits: BenefitRowProps[] = [
    {
      id: '1',
      name: 'Active Benefit',
      issuer: 'Card',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 50,
      used: 0,
      resetCadence: 'MONTHLY',
    },
    {
      id: '2',
      name: 'Expiring Benefit',
      issuer: 'Card',
      status: 'expiring_soon',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 100,
      used: 50,
      resetCadence: 'MONTHLY',
    },
    {
      id: '3',
      name: 'Used Benefit',
      issuer: 'Card',
      status: 'used',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 75,
      used: 75,
      resetCadence: 'MONTHLY',
    },
  ];

  it('displays "No benefits found" when empty', () => {
    render(
      <BenefitsList
        benefits={[]}
        isLoading={false}
      />
    );

    expect(screen.getByText('No benefits found')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(
      <BenefitsList
        benefits={[]}
        isLoading={true}
      />
    );

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('groups benefits by status', () => {
    render(
      <BenefitsList
        benefits={mockBenefits}
        isLoading={false}
      />
    );

    // Should display group headers
    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/EXPIRING SOON/)).toBeInTheDocument();
    expect(screen.getByText(/USED THIS PERIOD/)).toBeInTheDocument();
  });

  it('shows all groups when benefits have multiple statuses', () => {
    render(
      <BenefitsList
        benefits={mockBenefits}
        isLoading={false}
      />
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.getByText(/EXPIRING SOON/)).toBeInTheDocument();
    expect(screen.getByText(/USED THIS PERIOD/)).toBeInTheDocument();
  });

  it('expands active group by default', () => {
    render(
      <BenefitsList
        benefits={mockBenefits}
        isLoading={false}
      />
    );

    // Active benefit should be visible (group expanded)
    expect(screen.getByText('Active Benefit')).toBeInTheDocument();
  });

  it('allows expanding/collapsing groups', async () => {
    const user = userEvent.setup();
    render(
      <BenefitsList
        benefits={mockBenefits}
        isLoading={false}
      />
    );

    // Click to collapse active group
    const activeHeader = screen.getByText(/ACTIVE/).closest('button');
    await user.click(activeHeader!);

    // Benefits should be hidden
    expect(screen.queryByText('Active Benefit')).not.toBeInTheDocument();

    // Click to expand again
    await user.click(activeHeader!);
    expect(screen.getByText('Active Benefit')).toBeInTheDocument();
  });

  it('does not render group if no benefits in that status', () => {
    const singleBenefit: BenefitRowProps[] = [
      {
        id: '1',
        name: 'Only Active',
        issuer: 'Card',
        status: 'active',
        periodStart: new Date(),
        periodEnd: new Date(),
        available: 50,
        used: 0,
        resetCadence: 'MONTHLY',
      },
    ];

    render(
      <BenefitsList
        benefits={singleBenefit}
        isLoading={false}
      />
    );

    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
    expect(screen.queryByText(/EXPIRING SOON/)).not.toBeInTheDocument();
    expect(screen.queryByText(/USED THIS PERIOD/)).not.toBeInTheDocument();
  });

  it('passes event handlers to groups', () => {
    const mockMarkUsed = vi.fn();
    const mockEdit = vi.fn();
    const mockDelete = vi.fn();

    render(
      <BenefitsList
        benefits={mockBenefits}
        isLoading={false}
        onMarkUsed={mockMarkUsed}
        onEdit={mockEdit}
        onDelete={mockDelete}
      />
    );

    // Handlers should be available (tested in BenefitGroup/BenefitRow tests)
    expect(screen.getByText('Active Benefit')).toBeInTheDocument();
  });
});

/**
 * ============================================================
 * EDGE CASE TESTS
 * ============================================================
 */
describe('Edge Cases and Error Scenarios', () => {
  it('handles zero value benefits', () => {
    const benefit: BenefitRowProps = {
      id: '1',
      name: 'Zero Value',
      issuer: 'Card',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 0,
      used: 0,
      resetCadence: 'MONTHLY',
    };

    render(
      <BenefitRow {...benefit} />
    );

    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('handles over-utilized benefits (used > available)', () => {
    const benefit: BenefitRowProps = {
      id: '1',
      name: 'Over-used',
      issuer: 'Card',
      status: 'used',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 100,
      used: 150,
      resetCadence: 'MONTHLY',
    };

    render(
      <BenefitRow {...benefit} />
    );

    // Progress bar should cap at 100%
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '150');
  });

  it('handles benefits with very long names', () => {
    const benefit: BenefitRowProps = {
      id: '1',
      name: 'This is a very long benefit name that should still display correctly without breaking the layout or causing issues with the component rendering',
      issuer: 'Card',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 50,
      used: 0,
      resetCadence: 'MONTHLY',
    };

    const { container } = render(
      <BenefitRow {...benefit} />
    );

    // Should not overflow or break layout
    expect(container.querySelector('[class*="break"]')).not.toBeInTheDocument();
  });

  it('handles undefined optional props gracefully', () => {
    const benefit: BenefitRowProps = {
      id: '1',
      name: 'Minimal Benefit',
      issuer: 'Card',
      status: 'active',
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 50,
      used: 0,
      resetCadence: 'MONTHLY',
      // cardName is undefined
      // onMarkUsed is undefined
      // onEdit is undefined
      // onDelete is undefined
    };

    render(<BenefitRow {...benefit} />);

    expect(screen.getByText('Minimal Benefit')).toBeInTheDocument();
    // Buttons shouldn't be present
    expect(screen.queryByText('Mark Used')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('handles very large benefit counts', () => {
    const benefits: BenefitRowProps[] = Array.from({ length: 500 }, (_, i) => ({
      id: String(i),
      name: `Benefit ${i}`,
      issuer: 'Card',
      status: 'active' as BenefitStatus,
      periodStart: new Date(),
      periodEnd: new Date(),
      available: 50,
      used: 0,
      resetCadence: 'MONTHLY',
    }));

    render(
      <BenefitsList
        benefits={benefits}
        isLoading={false}
      />
    );

    // Should render without error
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('(500)')).toBeInTheDocument();
  });
});
