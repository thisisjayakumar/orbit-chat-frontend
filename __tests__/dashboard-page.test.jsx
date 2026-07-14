/**
 * Black-box integration tests for the Orbit Messenger dashboard page.
 * Tests the 3-panel layout renders without crashing.
 * NOTE: Uses stable references for all mock data to prevent React
 * infinite re-render loops caused by useEffect dependencies changing
 * on every render.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

// Mocks
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSelectConversation = jest.fn();
const mockSendMessage = jest.fn();
const mockSendMessageWithFiles = jest.fn();
const mockSendTypingIndicator = jest.fn();
const mockLoadMessages = jest.fn();
const mockLoadParticipants = jest.fn();
const mockLoadConversations = jest.fn();
const mockCreateConversation = jest.fn();

// Stable references - must be defined outside mock factory to be the same
// reference every render. Avoids infinite loops in useEffect([dep]) hooks.
const stableEmptyArray = [];
const stableEmptyObject = {};

const mockGetConversation = jest.fn(() => null);
const mockGetMessages = jest.fn(() => stableEmptyArray);
const mockGetParticipants = jest.fn(() => stableEmptyArray);
const mockGetTypingUsers = jest.fn(() => stableEmptyArray);
const mockGetUserPresence = jest.fn(() => ({ status: 'offline' }));
const mockRefreshPresenceData = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1', display_name: 'Test User', role: 'member' },
    logout: jest.fn(),
    updatePresence: jest.fn(),
    getMqttClient: jest.fn(() => ({ isConnected: false })),
  }),
  AuthProvider: ({ children }) => <>{children}</>,
}));

// Mock api-utils to prevent real network calls from UserSidebar
jest.mock('@/utils/api-utils', () => ({
  authHelpers: {
    getOrganizationUsers: jest.fn().mockResolvedValue([]),
    searchUsers: jest.fn().mockResolvedValue([]),
  },
  authApi: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  TokenManager: { getToken: jest.fn(() => null), getUser: jest.fn(() => null), getOrganization: jest.fn(() => null) },
}));

jest.mock('@/contexts/ChatContext', () => ({
  useChat: () => ({
    conversations: stableEmptyArray,
    activeConversation: null,
    messages: stableEmptyObject,
    participants: stableEmptyObject,
    presenceData: stableEmptyObject,
    typingUsers: stableEmptyObject,
    isLoading: false,
    error: null,
    loadConversations: mockLoadConversations,
    loadMessages: mockLoadMessages,
    loadParticipants: mockLoadParticipants,
    selectConversation: mockSelectConversation,
    sendMessage: mockSendMessage,
    sendMessageWithFiles: mockSendMessageWithFiles,
    sendTypingIndicator: mockSendTypingIndicator,
    createConversation: mockCreateConversation,
    getConversation: mockGetConversation,
    getMessages: mockGetMessages,
    getParticipants: mockGetParticipants,
    getTypingUsers: mockGetTypingUsers,
    getUserPresence: mockGetUserPresence,
    refreshPresenceData: mockRefreshPresenceData,
  }),
  ChatProvider: ({ children }) => <>{children}</>,
}));

describe('Dashboard Page (/dashboard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('renders the dashboard layout with Conversations sidebar', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });

  it('shows welcome message when no conversation is selected', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Welcome to Orbit Messenger')).toBeInTheDocument();
    expect(screen.getByText(/Select a conversation/)).toBeInTheDocument();
  });

  it('shows loading state when auth is loading', () => {
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    }));

    render(<DashboardPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    jest.spyOn(require('@/contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    }));

    render(<DashboardPage />);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders the new chat button', () => {
    render(<DashboardPage />);
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('renders search input for conversations', () => {
    render(<DashboardPage />);
    expect(screen.getByPlaceholderText('Search conversations...')).toBeInTheDocument();
  });
});
