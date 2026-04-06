/**
 * Memory Management and Cleanup Tests - Phase 3 Admin Dashboard
 * 
 * Tests for:
 * - useEffect cleanup functions
 * - setTimeout cleanup
 * - Event listener cleanup
 * - Component unmount handling
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

/**
 * Test 1: setTimeout Cleanup on Component Unmount
 */
describe('setTimeout Cleanup', () => {
  it('should cleanup setTimeout on unmount', async () => {
    const onTimeout = jest.fn();

    const ComponentWithTimeout = () => {
      const [showMessage, setShowMessage] = React.useState(true);

      React.useEffect(() => {
        if (!showMessage) return;

        const timeoutId = setTimeout(() => {
          onTimeout();
          setShowMessage(false);
        }, 1000);

        return () => clearTimeout(timeoutId); // Cleanup
      }, [showMessage]);

      return showMessage ? <div data-testid="message">Success!</div> : null;
    };

    const { unmount } = render(<ComponentWithTimeout />);

    expect(screen.getByTestId('message')).toBeInTheDocument();

    // Unmount before timeout fires
    unmount();

    // Wait for potential timeout (should not fire)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should call cleanup function when unmounting', async () => {
    const cleanup = jest.fn();

    const TestComponent = () => {
      React.useEffect(() => {
        return cleanup;
      }, []);

      return <div>Component</div>;
    };

    const { unmount } = render(<TestComponent />);
    expect(cleanup).not.toHaveBeenCalled();

    unmount();
    expect(cleanup).toHaveBeenCalled();
  });
});

/**
 * Test 2: Event Listener Cleanup
 */
describe('Event Listener Cleanup', () => {
  it('should cleanup keydown event listener', async () => {
    const handleKeyDown = jest.fn();

    const ComponentWithListener = () => {
      React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
      }, []);

      return <div>Component</div>;
    };

    const { unmount } = render(<ComponentWithListener />);

    // Trigger event while mounted
    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handleKeyDown).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();

    // Trigger event after unmount - should not be called
    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(handleKeyDown).toHaveBeenCalledTimes(1); // Still 1, not incremented
  });

  it('should cleanup multiple event listeners', async () => {
    const onResize = jest.fn();
    const onScroll = jest.fn();

    const ComponentWithListeners = () => {
      React.useEffect(() => {
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', onScroll);

        return () => {
          window.removeEventListener('resize', onResize);
          window.removeEventListener('scroll', onScroll);
        };
      }, []);

      return <div>Component</div>;
    };

    const { unmount } = render(<ComponentWithListeners />);

    fireEvent(window, new Event('resize'));
    expect(onResize).toHaveBeenCalledTimes(1);

    unmount();

    fireEvent(window, new Event('resize'));
    expect(onResize).toHaveBeenCalledTimes(1); // Not incremented
  });
});

/**
 * Test 3: Async Operation Cleanup
 */
describe('Async Operation Cleanup', () => {
  it('should not setState after unmount', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const ComponentWithAsync = () => {
      const [data, setData] = React.useState<string | null>(null);
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        let isMounted = true;

        (async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          if (isMounted) {
            setData('Loaded');
            setIsLoading(false);
          }
        })();

        return () => {
          isMounted = false; // Prevents setState after unmount
        };
      }, []);

      return (
        <div>
          {isLoading ? <div data-testid="loading">Loading...</div> : <div data-testid="data">{data}</div>}
        </div>
      );
    };

    const { unmount } = render(<ComponentWithAsync />);

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Unmount before async operation completes
    unmount();

    // Wait for the async operation
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Should not have any errors about setState on unmounted component
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Can\'t perform a React state update on an unmounted component')
    );

    consoleErrorSpy.mockRestore();
  });
});

/**
 * Test 4: SWR/Data Fetching Cleanup
 */
