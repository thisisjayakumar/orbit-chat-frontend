/**
 * Black-box integration tests for the Orbit Messenger login/register page.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

// Mock AuthContext
const mockLogin = jest.fn();
const mockRegister = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    login: mockLogin,
    register: mockRegister,
    logout: jest.fn(),
    updatePresence: jest.fn(),
    getMqttClient: jest.fn(() => ({ isConnected: false })),
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

describe('Login Page (/login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByText('Orbit Messenger')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('toggles between login and register modes', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Should default to login
    expect(screen.getByText('Welcome back')).toBeInTheDocument();

    // Click "Sign up" link
    await user.click(screen.getByText("Don't have an account? Sign up"));

    // Should show register form
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Display Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation error when login fields are empty', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Try to submit without filling fields
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('calls login with email and password on form submission', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ user: { id: '1' }, token: 'test-token' });

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  it('displays error message on failed login', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email address'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('redirects to dashboard when already authenticated', () => {
    // Override mock for this specific test
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', display_name: 'Test' },
      login: mockLogin,
      register: mockRegister,
    }));

    render(<LoginPage />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
