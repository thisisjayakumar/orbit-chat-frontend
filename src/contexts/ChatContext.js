'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { chatApiEndpoints, presenceApiEndpoints, mediaApiEndpoints, apiHelpers } from '@/utils/api-list';

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
  
  // State
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

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsLoading(true);
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
            const presenceResponse = await presenceApiEndpoints.getMultipleUserPresence(Array.from(allParticipantIds));
            setPresenceData(presenceResponse);
          } catch (presenceError) {
            console.warn('Presence service unavailable:', presenceError.message);
          }
        }
      } catch (chatError) {
        console.warn('Chat service unavailable:', chatError.message);
        setConversations([]);
        setError('Chat service is not available. Please ensure your backend services are running.');
      }

    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('Unable to connect to chat services');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

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
      const userIds = participantsData.map(p => p.user_id);
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

  // Select active conversation
  const selectConversation = useCallback(async (conversationId) => {
    try {
      setActiveConversation(conversationId);
      
      // Load messages and participants if not already loaded
      if (!messages[conversationId]) {
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
      await chatApiEndpoints.markAsRead(conversationId);
      
      // Refresh messages to get updated read status
      await loadMessages(conversationId);

    } catch (error) {
      console.error('Failed to select conversation:', error);
      setError(error.message);
    }
  }, [messages, participants, mqttClient, loadMessages, loadParticipants]);

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

  // Handle new message from MQTT
  const handleNewMessage = useCallback((messageData, topic) => {
    const conversationId = topic.split('/')[1];
    
    setMessages(prev => {
      const existingMessages = prev[conversationId] || [];
      
      const messageExists = existingMessages.some(msg => msg.id === messageData.id);
      
      if (messageExists) {
        return prev;
      }
      
      return {
        ...prev,
        [conversationId]: [messageData, ...existingMessages]
      };
    });

    // Update conversation's latest message
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, latest_message: messageData }
          : conv
      )
    );

    if (conversationId === activeConversation && messageData.sender_id !== user?.id) {
      setTimeout(async () => {
        await loadMessages(conversationId);
      }, 1000);
    }
  }, [user, activeConversation, loadMessages]);

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

  // Load conversations on auth
  useEffect(() => {
    if (isAuthenticated && user) {
      loadConversations();
    }
  }, [isAuthenticated, user, loadConversations]);

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
    return presenceData[userId] || { status: 'offline' };
  }, [presenceData]);

  const value = {
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
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export default ChatContext;