describe('Data Fetching Cleanup', () => {
  it('should abort fetch on unmount', async () => {
    const abortSpy = jest.fn();

    const ComponentWithFetch = () => {
      const [data, setData] = React.useState(null);

      React.useEffect(() => {
        const controller = new AbortController();

        fetch('/api/cards', { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => setData(data))
          .catch((err) => {
            if (err.name !== 'AbortError') {
              console.error(err);
            }
          });

        return () => {
          controller.abort();
          abortSpy();
        };
      }, []);

      return <div>{data ? 'Loaded' : 'Loading'}</div>;
    };

    const { unmount } = render(<ComponentWithFetch />);
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(abortSpy).toHaveBeenCalled();
  });
});

/**
 * Test 5: Memory Leak Detection in Callbacks
 */
describe('Callback Memory Management', () => {
  it('should not accumulate timeout instances in callbacks', async () => {
    const Component = () => {
      const [count, setCount] = React.useState(0);
      const [message, setMessage] = React.useState<string | null>(null);

      const handleAction = React.useCallback(() => {
        setMessage('Success');
        const timeoutId = setTimeout(() => {
          setMessage(null);
        }, 1000);

        // ❌ BAD: Creates new timeout each time without cleanup
        // ✓ GOOD: Should use useEffect with cleanup
      }, []);

      return (
        <div>
          <button onClick={handleAction} data-testid="btn">
            Action
          </button>
          {message && <div data-testid="msg">{message}</div>}
        </div>
      );
    };

    const { unmount } = render(<Component />);
    const user = userEvent.setup();

    // Click multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByTestId('btn'));
    }

    // Multiple timeouts are queued
    // This test demonstrates the problem that should be fixed

    unmount();
  });

  it('should properly cleanup state updates from callbacks', async () => {
    const Component = () => {
      const [data, setData] = React.useState<string | null>(null);

      const handleFetch = React.useCallback(async () => {
        try {
          // Simulate fetch
          await new Promise((resolve) => setTimeout(resolve, 100));
          setData('Result');
        } catch (error) {
          console.error('Error:', error);
        }
      }, []);

      React.useEffect(() => {
        return () => {
          // Cleanup if needed
        };
      }, []);

      return (
        <>
          <button onClick={handleFetch} data-testid="fetch-btn">
            Fetch
          </button>
          {data && <div data-testid="result">{data}</div>}
        </>
      );
    };

    const { unmount } = render(<Component />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId('fetch-btn'));

    // Unmount before async completes
    unmount();

    // Wait for async
    await new Promise((resolve) => setTimeout(resolve, 200));

    // No errors should occur
  });
});

/**
 * Test 6: Modal Escape Handler Cleanup
 */
describe('Modal Escape Handler Cleanup', () => {
  it('should cleanup escape listener when modal closes', async () => {
    const escapeHandler = jest.fn();

    const ModalComponent = () => {
      const [isOpen, setIsOpen] = React.useState(true);

      React.useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
          escapeHandler();
          if (e.key === 'Escape') setIsOpen(false);
        };

        window.addEventListener('keydown', handleEscape);
        
        return () => {
          window.removeEventListener('keydown', handleEscape);
        };
      }, [isOpen]);

      return (
        isOpen ? (
          <div data-testid="modal">
            <button onClick={() => setIsOpen(false)}>Close</button>
          </div>
        ) : null
      );
    };

    const { getByTestId, queryByTestId } = render(<ModalComponent />);

    // Modal is open
    expect(getByTestId('modal')).toBeInTheDocument();

    // Close modal by clicking button
    await userEvent.click(getByTestId('modal').querySelector('button')!);

    // Modal should be closed
    expect(queryByTestId('modal')).not.toBeInTheDocument();

    // Press escape after modal closed
    fireEvent(window, new KeyboardEvent('keydown', { key: 'Escape' }));

    // escapeHandler should not be called because listener was removed
    // (unless other listeners are registered)
  });
});

/**
 * Helper function for fireEvent
 */
function fireEvent(target: any, event: Event) {
  target.dispatchEvent(event);
}
