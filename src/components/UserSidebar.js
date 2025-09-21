'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { 
  Settings, 
  LogOut, 
  User, 
  Circle,
  MessageCircle,
  Search,
  Crown,
  Shield
} from 'lucide-react';

const PRESENCE_STATUS = {
  online: { color: 'bg-green-500', label: 'Online' },
  away: { color: 'bg-yellow-500', label: 'Away' },
  dnd: { color: 'bg-red-500', label: 'Do Not Disturb' },
  offline: { color: 'bg-gray-400', label: 'Offline' }
};

export default function UserSidebar() {
  const { user, logout, updatePresence } = useAuth();
  const { conversations, getUserPresence, createConversation } = useChat();
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);

  // Extract all unique users from conversations
  useEffect(() => {
    const uniqueUsers = new Map();
    
    conversations.forEach(conv => {
      if (conv.participants) {
        conv.participants.forEach(participant => {
          if (participant.user_id !== user?.id) {
            uniqueUsers.set(participant.user_id, {
              id: participant.user_id,
              display_name: participant.display_name || 'Unknown User',
              role: participant.role,
              avatar_url: participant.avatar_url,
              conversation_id: conv.id
            });
          }
        });
      }
    });

    const users = Array.from(uniqueUsers.values());
    setAllUsers(users);
  }, [conversations, user]);

  // Filter users based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(allUsers);
    } else {
      const filtered = allUsers.filter(u => 
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [allUsers, searchTerm]);

  const handleStatusChange = async (status) => {
    try {
      await updatePresence(status);
      setShowStatusMenu(false);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleStartDM = async (userId) => {
    try {
      await createConversation('DM', [userId]);
    } catch (error) {
      console.error('Failed to start DM:', error);
    }
  };

  const getUserStatus = (userId) => {
    const presence = getUserPresence(userId);
    return presence.status || 'offline';
  };

  const currentUserStatus = getUserPresence(user?.id);

  return (
    <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col h-full">
      {/* Current User Section */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {/* User Avatar */}
          <div className="relative">
            {user?.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.display_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <span className="text-indigo-600 font-medium text-lg">
                  {user?.display_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
            )}
            
            {/* Status indicator */}
            <div className="absolute -bottom-1 -right-1">
              <div className={`w-4 h-4 ${PRESENCE_STATUS[currentUserStatus.status]?.color || 'bg-gray-400'} border-2 border-white rounded-full`}></div>
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {user?.display_name || 'Unknown User'}
            </h3>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
            >
              <Circle className={`w-2 h-2 ${PRESENCE_STATUS[currentUserStatus.status]?.color || 'bg-gray-400'} rounded-full`} />
              <span>{PRESENCE_STATUS[currentUserStatus.status]?.label || 'Offline'}</span>
            </button>
          </div>

          {/* Settings */}
          <div className="flex items-center space-x-1">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={logout}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Menu */}
        {showStatusMenu && (
          <div className="absolute right-4 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              {Object.entries(PRESENCE_STATUS).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <div className={`w-3 h-3 ${config.color} rounded-full`}></div>
                  <span>{config.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="flex-1 flex flex-col">
        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Users */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="space-y-1">
            {filteredUsers.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <User className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">
                  {searchTerm ? 'No users found' : 'No users to show'}
                </p>
              </div>
            ) : (
              filteredUsers.map((userData) => {
                const status = getUserStatus(userData.id);
                const statusConfig = PRESENCE_STATUS[status] || PRESENCE_STATUS.offline;

                return (
                  <div
                    key={userData.id}
                    className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white cursor-pointer transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="relative">
                      {userData.avatar_url ? (
                        <img 
                          src={userData.avatar_url} 
                          alt={userData.display_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium text-sm">
                            {userData.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      {/* Status indicator */}
                      <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${statusConfig.color} border-2 border-white rounded-full`}></div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-900 truncate text-sm">
                          {userData.display_name}
                        </h4>
                        {userData.role === 'admin' && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                        {userData.role === 'moderator' && (
                          <Shield className="w-3 h-3 text-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {statusConfig.label}
                        {status === 'online' && currentUserStatus.custom_status && (
                          <span> • {currentUserStatus.custom_status}</span>
                        )}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartDM(userData.id)}
                        className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                        title="Start direct message"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Online Count */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Online Users</span>
            <span className="font-medium">
              {filteredUsers.filter(u => getUserStatus(u.id) === 'online').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
