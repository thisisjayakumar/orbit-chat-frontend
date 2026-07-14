/**
 * Black-box integration tests for the Toast notification component.
 */
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import ToastContainer, { showToast } from '@/components/Toast';

// Mock requestAnimationFrame to use setTimeout so it works with fake timers
jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => setTimeout(cb, 0));

// Fake timers for controlling auto-dismiss
jest.useFakeTimers();

describe('Toast Component', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.useRealTimers();
    window.requestAnimationFrame.mockRestore();
  });

  it('renders the toast container without any toasts initially', () => {
    const { container } = render(<ToastContainer />);
    // The container should have a fixed div but no toast items
    expect(container.querySelector('.fixed')).toBeInTheDocument();
  });

  it('shows a toast notification when showToast is called', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Test message', 'success');
    });

    // Advance past requestAnimationFrame callback
    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('displays success toasts with a message', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Operation successful!', 'success');
    });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('Operation successful!')).toBeInTheDocument();
  });

  it('displays error toasts with a message', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Something went wrong', 'error');
    });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('supports multiple toasts at once', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('First toast', 'success', 5000);
      showToast('Second toast', 'error', 5000);
    });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
  });

  it('auto-dismisses toasts after the specified duration', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Auto dismiss', 'success', 1000);
    });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

    // Fast forward past the duration (1000ms + 300ms exit animation)
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // After advancing time, the toast should be removed
    expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
  });

  it('allows manual dismissal via close button', () => {
    render(<ToastContainer />);

    act(() => {
      showToast('Dismiss me', 'success', 10000);
    });

    act(() => {
      jest.advanceTimersByTime(10);
    });

    expect(screen.getByText('Dismiss me')).toBeInTheDocument();

    // Find and click the close button
    const closeButton = screen.getByRole('button');
    act(() => {
      closeButton.click();
    });

    // After exit animation completes
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
  });
});
