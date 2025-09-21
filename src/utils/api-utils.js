import axios from 'axios';


// API Base URLs
const API_BASE_URLS = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:8080',
  chat: process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || 'http://localhost:8003',
  presence: process.env.NEXT_PUBLIC_PRESENCE_SERVICE_URL || 'http://localhost:8002',
  media: process.env.NEXT_PUBLIC_MEDIA_SERVICE_URL || 'http://localhost:8004',
  keycloak: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
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
  login: async (email, password, organizationId) => {
    try {
      const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'master';
      const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'orbit-messenger';
      
      const response = await authApi.post(`/realms/${keycloakRealm}/protocol/openid-connect/token`, 
        new URLSearchParams({
          grant_type: 'password',
          client_id: keycloakClientId,
          username: email, // Using email as username
          password: password,
          scope: 'openid profile email', // Add proper scopes
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, refresh_token } = response.data;
      
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
    } catch (error) {
      throw new Error(error.response?.data?.error_description || error.response?.data?.error || 'Login failed');
    }
  },

  register: async (email, password, displayName, organizationName) => {
    try {
      throw new Error('Registration should be handled through Keycloak admin interface or registration flow');
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration not available - use Keycloak admin interface');
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

      return {
        username: `orbit_${user.id}`,
        password: 'default_mqtt_password',
        broker_url: process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt',
        client_id: `orbit_web_${user.id}_${Date.now()}`
      };
    } catch (error) {
      throw new Error('Failed to get MQTT credentials');
    }
  },
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
