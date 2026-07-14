'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { authHelpers } from '@/utils/api-utils';
import UserSearch from './UserSearch';
import Image from 'next/image';
import { 
  Plus, 
  Search, 
  MessageCircle, 
  Users, 
  MoreVertical,
  Hash,
  User,
  X,
  Check,
  Loader2,
  ChevronLeft
} from 'lucide-react';

export default function ConversationList() {
  const { user } = useAuth();
  const { 
    conversations, 
    activeConversation, 
    selectConversation, 
    createConversation,
    getUserPresence,
    isLoading 
  } = useChat();

  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatStep, setNewChatStep] = useState('choose'); // 'choose' | 'dm' | 'group'
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Derived state — useMemo instead of useState + useEffect to avoid
  // infinite re-render loops when conversations reference changes.
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) {
      return conversations;
    }
    return conversations.filter(conv => 
      conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.participants?.some(p => 
        p.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [conversations, searchTerm]);
  
  // Group chat state
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const groupSearchRef = useRef(null);


  const handleConversationClick = (conversationId) => {
    selectConversation(conversationId);
  };

  const getConversationTitle = (conversation) => {
    if (conversation.title) {
      return conversation.title;
    }

    if (conversation.type === 'DM' && conversation.participants) {
      const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
      return otherParticipant?.display_name || 'Unknown User';
    }

    return 'Untitled Conversation';
  };

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'GROUP') {
      return (
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
          <Users className="w-6 h-6 text-indigo-600" />
        </div>
      );
    }

    if (conversation.participants) {
      const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
      if (otherParticipant?.avatar_url) {
        return (
          <Image
            width={48}
            height={48}
            src={otherParticipant.avatar_url}
            alt={otherParticipant.display_name}
            className="rounded-full object-cover"
            unoptimized
          />
        );
      }

      const initials = otherParticipant?.display_name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase() || '?';

      return (
        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-600 font-medium">{initials}</span>
        </div>
      );
    }

    return (
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
        <User className="w-6 h-6 text-gray-400" />
      </div>
    );
  };

  const getLastMessagePreview = (conversation) => {
    if (!conversation.latest_message) {
      return 'No messages yet';
    }

    const message = conversation.latest_message;
    if (message.content_type === 'text/plain') {
      return message.content.length > 50 
        ? `${message.content.substring(0, 50)}...`
        : message.content;
    }

    if (message.content_type === 'attachment') {
      return '📎 Attachment';
    }

    return 'Message';
  };

  const getLastMessageTime = (conversation) => {
    if (!conversation.latest_message) {
      return '';
    }

    try {
      return formatDistanceToNow(new Date(conversation.latest_message.sent_at), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const getOnlineStatus = (conversation) => {
    if (conversation.type === 'DM' && conversation.participants) {
      const otherParticipant = conversation.participants.find(p => p.user_id !== user?.id);
      if (otherParticipant) {
        const presence = getUserPresence(otherParticipant.user_id);
        return presence.status === 'online';
      }
    }
    return false;
  };


  // Group chat search (debounced)
  useEffect(() => {
    if (!groupSearchQuery.trim() || groupSearchQuery.length < 2) {
      setGroupSearchResults([]);
      return;
    }
    
    const timeoutId = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const cleanQuery = groupSearchQuery.startsWith('@') ? groupSearchQuery.slice(1) : groupSearchQuery;
        const users = await authHelpers.searchUsers(cleanQuery, 20);
        // Filter out current user and already selected users
        const filtered = users.filter(u => 
          u.id !== user?.id && 
          !selectedGroupUsers.some(s => s.id === u.id)
        );
        setGroupSearchResults(filtered);
      } catch (error) {
        console.error('Failed to search users for group:', error);
        setGroupSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [groupSearchQuery, user?.id, selectedGroupUsers]);

  const handleAddGroupUser = (selectedUser) => {
    setSelectedGroupUsers(prev => [...prev, selectedUser]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    groupSearchRef.current?.focus();
  };

  const handleRemoveGroupUser = (userId) => {
    setSelectedGroupUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      setGroupError('Please enter a group name');
      return;
    }
    if (selectedGroupUsers.length < 1) {
      setGroupError('Please add at least one member');
      return;
    }
    
    setIsCreatingGroup(true);
    setGroupError('');
    
    try {
      const participantIds = selectedGroupUsers.map(u => u.id);
      await createConversation('GROUP', participantIds, groupTitle.trim());
      resetNewChatModal();
    } catch (error) {
      console.error('Failed to create group:', error);
      setGroupError(error.message || 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const resetNewChatModal = () => {
    setShowNewChatModal(false);
    setNewChatStep('choose');
    setGroupTitle('');
    setSelectedGroupUsers([]);
    setGroupSearchQuery('');
    setGroupSearchResults([]);
    setGroupError('');
  };

  const handleNewDMClick = () => {
    setShowUserSearch(true);
    setShowNewChatModal(false);
  };

  const handleNewGroupClick = () => {
    setNewChatStep('group');
    setTimeout(() => groupSearchRef.current?.focus(), 100);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search and New Chat */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={() => setShowNewChatModal(true)}
          className="w-full flex items-center justify-center space-x-2 py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchTerm ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {filteredConversations.map((conversation) => {
              const isActive = activeConversation === conversation.id;
              const isOnline = getOnlineStatus(conversation);

              return (
                <div
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={`
                    flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors
                    ${isActive 
                      ? 'bg-indigo-50 border-l-4 border-indigo-500' 
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  {/* Avatar */}
                  <div className="relative">
                    {getConversationAvatar(conversation)}
                    {isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`
                        font-medium truncate
                        ${isActive ? 'text-indigo-900' : 'text-gray-900'}
                      `}>
                        {conversation.type === 'GROUP' && (
                          <Hash className="inline w-4 h-4 mr-1 text-gray-400" />
                        )}
                        {getConversationTitle(conversation)}
                      </h3>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {getLastMessageTime(conversation)}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {getLastMessagePreview(conversation)}
                    </p>

                    {/* Participant count for groups */}
                    {conversation.type === 'GROUP' && conversation.participant_count && (
                      <p className="text-xs text-gray-400 mt-1">
                        {conversation.participant_count} members
                      </p>
                    )}
                  </div>

                  {/* Unread indicator (placeholder) */}
                  <div className="flex-shrink-0">
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearch
          onClose={() => setShowUserSearch(false)}
          // onUserSelect omitted — UserSearch handles the DM creation + closes itself
        />
      )}

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              {newChatStep === 'group' ? (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setNewChatStep('choose')}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-lg font-semibold">New Group Chat</h3>
                </div>
              ) : (
                <h3 className="text-lg font-semibold">Start New Chat</h3>
              )}
              <button
                onClick={resetNewChatModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newChatStep === 'choose' && (
              <div className="space-y-3">
                <button
                  onClick={handleNewDMClick}
                  className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg border border-gray-200"
                >
                  <MessageCircle className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-medium">Direct Message</p>
                    <p className="text-sm text-gray-500">Chat with someone one-on-one</p>
                  </div>
                </button>

                <button
                  onClick={handleNewGroupClick}
                  className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg border border-gray-200"
                >
                  <Users className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="font-medium">Group Chat</p>
                    <p className="text-sm text-gray-500">Create a group conversation</p>
                  </div>
                </button>
              </div>
            )}

            {newChatStep === 'group' && (
              <div className="flex flex-col flex-1 min-h-0 space-y-4">
                {/* Group Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="e.g., Project Team, Friends"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    maxLength={100}
                  />
                </div>

                {/* Add Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Add Members
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      ref={groupSearchRef}
                      type="text"
                      value={groupSearchQuery}
                      onChange={(e) => setGroupSearchQuery(e.target.value)}
                      placeholder="Search users by name..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Selected Users */}
                {selectedGroupUsers.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Selected ({selectedGroupUsers.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedGroupUsers.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center space-x-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                        >
                          <span>{u.display_name}</span>
                          <button
                            onClick={() => handleRemoveGroupUser(u.id)}
                            className="hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search Results */}
                <div className="flex-1 overflow-y-auto min-h-0 border border-gray-200 rounded-lg">
                  {isSearchingUsers && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                      <span className="ml-2 text-sm text-gray-500">Searching...</span>
                    </div>
                  )}
                  
                  {!isSearchingUsers && groupSearchQuery.length >= 2 && groupSearchResults.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-500">
                      No users found
                    </div>
                  )}
                  
                  {!isSearchingUsers && groupSearchQuery.length < 2 && selectedGroupUsers.length === 0 && (
                    <div className="text-center py-8 text-sm text-gray-400">
                      Search by name to add members
                    </div>
                  )}
                  
                  {groupSearchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAddGroupUser(u)}
                      className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-gray-600">
                          {u.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {u.display_name}
                        </p>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </div>
                      <div className="w-6 h-6 border-2 border-indigo-300 rounded-full flex items-center justify-center">
                        <Plus className="w-3 h-3 text-indigo-500" />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Error */}
                {groupError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-600">{groupError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={resetNewChatModal}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateGroup}
                    disabled={isCreatingGroup || !groupTitle.trim() || selectedGroupUsers.length === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    {isCreatingGroup ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>{isCreatingGroup ? 'Creating...' : 'Create Group'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
