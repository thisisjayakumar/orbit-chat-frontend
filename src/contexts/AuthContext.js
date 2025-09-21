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
          } catch (mqttError) {
            console.warn('MQTT initialization failed:', mqttError);
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

      await mqttClient.updatePresence('online');

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

  const login = async (email, password, organizationId) => {
    try {
      setIsLoading(true);
      const { user: loggedInUser, token } = await authHelpers.login(email, password, organizationId);
      
      setUser(loggedInUser);
      setIsAuthenticated(true);
      
      const org = {
        id: loggedInUser.organization_id,
        name: 'Organization'
      };
      setOrganization(org);
      TokenManager.setOrganization(org);

      await initializeMqtt();

      return { user: loggedInUser, token };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, displayName, organizationName) => {
    try {
      setIsLoading(true);
      const { user: newUser, token } = await authHelpers.register(email, password, displayName, organizationName);
      
      setUser(newUser);
      setIsAuthenticated(true);
      
      const org = {
        id: newUser.organization_id,
        name: organizationName
      };
      setOrganization(org);

      await initializeMqtt();

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
    if (!mqttConnected) {
      throw new Error('MQTT not connected');
    }

    try {
      await mqttClient.updatePresence(status, customStatus);
      
      if (user) {
        const { presenceApiEndpoints } = await import('@/utils/api-list');
        await presenceApiEndpoints.setUserStatus(user.id, status, customStatus);
      }
    } catch (error) {
      console.error('Failed to update presence:', error);
      throw error;
    }
  };

  const getMqttClient = () => {
    return mqttClient;
  };

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!isAuthenticated || !mqttConnected) return;

      try {
        if (document.hidden) {
          await updatePresence('away');
        } else {
          await updatePresence('online');
        }
      } catch (error) {
        console.error('Error updating presence on visibility change:', error);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, mqttConnected]);

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

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
