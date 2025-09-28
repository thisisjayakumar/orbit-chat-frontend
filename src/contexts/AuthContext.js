'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TokenManager, authHelpers } from '@/utils/api-utils';
import mqttClient from '@/utils/mqtt-client';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mqttConnected, setMqttConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    const initializeAuth = async () => {
      try {
        const token = TokenManager.getToken();
        const storedUser = TokenManager.getUser();
        const storedOrg = TokenManager.getOrganization();

        if (token && storedUser) {
          setUser(storedUser);
          setOrganization(storedOrg);
          setIsAuthenticated(true);

          try {
            await initializeMqtt();
            
            // Set user presence to online after MQTT connection is established
            // The MQTT client will handle presence notification automatically
            console.log('MQTT initialized for user:', storedUser.id);
          } catch (mqttError) {
            console.warn('MQTT initialization failed:', mqttError);
            
            // Fallback: Set presence via REST API if MQTT fails
            try {
              const { presenceApiEndpoints } = await import('@/utils/api-list');
              await presenceApiEndpoints.setUserStatus(storedUser.id, 'online', 'Available');
              console.log('Fallback: Set user presence via REST API');
            } catch (presenceError) {
              console.error('Failed to set presence on auth init:', presenceError);
            }
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(initializeAuth, 100);
    return () => clearTimeout(timeoutId);
  }, []);

  // Initialize MQTT connection
  const initializeMqtt = async () => {
    try {
      await mqttClient.connect();
      setMqttConnected(true);
      
      mqttClient.startHeartbeat();

      // Don't set presence here - it will be handled by the dedicated presence calls

      mqttClient.onConnect(() => {
        setMqttConnected(true);
      });

      mqttClient.onDisconnect(() => {
        setMqttConnected(false);
      });

    } catch (error) {
      console.error('MQTT initialization failed:', error);
      setMqttConnected(false);
    }
  };

  const login = async (email, password) => {
    try {
      setIsLoading(true);
      const { user: loggedInUser, token } = await authHelpers.login(email, password);
      
      setUser(loggedInUser);
      setIsAuthenticated(true);
      
      const org = {
        id: loggedInUser.organization_id,
        name: 'Organization'
      };
      setOrganization(org);
      TokenManager.setOrganization(org);

      // Set user presence to online immediately after login
      try {
        const { presenceApiEndpoints } = await import('@/utils/api-list');
        await presenceApiEndpoints.setUserStatus(loggedInUser.id, 'online', 'Available');
        console.log('Successfully set user presence to online after login');
        
        // Trigger a presence refresh event for other components to pick up
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('presence-updated', {
            detail: { userId: loggedInUser.id, status: 'online' }
          }));
        }
      } catch (presenceError) {
        console.error('Failed to set presence after login:', presenceError);
      }

      // Initialize MQTT connection (this will also set presence)
      await initializeMqtt();
      console.log('Login successful, MQTT initialized for user:', loggedInUser.id);

      return { user: loggedInUser, token };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, username, password, displayName, organizationName, organizationId) => {
    try {
      setIsLoading(true);
      const { user: newUser, token } = await authHelpers.register(email, username, password, displayName, organizationName, organizationId);
      
      setUser(newUser);
      setIsAuthenticated(true);
      
      const org = {
        id: newUser.organization_id,
        name: organizationName
      };
      setOrganization(org);

      await initializeMqtt();

      // Set user presence to online
      try {
        const { presenceApiEndpoints } = await import('@/utils/api-list');
        await presenceApiEndpoints.setUserStatus(newUser.id, 'online', 'Available');
      } catch (presenceError) {
        console.warn('Failed to set presence on registration:', presenceError);
      }

      return { user: newUser, token };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (mqttConnected) {
        await mqttClient.updatePresence('offline');
        mqttClient.stopHeartbeat();
        mqttClient.disconnect();
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }

    TokenManager.removeToken();
    setUser(null);
    setOrganization(null);
    setIsAuthenticated(false);
    setMqttConnected(false);
  };

  const updatePresence = async (status, customStatus = '') => {
    try {
      // Always update via REST API (this is what actually matters for the backend)
      if (user) {
        console.log(`Updating presence via REST API: ${status} for user ${user.id}`);
        const { presenceApiEndpoints } = await import('@/utils/api-list');
        const result = await presenceApiEndpoints.setUserStatus(user.id, status, customStatus);
        console.log('Presence update result:', result);
      }

      // Also update via MQTT if connected (for real-time notifications)
      if (mqttConnected) {
        try {
          await mqttClient.updatePresence(status, customStatus);
          console.log('MQTT presence update successful');
        } catch (mqttError) {
          console.warn('MQTT presence update failed:', mqttError);
        }
      }
    } catch (error) {
      console.error('Failed to update presence:', error);
      // Don't throw error to prevent breaking the app
    }
  };

  const getMqttClient = () => {
    return mqttClient;
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!isAuthenticated || !mqttConnected || !user) return;

      // Add a longer delay to avoid race conditions and only trigger for real visibility changes
      setTimeout(async () => {
        try {
          console.log('Visibility change detected. Document hidden:', document.hidden);
          // Only set to away if the document has been hidden for a while (not just during navigation)
          if (document.hidden) {
            console.log('Setting presence to away due to document being hidden');
            await updatePresence('away');
          } else {
            console.log('Setting presence to online due to document being visible');
            await updatePresence('online');
          }
        } catch (error) {
          console.error('Error updating presence on visibility change:', error);
        }
      }, 5000); // 5 second delay to avoid conflicts with login presence setting
    };

    // Only add the listener after a delay to avoid immediate triggering during login
    const timeoutId = setTimeout(() => {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }, 10000); // 10 second delay before enabling visibility change handler
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, mqttConnected, user]);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (mqttConnected) {
        await mqttClient.updatePresence('offline');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [mqttConnected]);

  const value = {
    user,
    organization,
    isAuthenticated,
    isLoading,
    mqttConnected,
    login,
    register,
    logout,
    updatePresence,
    getMqttClient,
  };

  // Make context available globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.authContext = value;
    }
  }, [value]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
