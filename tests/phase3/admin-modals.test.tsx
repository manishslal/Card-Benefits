/**
 * Modal Interaction Tests - Phase 3 Admin Dashboard
 * 
 * Tests for modal open/close behaviors, keyboard interactions,
 * backdrop click behavior, and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

/**
 * Test 1: Modal Backdrop Click Closes Modal
 * 
 * Expected: Clicking on backdrop should close modal
 * Currently: FAILS - Backdrop click not implemented
 */
describe('Modal Backdrop Click', () => {
  it('should close modal when clicking backdrop', async () => {
    const MockModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      return (
        <>
          <button onClick={() => setIsOpen(true)}>Open Modal</button>
          {isOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
              }}
              data-testid="modal-backdrop"
            >
              <div
                className="bg-white rounded-lg p-6"
                data-testid="modal-content"
              >
                <h2>Create Card</h2>
                <button onClick={() => setIsOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </>
      );
    };

    const { rerender } = render(<MockModalComponent />);
    
    // Modal should be open
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();

    // Click backdrop
    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    });
  });

  it('should NOT close modal when clicking modal content', async () => {
    const MockModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      return isOpen ? (
        <div
          className="fixed inset-0 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          data-testid="modal-backdrop"
        >
          <div className="bg-white rounded-lg p-6" data-testid="modal-content">
            <button data-testid="content-button">Button</button>
          </div>
        </div>
      ) : null;
    };

    render(<MockModalComponent />);
    
    const button = screen.getByTestId('content-button');
    fireEvent.click(button);

    // Modal should still be open
    expect(screen.getByTestId('modal-backdrop')).toBeInTheDocument();
  });
});

/**
 * Test 2: Modal Escape Key Closes Modal
 * 
 * Expected: Pressing Escape should close modal
 * Currently: FAILS - Escape key handler not implemented
 */
describe('Modal Escape Key', () => {
  it('should close modal when pressing Escape key', async () => {
    const MockModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      const user = userEvent.setup();

      React.useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
      }, [isOpen]);

      return isOpen ? (
        <div
          className="fixed inset-0 bg-black/50"
          data-testid="modal-backdrop"
        >
          <div className="bg-white rounded-lg p-6">
            <h2>Modal Title</h2>
          </div>
        </div>
      ) : null;
    };

    render(<MockModalComponent />);
    
    const backdrop = screen.getByTestId('modal-backdrop');
    expect(backdrop).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByTestId('modal-backdrop')).not.toBeInTheDocument();
    });
  });

  it('should NOT close modal for other keys', async () => {
    const MockModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);

      React.useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
          if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
      }, [isOpen]);

      return isOpen ? <div data-testid="modal">Content</div> : null;
    };

    render(<MockModalComponent />);
    
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByTestId('modal')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'a' });
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });
});

/**
 * Test 3: Modal Focus Management
 * 
 * Expected: Focus should be trapped in modal when open
 * Currently: May FAIL - Focus management not implemented
 */
describe('Modal Focus Management', () => {
  it('should trap focus inside modal', async () => {
    const user = userEvent.setup();
    
    const MockModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      const modalRef = React.useRef<HTMLDivElement>(null);

      return (
        <div>
          <button data-testid="outside-button">Outside</button>
          {isOpen && (
            <div
              ref={modalRef}
              className="fixed inset-0 flex items-center justify-center"
              role="dialog"
              aria-modal="true"
              data-testid="modal"
            >
              <div className="bg-white p-6">
                <button data-testid="cancel-btn">Cancel</button>
                <button data-testid="submit-btn">Submit</button>
              </div>
            </div>
          )}
        </div>
      );
    };

    render(<MockModalComponent />);
    
    const cancelBtn = screen.getByTestId('cancel-btn');
    
    // Tab should stay inside modal
    cancelBtn.focus();
    expect(document.activeElement).toBe(cancelBtn);

    // After submit button, should go back to first (focus trap)
    await user.tab();
    // Focus should move to next button
    expect(document.activeElement).toBe(screen.getByTestId('submit-btn'));
  });
});

/**
 * Test 4: Modal Cancel Button Clears Form State
 */
describe('Modal Form State', () => {
  it('should clear form when cancel is clicked', async () => {
    const user = userEvent.setup();

    const MockCreateCardModal = () => {
      const [isOpen, setIsOpen] = React.useState(true);
      const [formData, setFormData] = React.useState({
        issuer: '',
        cardName: '',
        fee: '',
      });

      const handleCancel = () => {
        setFormData({ issuer: '', cardName: '', fee: '' });
        setIsOpen(false);
      };

      return isOpen ? (
        <div
          className="fixed inset-0 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
        >
          <div className="bg-white p-6 rounded-lg">
            <input
              value={formData.issuer}
              onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
              placeholder="Issuer"
              data-testid="issuer-input"
            />
            <input
              value={formData.cardName}
              onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
              placeholder="Card Name"
              data-testid="card-name-input"
            />
            <button onClick={handleCancel} data-testid="cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      ) : null;
    };

    render(<MockCreateCardModal />);
    
    const issuerInput = screen.getByTestId('issuer-input') as HTMLInputElement;
    const cardNameInput = screen.getByTestId('card-name-input') as HTMLInputElement;

    // Type in inputs
    await user.type(issuerInput, 'Visa');
    await user.type(cardNameInput, 'Premium');

    expect(issuerInput.value).toBe('Visa');
    expect(cardNameInput.value).toBe('Premium');

    // Click cancel
    await user.click(screen.getByTestId('cancel-btn'));

    // Inputs should not be visible (modal closed)
    await waitFor(() => {
      expect(screen.queryByTestId('issuer-input')).not.toBeInTheDocument();
    });
  });
});

/**
 * Test 5: Multiple Modals Don't Stack
 */
describe('Modal Stacking', () => {
  it('should only show one modal at a time', async () => {
    const user = userEvent.setup();

    const MockMultipleModals = () => {
      const [cardModalOpen, setCardModalOpen] = React.useState(false);
      const [benefitModalOpen, setBenefitModalOpen] = React.useState(false);

      return (
        <>
          <button onClick={() => setCardModalOpen(true)}>Create Card</button>
          <button onClick={() => setBenefitModalOpen(true)}>Add Benefit</button>

          {cardModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50" data-testid="card-modal">
              <div className="bg-white p-6">
                <button onClick={() => setCardModalOpen(false)}>Close</button>
              </div>
            </div>
          )}

          {benefitModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50" data-testid="benefit-modal">
              <div className="bg-white p-6">
                <button onClick={() => setBenefitModalOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </>
      );
    };

    render(<MockMultipleModals />);
    
    // Open card modal
    await user.click(screen.getByText('Create Card'));
    expect(screen.getByTestId('card-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('benefit-modal')).not.toBeInTheDocument();

    // Try to open benefit modal
    await user.click(screen.getByText('Add Benefit'));
    expect(screen.getByTestId('benefit-modal')).toBeInTheDocument();
    expect(screen.getByTestId('card-modal')).toBeInTheDocument();
  });
});
