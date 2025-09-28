'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authHelpers } from '@/utils/api-utils';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  Shield, 
  Crown, 
  Search,
  Filter,
  MoreVertical,
  Eye,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  AlertTriangle,
  Copy
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setIsAdmin(true);
      loadUsers();
    } else if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, user, router]);

  // Load all organization users
  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const orgUsers = await authHelpers.getOrganizationUsers();
      setUsers(orgUsers);
      setFilteredUsers(orgUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(u => 
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter]);

  // Update user
  const handleUpdateUser = async (userId, updates) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/v1/auth/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('orbit_token')}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user');
      }

      const updatedUser = await response.json();
      
      // Update local state
      setUsers(users.map(u => u.id === userId ? updatedUser : u));
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
      setError('Failed to update user: ' + error.message);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_SERVICE_URL}/api/v1/auth/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('orbit_token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      // Remove from local state
      setUsers(users.filter(u => u.id !== userId));
      setShowDeleteModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('Failed to delete user: ' + error.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleIcon = (role) => {
    return role === 'admin' ? <Crown className="w-4 h-4 text-yellow-500" /> : <Shield className="w-4 h-4 text-blue-500" />;
  };

  const getRoleBadge = (role) => {
    const isAdminRole = role === 'admin';
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isAdminRole 
          ? 'bg-yellow-100 text-yellow-800' 
          : 'bg-blue-100 text-blue-800'
      }`}>
        {getRoleIcon(role)}
        <span className="ml-1">{role}</span>
      </span>
    );
  };

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-indigo-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                <p className="text-sm text-gray-500">Manage organization users and permissions</p>
                {user?.organization_id && (
                  <p className="text-xs text-gray-400 mt-1">
                    Organization ID: <span className="font-mono">{user.organization_id}</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                    <dd className="text-lg font-medium text-gray-900">{users.length}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Crown className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Admins</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {users.filter(u => u.role === 'admin').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Members</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {users.filter(u => u.role === 'member').length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserCheck className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Today</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {users.filter(u => u.last_seen_at && 
                        new Date(u.last_seen_at) > new Date(Date.now() - 24*60*60*1000)).length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invite Users Section */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Invite New Users</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Users className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-medium text-blue-800">Share Organization ID</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Share this Organization ID with new team members so they can join during registration:
                  </p>
                  <div className="mt-3 flex items-center space-x-2">
                    <code className="bg-white px-3 py-2 rounded border text-sm font-mono text-gray-800 flex-1">
                      {user?.organization_id}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(user?.organization_id || '');
                        // You could add a toast notification here
                      }}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center space-x-1"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    New users should paste this ID in the "Organization ID" field during registration
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <div className="sm:w-48">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admins</option>
                  <option value="member">Members</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Users ({filteredUsers.length})
            </h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredUsers.map((userData) => (
                <li key={userData.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {/* Avatar */}
                      <div className="flex-shrink-0 h-10 w-10">
                        {userData.avatar_url ? (
                          <img 
                            className="h-10 w-10 rounded-full" 
                            src={userData.avatar_url} 
                            alt={userData.display_name}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {userData.display_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="ml-4">
                        <div className="flex items-center">
                          <p className="text-sm font-medium text-gray-900">{userData.display_name}</p>
                          <div className="ml-2">
                            {getRoleBadge(userData.role)}
                          </div>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Mail className="w-3 h-3 mr-1" />
                          <span>{userData.email}</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <span className="font-mono">ID: {userData.id.substring(0, 8)}...</span>
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          <span>Joined {formatDate(userData.created_at)}</span>
                          {userData.last_seen_at && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Last seen {formatDate(userData.last_seen_at)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(userData);
                          setShowEditModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      {userData.id !== user.id && (
                        <button
                          onClick={() => {
                            setSelectedUser(userData);
                            setShowDeleteModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onSave={handleUpdateUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Delete User Modal */}
      {showDeleteModal && selectedUser && (
        <DeleteUserModal
          user={selectedUser}
          onConfirm={() => handleDeleteUser(selectedUser.id)}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
}

// Edit User Modal Component
function EditUserModal({ user, onSave, onClose }) {
  const [formData, setFormData] = useState({
    display_name: user.display_name,
    role: user.role,
    avatar_url: user.avatar_url || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.id, formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit User</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name</label>
              <input
                type="text"
                value={formData.display_name}
                onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Avatar URL</label>
              <input
                type="url"
                value={formData.avatar_url}
                onChange={(e) => setFormData({...formData, avatar_url: e.target.value})}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://example.com/avatar.jpg"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Delete User Modal Component
function DeleteUserModal({ user, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mt-4">Delete User</h3>
          
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete <strong>{user.display_name}</strong>? 
              This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-center space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Delete User
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
