'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, User, MessageCircle, X } from 'lucide-react';
import { authHelpers } from '@/utils/api-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';

const PRESENCE_STATUS = {
  online: { color: 'bg-green-500', label: 'Online' },
  away: { color: 'bg-yellow-500', label: 'Away' },
  dnd: { color: 'bg-red-500', label: 'Do Not Disturb' },
  offline: { color: 'bg-gray-400', label: 'Offline' }
};

export default function UserSearch({ onClose, onUserSelect }) {
  const { user: currentUser } = useAuth();
  const { createConversation, getUserPresence } = useChat();
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef(null);

  // Focus search input when component mounts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        handleSearch(query.trim());
      } else {
        setResults([]);
        setError('');
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSearch = async (searchQuery) => {
    setIsLoading(true);
    setError('');

    try {
      // Remove @ prefix if present
      const cleanQuery = searchQuery.startsWith('@') ? searchQuery.slice(1) : searchQuery;
      
      if (cleanQuery.length < 2) {
        setResults([]);
        return;
      }

      const users = await authHelpers.searchUsers(cleanQuery, 10);
      
      // Filter out current user from results
      const filteredUsers = users.filter(u => u.id !== currentUser?.id);
      
      setResults(filteredUsers);
      
      if (filteredUsers.length === 0) {
        setError('No users found matching your search');
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to search users. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = async (user) => {
    try {
      setIsLoading(true);
      
      // Create a DM conversation with the selected user
      const conversation = await createConversation(
        'DM',
        null, // No title for DM
        [user.id] // Participant IDs
      );
      
      // Call the onUserSelect callback if provided
      if (onUserSelect) {
        onUserSelect(user, conversation);
      }
      
      // Close the search modal
      onClose();
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setError('Failed to start conversation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Find Users</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by @username or name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Try searching with @username (e.g., @john.doe) or display name
          </p>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              <span className="ml-2 text-gray-600">Searching...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>{error}</p>
            </div>
          )}

          {!isLoading && !error && query.trim().length < 2 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}

          {!isLoading && !error && results.length > 0 && (
            <div className="divide-y divide-gray-200">
              {results.map((user) => {
                const presence = getUserPresence(user.id);
                return (
                  <div
                    key={user.id}
                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleStartChat(user)}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-medium">
                              {user.display_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                        )}
                        
                        {/* Presence indicator */}
                        <div className="absolute -bottom-1 -right-1">
                          <div className={`w-3 h-3 ${PRESENCE_STATUS[presence?.status]?.color || 'bg-gray-400'} border-2 border-white rounded-full`}></div>
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.display_name}
                          </p>
                          {user.role === 'admin' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm text-gray-500">@{user.username}</p>
                          <span className="text-xs text-gray-400">•</span>
                          <span className={`text-xs ${PRESENCE_STATUS[presence?.status]?.color?.replace('bg-', 'text-') || 'text-gray-400'}`}>
                            {PRESENCE_STATUS[presence?.status]?.label || 'Offline'}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button className="flex items-center justify-center w-8 h-8 bg-indigo-100 hover:bg-indigo-200 rounded-full transition-colors">
                        <MessageCircle className="w-4 h-4 text-indigo-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
