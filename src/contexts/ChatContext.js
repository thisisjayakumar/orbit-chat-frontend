'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { chatApiEndpoints, presenceApiEndpoints, mediaApiEndpoints, apiHelpers } from '@/utils/api-list';
import { devLog } from '@/utils/debug';
import debugStorage from '@/utils/debug-storage';

const ChatContext = createContext({});

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated, getMqttClient } = useAuth();
  
  // Helper functions for localStorage persistence
  const getStorageKey = useCallback((key) => `orbit_chat_${user?.id}_${key}`, [user?.id]);
  
  const loadFromStorage = useCallback((key, defaultValue = null) => {
    if (typeof window === 'undefined' || !user?.id) return defaultValue;
    try {
      const storageKey = getStorageKey(key);
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : defaultValue;

      return parsed;
    } catch (error) {
      console.warn(`Failed to load ${key} from storage:`, error);
      return defaultValue;
    }
  }, [getStorageKey, user?.id]);
  
  const saveToStorage = useCallback((key, value) => {
    if (typeof window === 'undefined' || !user?.id) return;
    try {
      const storageKey = getStorageKey(key);
      localStorage.setItem(storageKey, JSON.stringify(value));

    } catch (error) {
      console.warn(`Failed to save ${key} to storage:`, error);
    }
  }, [getStorageKey, user?.id]);
  
  // State - initialize with empty values first, load from storage after user is available
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState({});
  const [participants, setParticipants] = useState({});
  const [presenceData, setPresenceData] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // MQTT client
  const mqttClient = getMqttClient();

  // Load cached data when user becomes available
  useEffect(() => {
    if (user?.id && typeof window !== 'undefined') {
      // Enable storage watcher for debugging
      if (process.env.NODE_ENV === 'development') {
        debugStorage.watchStorage();
      }
      
      // Load cached data
      const cachedConversations = loadFromStorage('conversations', []);
      const cachedActiveConversation = loadFromStorage('activeConversation', null);
      const cachedMessages = loadFromStorage('messages', {});
      const cachedParticipants = loadFromStorage('participants', {});
      
      // Only set if we have cached data
      if (cachedConversations.length > 0) {
        setConversations(cachedConversations);
      }
      if (cachedActiveConversation) {
        setActiveConversation(cachedActiveConversation);
      }
      if (Object.keys(cachedMessages).length > 0) {
        setMessages(cachedMessages);
      }
      if (Object.keys(cachedParticipants).length > 0) {
        setParticipants(cachedParticipants);
      }

    }
  }, [user?.id, loadFromStorage]);

  // Load conversations
  const loadConversations = useCallback(async (forceRefresh = false) => {
    if (!isAuthenticated || !user) return;

    try {
      // Only show loading if we don't have cached data or forcing refresh
      if (forceRefresh || conversations.length === 0) {
        setIsLoading(true);
      }
      setError(null);
      
      try {
        const conversationsData = await apiHelpers.getConversationsWithDetails();
        setConversations(conversationsData);

        // Load presence data for all participants
        const allParticipantIds = new Set();
        conversationsData.forEach(conv => {
          if (conv.participants) {
            conv.participants.forEach(p => allParticipantIds.add(p.user_id));
          }
        });

        if (allParticipantIds.size > 0) {
          try {
            // Convert user IDs to strings for the presence API
            const userIdsAsStrings = Array.from(allParticipantIds).map(id => String(id));
            const presenceResponse = await presenceApiEndpoints.getMultipleUserPresence(userIdsAsStrings);
            setPresenceData(presenceResponse);
          } catch (presenceError) {
            console.warn('Presence service unavailable:', presenceError.message);
          }
        }
      } catch (chatError) {
        console.warn('Chat service unavailable:', chatError.message);
        // Only clear conversations if we don't have cached ones and this is not a background refresh
        if (conversations.length === 0) {
          setConversations([]);
          setError('Chat service is not available. Please ensure your backend services are running.');
        }
      }

    } catch (error) {
      console.error('Failed to load conversations:', error);
      if (conversations.length === 0) {
        setError('Unable to connect to chat services');
      }
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, conversations.length]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId, limit = 50, offset = 0) => {
    try {
      const messagesData = await chatApiEndpoints.getMessages(conversationId, limit, offset);
      
      setMessages(prev => ({
        ...prev,
        [conversationId]: offset === 0 ? messagesData : [...(prev[conversationId] || []), ...messagesData]
      }));

      return messagesData;
    } catch (error) {
      console.error('Failed to load messages:', error);
      throw error;
    }
  }, []);

  // Load participants for a conversation
  const loadParticipants = useCallback(async (conversationId) => {
    try {
      const participantsData = await chatApiEndpoints.getParticipants(conversationId);
      
      setParticipants(prev => ({
        ...prev,
        [conversationId]: participantsData
      }));

      // Load presence for participants
      const userIds = participantsData.map(p => String(p.user_id));
      if (userIds.length > 0) {
        const presenceResponse = await presenceApiEndpoints.getMultipleUserPresence(userIds);
        setPresenceData(prev => ({ ...prev, ...presenceResponse }));
      }

      return participantsData;
    } catch (error) {
      console.error('Failed to load participants:', error);
      throw error;
    }
  }, []);

  // Handle new message from MQTT
  const handleNewMessage = useCallback((messageData, topic) => {
    const conversationId = topic.split('/')[1];
    
    // Ensure is_read is set for proper read receipt display
    // Own messages: mark as not read initially (will be updated after backend processes)
    // Other's messages: mark as not read (will be updated after markAsRead call)
    const enrichedMessage = {
      ...messageData,
      is_read: messageData.is_read === undefined ? false : messageData.is_read
    };
    
    setMessages(prev => {
      const existingMessages = prev[conversationId] || [];
      
      const messageExists = existingMessages.some(msg => msg.id === enrichedMessage.id);
      
      if (messageExists) {
        return prev;
      }
      
      return {
        ...prev,
        [conversationId]: [enrichedMessage, ...existingMessages]
      };
    });

    // Update conversation's latest message
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, latest_message: enrichedMessage }
          : conv
      )
    );

    if (conversationId === activeConversation && enrichedMessage.sender_id !== user?.id) {
      // Refresh messages in background to update read status
      setTimeout(async () => {
        try {
          const freshMessages = await chatApiEndpoints.getMessages(conversationId, 50, 0);
          setMessages(prev => ({
            ...prev,
            [conversationId]: freshMessages
          }));
        } catch (error) {
          console.warn('Failed to refresh messages after MQTT delivery:', error);
        }
      }, 1000);
    }
  }, [user, activeConversation]);

  // Handle typing indicator from MQTT
  const handleTypingIndicator = useCallback((typingData, topic) => {
    const conversationId = topic.split('/')[1];
    
    setTypingUsers(prev => {
      const conversationTyping = prev[conversationId] || {};
      
      if (typingData.is_typing) {
        return {
          ...prev,
          [conversationId]: {
            ...conversationTyping,
            [typingData.user_id]: {
              display_name: typingData.display_name,
              timestamp: new Date(typingData.timestamp)
            }
          }
        };
      } else {
        const { [typingData.user_id]: removed, ...remaining } = conversationTyping;
        return {
          ...prev,
          [conversationId]: remaining
        };
      }
    });

    setTimeout(() => {
      setTypingUsers(prev => {
        const conversationTyping = prev[conversationId] || {};
        const { [typingData.user_id]: removed, ...remaining } = conversationTyping;
        return {
          ...prev,
          [conversationId]: remaining
        };
      });
    }, 5000);
  }, []);

  // Handle presence updates from MQTT
  const handlePresenceUpdate = useCallback((presenceData) => {
    setPresenceData(prev => ({
      ...prev,
      [presenceData.user_id]: presenceData
    }));
  }, []);

  // Select active conversation
  const selectConversation = useCallback(async (conversationId) => {
    try {
      setActiveConversation(conversationId);
      
      // Load messages and participants if not already loaded
      if (!messages[conversationId] || messages[conversationId].length === 0) {
        await loadMessages(conversationId);
      }
      
      if (!participants[conversationId]) {
        await loadParticipants(conversationId);
      }

      // Subscribe to MQTT topics for this conversation
      if (mqttClient && mqttClient.isConnected) {
        await mqttClient.subscribeToConversation(conversationId, handleNewMessage);
        await mqttClient.subscribeToTyping(conversationId, handleTypingIndicator);
      }

      // Mark conversation as read
      try {
        await chatApiEndpoints.markAsRead(conversationId);
        
        // Only refresh messages if we need to update read status and we have messages
        if (messages[conversationId] && messages[conversationId].length > 0) {
          // Refresh in background to update read status without overwriting cached messages
          setTimeout(async () => {
            try {
              const freshMessages = await chatApiEndpoints.getMessages(conversationId, 50, 0);
              setMessages(prev => ({
                ...prev,
                [conversationId]: freshMessages
              }));
            } catch (error) {
              console.warn('Failed to refresh message read status:', error);
            }
          }, 500);
        }
      } catch (error) {
        console.warn('Failed to mark conversation as read:', error);
      }

    } catch (error) {
      console.error('Failed to select conversation:', error);
      setError(error.message);
    }
  }, [messages, participants, mqttClient, loadMessages, loadParticipants, handleNewMessage, handleTypingIndicator]);

  // Send message
  const sendMessage = useCallback(async (conversationId, content, contentType = 'text/plain') => {
    try {
      const messageData = {
        content_type: contentType,
        content,
        dedupe_key: `msg-${Date.now()}-${Math.random()}`
      };

      const newMessage = await chatApiEndpoints.sendMessage(conversationId, messageData);
      

      // Update conversation's latest message
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, latest_message: newMessage }
            : conv
        )
      );

      return newMessage;
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }, []);

  // Send message with files
  const sendMessageWithFiles = useCallback(async (conversationId, content, files) => {
    try {
      // Process each file separately to create individual messages
      let lastMessage = null;
      
      for (const fileObj of files) {
        const messageData = {
          content_type: 'attachment',
          content: content || fileObj.name, // Use content or filename
          meta: {
            file_name: fileObj.name,
            file_type: fileObj.type,
            file_size: fileObj.size,
            status: 'uploading'
          },
          dedupe_key: `msg-${Date.now()}-${Math.random()}`
        };

        const newMessage = await chatApiEndpoints.sendMessage(conversationId, messageData);

        let retries = 0;
        const maxRetries = 10;
        const retryDelay = 500;

        while (retries < maxRetries) {
          try {
            const uploadResponse = await mediaApiEndpoints.initiateUpload({
              file_name: fileObj.name,
              content_type: fileObj.type,
              size: fileObj.size,
              message_id: newMessage.id
            });


            const uploadResult = await fetch(uploadResponse.upload_url, {
              method: 'PUT',
              body: fileObj.file,
              headers: {
                'Content-Type': fileObj.type,
              },
            });

            if (!uploadResult.ok) {
              throw new Error(`Failed to upload ${fileObj.name} to storage`);
            }

            await mediaApiEndpoints.completeUpload(uploadResponse.attachment_id);

            const updatedMessage = {
              ...newMessage,
              meta: {
                ...newMessage.meta,
                attachment_id: uploadResponse.attachment_id,
                status: 'ready'
              }
            };

            setMessages(prev => ({
              ...prev,
              [conversationId]: prev[conversationId]?.map(msg => 
                msg.id === newMessage.id ? updatedMessage : msg
              ) || []
            }));

            lastMessage = updatedMessage;
            break;

          } catch (uploadError) {
            
            if (uploadError.message.includes('attachments_message_id_fkey') || 
                uploadError.message.includes('foreign key constraint')) {
              retries++;
              if (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              }
            }
            
            throw uploadError;
          }
        }

        if (retries >= maxRetries) {
          throw new Error(`Failed to upload ${fileObj.name}: Message not found in database after ${maxRetries} attempts`);
        }
      }

      // Update conversation's latest message
      if (lastMessage) {
        setConversations(prev => 
          prev.map(conv => 
            conv.id === conversationId 
              ? { ...conv, latest_message: lastMessage }
              : conv
          )
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to send message with files:', error);
      throw error;
    }
  }, []);

  // Send typing indicator
  const sendTypingIndicator = useCallback(async (conversationId, isTyping) => {
    if (!mqttClient || !mqttClient.isConnected) return;

    try {
      await mqttClient.sendTypingIndicator(conversationId, isTyping);
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  }, [mqttClient]);

  // Create new conversation
  const createConversation = useCallback(async (type, participantIds, title = '') => {
    try {
      const conversationData = {
        type,
        participant_ids: participantIds,
        title,
        is_encrypted: false
      };

      const newConversation = await chatApiEndpoints.createConversation(conversationData);
      
      // Add to conversations list
      setConversations(prev => [newConversation, ...prev]);
      
      // Select the new conversation
      await selectConversation(newConversation.id);

      return newConversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [selectConversation]);

  // Initialize MQTT subscriptions
  useEffect(() => {
    if (!mqttClient || !mqttClient.isConnected || !user) return;

    // Subscribe to general presence updates
    mqttClient.subscribeToAllPresence(handlePresenceUpdate);

    // Listen for MQTT events via custom events
    const handleMqttMessage = (event) => {
      const { payload, topic } = event.detail;
      if (topic.includes('/messages')) {
        handleNewMessage(payload, topic);
      }
    };

    const handleMqttTyping = (event) => {
      const { payload, topic } = event.detail;
      handleTypingIndicator(payload, topic);
    };

    const handleMqttPresence = (event) => {
      const { payload } = event.detail;
      handlePresenceUpdate(payload);
    };

    window.addEventListener('mqtt-message', handleMqttMessage);
    window.addEventListener('mqtt-typing', handleMqttTyping);
    window.addEventListener('mqtt-presence', handleMqttPresence);

    return () => {
      window.removeEventListener('mqtt-message', handleMqttMessage);
      window.removeEventListener('mqtt-typing', handleMqttTyping);
      window.removeEventListener('mqtt-presence', handleMqttPresence);
    };
  }, [mqttClient, user, handleNewMessage, handleTypingIndicator, handlePresenceUpdate]);

  // Refresh presence data for specific users
  const refreshPresenceData = useCallback(async (userIds = null) => {
    try {
      let idsToRefresh = userIds;
      
      if (!idsToRefresh) {
        // If no specific IDs provided, refresh all known users
        const allParticipantIds = new Set();
        conversations.forEach(conv => {
          if (conv.participants) {
            conv.participants.forEach(p => allParticipantIds.add(p.user_id));
          }
        });
        
        // Also add current user
        if (user?.id) {
          allParticipantIds.add(user.id);
        }
        
        idsToRefresh = Array.from(allParticipantIds);
      }
      
      if (idsToRefresh.length > 0) {
        const userIdsAsStrings = idsToRefresh.map(id => String(id));
        const presenceResponse = await presenceApiEndpoints.getMultipleUserPresence(userIdsAsStrings);
        setPresenceData(prev => ({ ...prev, ...presenceResponse }));
        return presenceResponse;
      }
    } catch (error) {
      console.error('Failed to refresh presence data:', error);
    }
  }, [conversations, user]);

  // Persist state to localStorage
  useEffect(() => {
    if (user?.id && conversations.length > 0) {
      saveToStorage('conversations', conversations);
    }
  }, [conversations, user?.id, saveToStorage]);

  useEffect(() => {
    if (user?.id && activeConversation) {
      saveToStorage('activeConversation', activeConversation);
    }
  }, [activeConversation, user?.id, saveToStorage]);

  useEffect(() => {
    if (user?.id && Object.keys(messages).length > 0) {
      saveToStorage('messages', messages);
    }
  }, [messages, user?.id, saveToStorage]);

  useEffect(() => {
    if (user?.id && Object.keys(participants).length > 0) {
      saveToStorage('participants', participants);
    }
  }, [participants, user?.id, saveToStorage]);

  // Clear storage on logout
  useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      // Clear all chat-related storage when user logs out
      try {
        const pattern = `orbit_chat_`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const storageKey = localStorage.key(i);
          if (storageKey && storageKey.startsWith(pattern)) {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (error) {
        console.warn('Failed to clear chat storage:', error);
      }
    }
  }, [isAuthenticated]);

  // Load conversations on auth - after cached data is loaded
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Small delay to ensure cached data is loaded first
      const timer = setTimeout(() => {
        if (conversations.length > 0) {
          // Refresh in background after a delay
          setTimeout(() => loadConversations(true), 2000);
        } else {
          loadConversations();
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user?.id, conversations.length, loadConversations]);

  // Refresh presence data periodically and on auth
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Initial refresh after login
    const initialRefresh = setTimeout(() => {
      refreshPresenceData();
    }, 2000); // Wait 2 seconds after login to refresh presence

    // Set up periodic refresh
    const interval = setInterval(() => {
      refreshPresenceData();
    }, 30000); // Refresh every 30 seconds

    // Listen for presence update events
    const handlePresenceUpdated = (event) => {
      // Refresh presence data immediately when we get an update event
      refreshPresenceData();
    };

    window.addEventListener('presence-updated', handlePresenceUpdated);

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
      window.removeEventListener('presence-updated', handlePresenceUpdated);
    };
  }, [isAuthenticated, user, refreshPresenceData]);

  // Get conversation by ID
  const getConversation = useCallback((conversationId) => {
    return conversations.find(conv => conv.id === conversationId);
  }, [conversations]);

  // Get messages for conversation
  const getMessages = useCallback((conversationId) => {
    return messages[conversationId] || [];
  }, [messages]);

  // Get participants for conversation
  const getParticipants = useCallback((conversationId) => {
    return participants[conversationId] || [];
  }, [participants]);

  // Get typing users for conversation
  const getTypingUsers = useCallback((conversationId) => {
    const typing = typingUsers[conversationId] || {};
    return Object.entries(typing)
      .filter(([userId]) => userId !== user?.id) // Exclude current user
      .map(([userId, data]) => ({ userId, ...data }));
  }, [typingUsers, user]);

  // Get user presence
  const getUserPresence = useCallback((userId) => {
    const presence = presenceData[userId] || { status: 'offline' };
    return presence;
  }, [presenceData]);

  // Debug function to inspect storage
  const debugChatStorage = useCallback(() => {
    devLog('=== CHAT CONTEXT DEBUG ===');
    devLog('Current state:');
    devLog('- conversations:', conversations.length);
    devLog('- activeConversation:', activeConversation);
    devLog('- messages:', Object.keys(messages).length, 'conversations with messages');
    devLog('- participants:', Object.keys(participants).length, 'conversations with participants');
    
    devLog('\nLocalStorage data:');
    debugStorage.logStorageSummary();
    
    return {
      state: { conversations, activeConversation, messages, participants },
      storage: debugStorage.getAllChatData()
    };
  }, [conversations, activeConversation, messages, participants]);

  const value = useMemo(() => ({
    // State
    conversations,
    activeConversation,
    messages,
    participants,
    presenceData,
    typingUsers,
    isLoading,
    error,

    // Actions
    loadConversations,
    loadMessages,
    loadParticipants,
    selectConversation,
    sendMessage,
    sendMessageWithFiles,
    sendTypingIndicator,
    createConversation,

    // Getters
    getConversation,
    getMessages,
    getParticipants,
    getTypingUsers,
    getUserPresence,
    refreshPresenceData,
    
    // Debug
    debugChatStorage,
  }), [
    conversations, activeConversation, messages, participants, presenceData,
    typingUsers, isLoading, error,
    loadConversations, loadMessages, loadParticipants, selectConversation,
    sendMessage, sendMessageWithFiles, sendTypingIndicator, createConversation,
    getConversation, getMessages, getParticipants, getTypingUsers, getUserPresence,
    refreshPresenceData, debugChatStorage,
  ]);

  // Make context available globally for debugging
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.chatContext = value;
    }
  }, [value]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
