import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodSelector, PeriodOption } from '../PeriodSelector';

describe('PeriodSelector', () => {
  const mockPeriods: PeriodOption[] = [
    {
      id: 'this-month',
      label: 'This Month',
      displayLabel: 'May 2025',
      getDateRange: () => ({ start: new Date(2025, 4, 1), end: new Date(2025, 4, 31) }),
    },
    {
      id: 'this-quarter',
      label: 'This Quarter',
      displayLabel: 'Q2 2025',
      getDateRange: () => ({ start: new Date(2025, 3, 1), end: new Date(2025, 5, 30) }),
    },
  ];

  const mockOnPeriodChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial selected period', () => {
    render(
      <PeriodSelector
        selectedPeriodId="this-month"
        onPeriodChange={mockOnPeriodChange}
        periods={mockPeriods}
      />
    );

    expect(screen.getByLabelText('Select time period')).toHaveValue('this-month');
    expect(screen.getByText('May 2025')).toBeInTheDocument();
  });

  it('displays all period options', () => {
    render(
      <PeriodSelector
        selectedPeriodId="this-month"
        onPeriodChange={mockOnPeriodChange}
        periods={mockPeriods}
      />
    );

    mockPeriods.forEach((period) => {
      expect(screen.getByText(period.label)).toBeInTheDocument();
    });
  });

  it('calls onPeriodChange when selection changes', () => {
    render(
      <PeriodSelector
        selectedPeriodId="this-month"
        onPeriodChange={mockOnPeriodChange}
        periods={mockPeriods}
      />
    );

    const select = screen.getByLabelText('Select time period');
    fireEvent.change(select, { target: { value: 'this-quarter' } });

    expect(mockOnPeriodChange).toHaveBeenCalledWith('this-quarter');
  });

  it('updates display label when period changes', () => {
    const { rerender } = render(
      <PeriodSelector
        selectedPeriodId="this-month"
        onPeriodChange={mockOnPeriodChange}
        periods={mockPeriods}
      />
    );

    expect(screen.getByText('May 2025')).toBeInTheDocument();

    rerender(
      <PeriodSelector
        selectedPeriodId="this-quarter"
        onPeriodChange={mockOnPeriodChange}
        periods={mockPeriods}
      />
    );

    expect(screen.getByText('Q2 2025')).toBeInTheDocument();
  });
});
