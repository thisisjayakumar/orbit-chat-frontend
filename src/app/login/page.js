'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, MessageCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
    organizationName: '',
    organizationId: ''
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Login flow
        if (!formData.email || !formData.password) {
          throw new Error('Please fill in all required fields');
        }

        // For login, we don't need organization ID - backend will find user in any org
        await login(formData.email, formData.password);
      } else {
        // Register flow
        if (!formData.email || !formData.username || !formData.password || !formData.displayName) {
          throw new Error('Please fill in all required fields');
        }

        if (!formData.organizationId && !formData.organizationName) {
          throw new Error('Please provide either an Organization ID to join existing organization or Organization Name to create new one');
        }

        if (formData.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        await register(formData.email, formData.username, formData.password, formData.displayName, formData.organizationName, formData.organizationId);
      }

      // Redirect will happen via useEffect when isAuthenticated changes
    } catch (error) {
      console.error('Authentication error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({
      email: '',
      username: '',
      password: '',
      displayName: '',
      organizationName: '',
      organizationId: ''
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center items-center space-x-2 mb-4">
            <div className="bg-indigo-600 p-3 rounded-full">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Orbit Messenger</h1>
          </div>
          <h2 className="text-xl text-gray-600">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            {isLogin 
              ? 'Sign in to continue to your conversations' 
              : 'Join Orbit Messenger and start chatting'
            }
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Enter your email"
              />
            </div>

            {/* Username (Register only) */}
            {!isLogin && (
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">@</span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required={!isLogin}
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    placeholder="username"
                    pattern="[a-zA-Z0-9._]{3,30}"
                    title="Username must be 3-30 characters and can only contain letters, numbers, underscores, and periods"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Choose a unique username (3-30 characters, letters, numbers, _, .)
                </p>
              </div>
            )}

            {/* Display Name (Register only) */}
            {!isLogin && (
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  required={!isLogin}
                  value={formData.displayName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Enter your display name"
                />
              </div>
            )}

            {/* Organization Registration (Register only) */}
            {!isLogin && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Join Organization
                  </label>
                  
                  {/* Organization ID Input */}
                  <div className="mb-3">
                    <label htmlFor="organizationId" className="block text-xs font-medium text-gray-600 mb-1">
                      Organization ID (if joining existing)
                    </label>
                    <input
                      id="organizationId"
                      name="organizationId"
                      type="text"
                      value={formData.organizationId || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors font-mono text-sm"
                      placeholder="e.g., 1381071e-f85a-4638-a02d-1866f90eba3f"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Get this from your admin or leave empty to create new organization
                    </p>
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                      💡 <strong>Tip:</strong> Ask your admin to copy the Organization ID from their dashboard and share it with you
                    </div>
                  </div>

                  {/* Organization Name Input (for new orgs) */}
                  <div>
                    <label htmlFor="organizationName" className="block text-xs font-medium text-gray-600 mb-1">
                      Organization Name (if creating new)
                    </label>
                    <input
                      id="organizationName"
                      name="organizationName"
                      type="text"
                      value={formData.organizationName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="Enter new organization name"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only fill this if creating a new organization
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 6 characters long
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </button>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                className="text-sm text-indigo-600 hover:text-indigo-500 font-medium"
              >
                {isLogin 
                  ? "Don't have an account? Sign up" 
                  : "Already have an account? Sign in"
                }
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          <p>Secure, real-time messaging for teams</p>
        </div>
      </div>
    </div>
  );
}
