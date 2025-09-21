import mqtt from 'mqtt';
import { authHelpers, TokenManager } from './api-utils';

class MQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscriptions = new Map();
    this.messageHandlers = new Map();
    this.connectionCallbacks = [];
    this.disconnectionCallbacks = [];
    
    this.brokerUrl = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:8083/mqtt';
    this.options = {
      keepalive: 60,
      clientId: `orbit_web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      protocolId: 'MQTT',
      protocolVersion: 4,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      will: {
        topic: 'presence/disconnect',
        payload: JSON.stringify({
          client_id: this.options?.clientId,
          timestamp: new Date().toISOString()
        }),
        qos: 0,
        retain: false
      }
    };
  }

  async connect() {
    if (this.isConnected) {
      return Promise.resolve();
    }

    try {
      const credentials = await authHelpers.getMqttCredentials();
      const user = TokenManager.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      this.options.username = credentials.username;
      this.options.password = credentials.password;
      this.options.clientId = `orbit_web_${user.id}_${Date.now()}`;

      return new Promise((resolve, reject) => {
        this.client = mqtt.connect(this.brokerUrl, this.options);

        this.client.on('connect', () => {
          this.isConnected = true;
          
          this.subscribeToPresence(user.id);
          
          this.connectionCallbacks.forEach(callback => callback());
          
          resolve();
        });

        this.client.on('error', (error) => {
          this.isConnected = false;
          reject(error);
        });

        this.client.on('close', () => {
          this.isConnected = false;
          
          this.disconnectionCallbacks.forEach(callback => callback());
        });

        this.client.on('message', (topic, message) => {
          this.handleMessage(topic, message);
        });

        this.client.on('reconnect', () => {
        });
      });
    } catch (error) {
      console.error('Failed to connect to MQTT:', error);
      throw error;
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      this.subscriptions.clear();
    }
  }

  // Subscribe to conversation messages
  subscribeToConversation(conversationId, messageHandler) {
    const topic = `chat/${conversationId}/messages`;
    return this.subscribe(topic, messageHandler);
  }

  // Subscribe to typing indicators
  subscribeToTyping(conversationId, typingHandler) {
    const topic = `chat/${conversationId}/typing`;
    return this.subscribe(topic, typingHandler);
  }

  // Subscribe to presence updates
  subscribeToPresence(userId, presenceHandler = null) {
    const topic = `presence/${userId}/status`;
    return this.subscribe(topic, presenceHandler || this.defaultPresenceHandler);
  }

  // Subscribe to general presence updates
  subscribeToAllPresence(presenceHandler) {
    const topic = 'presence/+/status';
    return this.subscribe(topic, presenceHandler);
  }

  // Generic subscribe method
  subscribe(topic, messageHandler) {
    if (!this.isConnected) {
      this.onConnect(() => this.subscribe(topic, messageHandler));
      return;
    }

    return new Promise((resolve, reject) => {
      this.client.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          reject(error);
        } else {
          this.subscriptions.set(topic, true);
          if (messageHandler) {
            this.messageHandlers.set(topic, messageHandler);
          }
          resolve();
        }
      });
    });
  }

  // Unsubscribe from topic
  unsubscribe(topic) {
    if (!this.isConnected || !this.subscriptions.has(topic)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.client.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          this.subscriptions.delete(topic);
          this.messageHandlers.delete(topic);
          resolve();
        }
      });
    });
  }

  // Publish message
  publish(topic, message, options = { qos: 1, retain: false }) {
    if (!this.isConnected) {
      throw new Error('MQTT not connected');
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    return new Promise((resolve, reject) => {
      this.client.publish(topic, payload, options, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  // Send typing indicator
  sendTypingIndicator(conversationId, isTyping) {
    const user = TokenManager.getUser();
    if (!user) return;

    const topic = `chat/${conversationId}/typing`;
    const message = {
      user_id: user.id,
      display_name: user.display_name,
      is_typing: isTyping,
      timestamp: new Date().toISOString()
    };

    return this.publish(topic, message);
  }

  // Update user presence
  updatePresence(status, customStatus = '') {
    const user = TokenManager.getUser();
    if (!user) return;

    const topic = `presence/${user.id}/status`;
    const message = {
      user_id: user.id,
      status,
      custom_status: customStatus,
      timestamp: new Date().toISOString()
    };

    return this.publish(topic, message);
  }

  // Send heartbeat
  sendHeartbeat() {
    const user = TokenManager.getUser();
    if (!user) return;

    const topic = 'presence/heartbeat';
    const message = {
      user_id: user.id,
      client_id: this.options.clientId,
      timestamp: new Date().toISOString()
    };

    return this.publish(topic, message);
  }

  // Handle incoming messages
  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      
      const handler = this.messageHandlers.get(topic);
      if (handler) {
        handler(payload, topic);
        return;
      }

      for (const [subscribedTopic, handler] of this.messageHandlers.entries()) {
        if (this.topicMatches(subscribedTopic, topic)) {
          handler(payload, topic);
        }
      }

      if (topic.includes('/messages')) {
        this.defaultMessageHandler(payload, topic);
      } else if (topic.includes('/typing')) {
        this.defaultTypingHandler(payload, topic);
      } else if (topic.includes('/status')) {
        this.defaultPresenceHandler(payload, topic);
      }
    } catch (error) {
      console.error('Error handling MQTT message:', error, topic, message.toString());
    }
  }

  // Default message handler
  defaultMessageHandler(payload, topic) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mqtt-message', {
        detail: { payload, topic }
      }));
    }
  }

  // Default typing handler
  defaultTypingHandler(payload, topic) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mqtt-typing', {
        detail: { payload, topic }
      }));
    }
  }

  // Default presence handler
  defaultPresenceHandler(payload, topic) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mqtt-presence', {
        detail: { payload, topic }
      }));
    }
  }

  // Check if topic matches pattern (supports + wildcard)
  topicMatches(pattern, topic) {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  // Connection event handlers
  onConnect(callback) {
    this.connectionCallbacks.push(callback);
  }

  onDisconnect(callback) {
    this.disconnectionCallbacks.push(callback);
  }

  // Start heartbeat interval
  startHeartbeat(interval = 30000) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendHeartbeat().catch(console.error);
      }
    }, interval);
  }

  // Stop heartbeat interval
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      clientId: this.options.clientId,
      subscriptions: Array.from(this.subscriptions.keys())
    };
  }
}

// Create singleton instance
const mqttClient = new MQTTClient();

export default mqttClient;
