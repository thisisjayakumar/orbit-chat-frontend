/**
 * Black-box integration tests for the Orbit Messenger landing/home page.
 * These tests verify the page renders correctly without crashing and
 * displays the expected key elements.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    updatePresence: jest.fn(),
    getMqttClient: jest.fn(() => ({ isConnected: false })),
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

describe('Landing Page (/)', () => {
  it('renders the Orbit Messenger branding', () => {
    render(<Home />);
    expect(screen.getByText('Orbit Messenger')).toBeInTheDocument();
  });

  it('shows loading state while checking authentication', () => {
    render(<Home />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    // Mock push to verify navigation
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockImplementation(() => ({
      push: mockPush,
    }));

    // Re-render with isAuthenticated=false, isLoading=false
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    }));

    render(<Home />);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('redirects to dashboard when authenticated', () => {
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockImplementation(() => ({
      push: mockPush,
    }));

    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', display_name: 'Test' },
    }));

    render(<Home />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
