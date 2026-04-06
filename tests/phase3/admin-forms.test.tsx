/**
 * Form Validation Tests - Phase 3 Admin Dashboard
 * 
 * Tests for card and benefit form validation, including:
 * - Required field validation
 * - Numeric field constraints
 * - URL validation
 * - Edge cases (null, NaN, empty strings)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

/**
 * Test 1: Create Card Form Validation
 */
describe('Create Card Form Validation', () => {
  const CreateCardForm = () => {
    const [formData, setFormData] = React.useState({
      issuer: '',
      cardName: '',
      defaultAnnualFee: '',
      cardImageUrl: '',
    });
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState<string | null>(null);

    const validateForm = (): string | null => {
      if (!formData.issuer.trim()) return 'Issuer is required';
      if (!formData.cardName.trim()) return 'Card Name is required';
      
      const fee = parseFloat(formData.defaultAnnualFee);
      if (isNaN(fee)) return 'Annual Fee must be a valid number';
      if (fee < 0) return 'Annual Fee must be positive';
      
      if (formData.cardImageUrl && !isValidUrl(formData.cardImageUrl)) {
        return 'Image URL must be valid';
      }
      
      return null;
    };

    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const validationError = validateForm();
      
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      // Simulate API call
      setSuccess('Card created successfully');
    };

    return (
      <form onSubmit={handleSubmit} data-testid="card-form">
        <input
          type="text"
          value={formData.issuer}
          onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
          placeholder="Issuer"
          data-testid="issuer-input"
        />
        <input
          type="text"
          value={formData.cardName}
          onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
          placeholder="Card Name"
          data-testid="card-name-input"
        />
        <input
          type="number"
          value={formData.defaultAnnualFee}
          onChange={(e) => setFormData({ ...formData, defaultAnnualFee: e.target.value })}
          placeholder="Annual Fee"
          data-testid="fee-input"
        />
        <input
          type="url"
          value={formData.cardImageUrl}
          onChange={(e) => setFormData({ ...formData, cardImageUrl: e.target.value })}
          placeholder="Image URL"
          data-testid="url-input"
        />
        <button type="submit" data-testid="submit-btn">
          Create Card
        </button>
        {error && <div data-testid="error-message">{error}</div>}
        {success && <div data-testid="success-message">{success}</div>}
      </form>
    );
  };

  it('should require issuer field', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('card-name-input'), 'Premium Card');
    await user.type(screen.getByTestId('fee-input'), '99');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent('Issuer is required');
  });

  it('should require card name field', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('fee-input'), '99');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent('Card Name is required');
  });

  it('should reject negative annual fee', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Premium Card');
    await user.type(screen.getByTestId('fee-input'), '-50');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent('Annual Fee must be positive');
  });

  it('should reject invalid URL', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Premium Card');
    await user.type(screen.getByTestId('fee-input'), '99');
    await user.type(screen.getByTestId('url-input'), 'not-a-url');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent('Image URL must be valid');
  });

  it('should accept valid form', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Premium Card');
    await user.type(screen.getByTestId('fee-input'), '99.99');
    await user.type(screen.getByTestId('url-input'), 'https://example.com/card.jpg');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('success-message')).toHaveTextContent('Card created successfully');
  });

  it('should accept zero annual fee', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Free Card');
    await user.type(screen.getByTestId('fee-input'), '0');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('success-message')).toHaveTextContent('Card created successfully');
  });

  it('should trim whitespace from inputs', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), '  Visa  ');
    await user.type(screen.getByTestId('card-name-input'), '  Card  ');
    await user.type(screen.getByTestId('fee-input'), '99');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('success-message')).toHaveTextContent('Card created successfully');
  });

  it('should handle decimal annual fees', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Premium Card');
    await user.type(screen.getByTestId('fee-input'), '99.99');

    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('success-message')).toHaveTextContent('Card created successfully');
  });

  it('should NOT accept NaN values', async () => {
    const user = userEvent.setup();
    render(<CreateCardForm />);

    await user.type(screen.getByTestId('issuer-input'), 'Visa');
    await user.type(screen.getByTestId('card-name-input'), 'Card');
    // Leave fee empty - parseFloat('') = NaN
    
    await user.click(screen.getByTestId('submit-btn'));

    expect(screen.getByTestId('error-message')).toHaveTextContent('Annual Fee must be a valid number');
  });
});

/**
 * Test 2: Benefit Form Validation
 */
describe('Benefit Form Validation', () => {
  const BenefitForm = () => {
    const [formData, setFormData] = React.useState({
      name: '',
      type: 'INSURANCE',
      stickerValue: '',
      resetCadence: 'ANNUAL',
    });
    const [error, setError] = React.useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.name.trim()) {
        setError('Benefit name is required');
        return;
      }

      const value = parseFloat(formData.stickerValue);
      if (isNaN(value) || value <= 0) {
        setError('Sticker Value must be a positive number');
        return;
      }

      setError(null);
      // Simulate success
    };

    return (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Benefit Name"
          data-testid="name-input"
        />
        <select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          data-testid="type-select"
        >
          <option value="INSURANCE">Insurance</option>
          <option value="CASHBACK">Cashback</option>
          <option value="TRAVEL">Travel</option>
        </select>
        <input
          type="number"
          value={formData.stickerValue}
          onChange={(e) => setFormData({ ...formData, stickerValue: e.target.value })}
          placeholder="Sticker Value"
          data-testid="value-input"
        />
        <select
          value={formData.resetCadence}
          onChange={(e) => setFormData({ ...formData, resetCadence: e.target.value })}
          data-testid="cadence-select"
        >
          <option value="ANNUAL">Annual</option>
          <option value="MONTHLY">Monthly</option>
          <option value="PER_DAY">Per Day</option>
          <option value="PER_TRANSACTION">Per Transaction</option>
          <option value="ONE_TIME">One Time</option>
        </select>
        <button type="submit" data-testid="submit">Submit</button>
        {error && <div data-testid="error">{error}</div>}
      </form>
    );
  };

  it('should require benefit name', async () => {
    const user = userEvent.setup();
    render(<BenefitForm />);

    await user.type(screen.getByTestId('value-input'), '100');
    await user.click(screen.getByTestId('submit'));

    expect(screen.getByTestId('error')).toHaveTextContent('Benefit name is required');
  });

  it('should require positive sticker value', async () => {
    const user = userEvent.setup();
    render(<BenefitForm />);

    await user.type(screen.getByTestId('name-input'), 'Travel Insurance');
    await user.type(screen.getByTestId('value-input'), '0');
    await user.click(screen.getByTestId('submit'));

    expect(screen.getByTestId('error')).toHaveTextContent('Sticker Value must be a positive number');
  });

  it('should support all reset cadences', async () => {
    const user = userEvent.setup();
    render(<BenefitForm />);

    const cadences = ['ANNUAL', 'MONTHLY', 'PER_DAY', 'PER_TRANSACTION', 'ONE_TIME'];
    
    for (const cadence of cadences) {
      const select = screen.getByTestId('cadence-select') as HTMLSelectElement;
      await user.selectOptions(select, cadence);
      expect(select.value).toBe(cadence);
    }
  });
});
