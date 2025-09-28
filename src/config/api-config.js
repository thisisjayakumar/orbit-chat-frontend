// API Configuration for network access
// Change these URLs based on your network setup

const getApiBaseUrl = (service, defaultPort) => {
  // Check if we're accessing from network IP
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Use the same hostname as the frontend for API calls
    return `http://${window.location.hostname}:${defaultPort}`;
  }
  
  // Default to localhost for local development
  return `http://localhost:${defaultPort}`;
};

export const API_CONFIG = {
  auth: getApiBaseUrl('auth', 8080),
  chat: getApiBaseUrl('chat', 8003),
  presence: getApiBaseUrl('presence', 8002),
  media: getApiBaseUrl('media', 8004),
  keycloak: getApiBaseUrl('keycloak', 8080),
  mqtt: typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `ws://${window.location.hostname}:8083/mqtt`
    : 'ws://localhost:8083/mqtt'
};

export default API_CONFIG;
