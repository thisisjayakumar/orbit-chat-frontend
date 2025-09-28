'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import ConversationList from '@/components/ConversationList';
import ChatWindow from '@/components/ChatWindow';
import UserSidebar from '@/components/UserSidebar';
import { Loader2, Menu, X } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { 
    conversations, 
    activeConversation, 
    isLoading: chatLoading,
    error: chatError 
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userSidebarOpen, setUserSidebarOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Show loading while checking authentication
  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      {/* Conversation List Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">Conversations</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUserSidebarOpen(!userSidebarOpen)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-hidden">
            <ConversationList />
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-lg font-semibold text-gray-900">Orbit Messenger</h1>
            {user?.organization_id && (
              <p className="text-xs text-gray-400 font-mono">
                {user.organization_id.substring(0, 8)}...
              </p>
            )}
          </div>
          <button
            onClick={() => setUserSidebarOpen(!userSidebarOpen)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Chat Window */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-h-0">
            {activeConversation ? (
              <ChatWindow />
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Orbit Messenger</h3>
                  <p className="text-gray-500 max-w-sm">
                    Select a conversation from the sidebar to start chatting, or create a new conversation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* User Sidebar - Desktop */}
          <div className="hidden lg:block">
            <UserSidebar />
          </div>
        </div>
      </div>

      {/* User Sidebar - Mobile */}
      {userSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-gray-600 opacity-75"
            onClick={() => setUserSidebarOpen(false)}
          ></div>
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Users</h2>
              <button
                onClick={() => setUserSidebarOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <UserSidebar />
          </div>
        </div>
      )}

      {/* Error Display */}
      {chatError && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          <p className="text-sm">{chatError}</p>
        </div>
      )}

      {/* Loading Overlay */}
      {chatLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 flex items-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="text-gray-700">Loading...</span>
          </div>
        </div>
      )}
    </div>
  );
}
