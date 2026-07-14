/**
 * Black-box integration tests for the Orbit Messenger admin/user management page.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AdminDashboard from '@/app/admin/page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'admin-1', display_name: 'Admin User', role: 'admin', organization_id: 'org-123' },
    logout: jest.fn(),
    updatePresence: jest.fn(),
    getMqttClient: jest.fn(() => ({ isConnected: false })),
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

jest.mock('@/utils/api-utils', () => ({
  authHelpers: {
    getOrganizationUsers: jest.fn().mockResolvedValue([
      { id: '1', display_name: 'Alice', email: 'alice@test.com', role: 'admin', created_at: '2024-01-01', last_seen_at: null },
      { id: '2', display_name: 'Bob', email: 'bob@test.com', role: 'member', created_at: '2024-01-02', last_seen_at: null },
      { id: '3', display_name: 'Charlie', email: 'charlie@test.com', role: 'member', created_at: '2024-01-03', last_seen_at: null },
    ]),
  },
  authApi: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  TokenManager: { getToken: jest.fn(), getUser: jest.fn(), getOrganization: jest.fn() },
}));

jest.mock('@/contexts/ChatContext', () => ({
  useChat: () => ({
    conversations: [],
    getUserPresence: jest.fn(() => ({ status: 'offline' })),
  }),
  ChatProvider: ({ children }) => <>{children}</>,
}));

describe('Admin Dashboard (/admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the user management header', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByText('User Management')).toBeInTheDocument();
  });

  it('shows organization ID in the header', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByText(/Organization ID:/)).toBeInTheDocument();
  });

  it('shows the invite users section', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByText('Invite New Users')).toBeInTheDocument();
    expect(await screen.findByText('Share Organization ID')).toBeInTheDocument();
  });

  it('displays back to chat button', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByText('Back to Chat')).toBeInTheDocument();
  });

  it('shows stats cards (Total Users, Admins, Members, Active Today)', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByText('Total Users')).toBeInTheDocument();
    // 'Admins' appears in both stats card and role filter dropdown, so use getAllByText
    const adminElements = screen.getAllByText('Admins');
    expect(adminElements.length).toBeGreaterThanOrEqual(1);
    // 'Members' appears in both stats card and role filter dropdown
    const memberElements = screen.getAllByText('Members');
    expect(memberElements.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Active Today')).toBeInTheDocument();
  });

  it('shows search input and role filter', async () => {
    render(<AdminDashboard />);
    expect(await screen.findByPlaceholderText('Search users by name or email...')).toBeInTheDocument();
    expect(await screen.findByText('All Roles')).toBeInTheDocument();
  });

  it('redirects non-admin users to dashboard', () => {
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'member-1', display_name: 'Member', role: 'member' },
    }));

    render(<AdminDashboard />);
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
