import axios from 'axios';
import { API_CONFIG } from '@/config/api-config';


// API Base URLs - dynamically determined based on hostname
const API_BASE_URLS = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || API_CONFIG.auth,
  chat: process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || API_CONFIG.chat,
  presence: process.env.NEXT_PUBLIC_PRESENCE_SERVICE_URL || API_CONFIG.presence,
  media: process.env.NEXT_PUBLIC_MEDIA_SERVICE_URL || API_CONFIG.media,
  keycloak: process.env.NEXT_PUBLIC_KEYCLOAK_URL || API_CONFIG.keycloak,
};


// Token management
class TokenManager {
  static getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('orbit_token');
    }
    return null;
  }

  static setToken(token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orbit_token', token);
    }
  }

  static removeToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('orbit_token');
      localStorage.removeItem('orbit_user');
      localStorage.removeItem('orbit_organization');
    }
  }

  static getUser() {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('orbit_user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  static setUser(user) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orbit_user', JSON.stringify(user));
    }
  }

  static getOrganization() {
    if (typeof window !== 'undefined') {
      const org = localStorage.getItem('orbit_organization');
      return org ? JSON.parse(org) : null;
    }
    return null;
  }

  static setOrganization(organization) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orbit_organization', JSON.stringify(organization));
    }
  }

  static isAuthenticated() {
    return !!this.getToken();
  }
}

// Create axios instances for each service
const createApiClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth headers
  client.interceptors.request.use(
    (config) => {
      const token = TokenManager.getToken();
      const user = TokenManager.getUser();
      const organization = TokenManager.getOrganization();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const isKeycloakEndpoint = config.url?.includes('/realms/') || 
                                config.baseURL?.includes('/realms/') ||
                                config.baseURL?.includes('8080');
      
      if (!isKeycloakEndpoint) {
        if (user) {
          config.headers['X-User-ID'] = user.id;
        }
        if (organization) {
          config.headers['X-Organization-ID'] = organization.id;
        }
      }

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle auth errors
  client.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        TokenManager.removeToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
};

// API clients for each service
export const authApi = createApiClient(API_BASE_URLS.auth);
export const chatApi = createApiClient(API_BASE_URLS.chat);
export const presenceApi = createApiClient(API_BASE_URLS.presence);
export const mediaApi = createApiClient(API_BASE_URLS.media);

// Auth helpers
export const authHelpers = {
  login: async (email, password) => {
    try {
      // Try direct auth service login first
      const response = await authApi.post('/api/v1/auth/login', {
        email,
        password
      });

      const { user, token } = response.data;
      
      TokenManager.setToken(token);
      TokenManager.setUser(user);

      return { user, token };
    } catch (error) {
      // If direct login fails, try Keycloak as fallback
      console.warn('Direct login failed, trying Keycloak:', error.message);
      
      try {
        const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'master';
        const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'orbit-messenger';
        
        const response = await authApi.post(`/realms/${keycloakRealm}/protocol/openid-connect/token`, 
          new URLSearchParams({
            grant_type: 'password',
            client_id: keycloakClientId,
            username: email,
            password: password,
            scope: 'openid profile email',
          }), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        const { access_token } = response.data;
        
        const userInfoResponse = await authApi.get(`/realms/${keycloakRealm}/protocol/openid-connect/userinfo`, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        const userInfo = userInfoResponse.data;
        const user = {
          id: userInfo.sub,
          email: userInfo.email,
          display_name: userInfo.name || userInfo.preferred_username,
          username: userInfo.preferred_username,
          organization_id: organizationId || 'default-org'
        };

        TokenManager.setToken(access_token);
        TokenManager.setUser(user);

        return { user, token: access_token };
      } catch (keycloakError) {
        throw new Error(error.response?.data?.error || keycloakError.response?.data?.error_description || 'Login failed');
      }
    }
  },

  register: async (email, username, password, displayName, organizationName, organizationId) => {
    try {
      const requestBody = {
        email,
        username,
        password,
        display_name: displayName
      };

      // If organizationId is provided, use it to join existing org
      if (organizationId && organizationId.trim()) {
        requestBody.organization_id = organizationId.trim();
      } else if (organizationName && organizationName.trim()) {
        // Otherwise, create new org with provided name
        requestBody.organization_name = organizationName.trim();
      } else {
        throw new Error('Either organization ID or organization name is required');
      }

      const response = await authApi.post('/api/v1/auth/register', requestBody);

      const { user, token } = response.data;
      
      TokenManager.setToken(token);
      TokenManager.setUser(user);

      return { user, token };
    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  logout: () => {
    TokenManager.removeToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  },

  getCurrentUser: async () => {
    try {
      const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'master';
      const response = await authApi.get(`/realms/${keycloakRealm}/protocol/openid-connect/userinfo`);
      
      const userInfo = response.data;
      const user = {
        id: userInfo.sub,
        email: userInfo.email,
        display_name: userInfo.name || userInfo.preferred_username,
        username: userInfo.preferred_username,
        organization_id: 'default-org' // You might want to get this from user attributes
      };
      
      TokenManager.setUser(user);
      return user;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Failed to get user info');
    }
  },

  validateToken: async (token) => {
    try {
      const response = await authApi.post('/api/v1/auth/validate', { token });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Token validation failed');
    }
  },

  getMqttCredentials: async () => {
    try {
      const user = TokenManager.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Try to get proper MQTT credentials from auth service
      try {
        const response = await authApi.get('/api/v1/auth/mqtt-credentials');
        return {
          username: response.data.username,
          password: response.data.password,
          broker_url: process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt',
          client_id: `orbit_web_${user.id}_${Date.now()}`
        };
      } catch (error) {
        // Fallback to match backend format
        console.warn('Failed to get MQTT credentials from auth service, using fallback');
        return {
          username: `user_${user.id}`, // Match backend format
          password: 'default_mqtt_password',
          broker_url: process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt',
          client_id: `orbit_web_${user.id}_${Date.now()}`
        };
      }
    } catch (error) {
      throw new Error('Failed to get MQTT credentials');
    }
  },

  getOrganizationUsers: async () => {
    try {
      console.log('Making API call to get organization users');
      console.log('Auth API base URL:', authApi.defaults.baseURL);
      console.log('Token available:', !!TokenManager.getToken());
      console.log('User available:', !!TokenManager.getUser());
      
      const response = await authApi.get('/api/v1/auth/users');
      console.log('Organization users API response:', response.data);
      return response.data || [];
    } catch (error) {
      console.error('Organization users API error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw new Error(error.response?.data?.error || 'Failed to get organization users');
    }
  },

  searchUsers: async (query, limit = 10) => {
    try {
      const response = await authApi.get('/api/v1/auth/users/search', {
        params: { q: query, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to search users:', error);
      throw new Error(error.response?.data?.error || 'Failed to search users');
    }
  },

  getUserByUsername: async (username) => {
    try {
      const response = await authApi.get(`/api/v1/auth/users/username/${username}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // User not found
      }
      console.error('Failed to get user by username:', error);
      throw new Error(error.response?.data?.error || 'Failed to get user');
    }
  }
};

// Error handler utility
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    return error.response.data?.error || `Server error: ${error.response.status}`;
  } else if (error.request) {
    // Request was made but no response received
    return 'Network error: Unable to reach server';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
};

// Request retry utility
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

export { TokenManager };
export default { authApi, chatApi, presenceApi, mediaApi, authHelpers, TokenManager };
