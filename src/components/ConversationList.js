'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { 
  Plus, 
  Search, 
  MessageCircle, 
  Users, 
  MoreVertical,
  Hash,
  User
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
  const [filteredConversations, setFilteredConversations] = useState([]);

  // Filter conversations based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => 
        conv.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.participants?.some(p => 
          p.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setFilteredConversations(filtered);
    }
  }, [conversations, searchTerm]);

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
          <img 
            src={otherParticipant.avatar_url} 
            alt={otherParticipant.display_name}
            className="w-12 h-12 rounded-full object-cover"
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

  const handleCreateDM = async (participantId) => {
    try {
      await createConversation('DM', [participantId]);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Failed to create DM:', error);
    }
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

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Start New Chat</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                }}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg"
              >
                <MessageCircle className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">Direct Message</p>
                  <p className="text-sm text-gray-500">Chat with someone directly</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowNewChatModal(false);
                }}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg"
              >
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium">Group Chat</p>
                  <p className="text-sm text-gray-500">Create a group conversation</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
