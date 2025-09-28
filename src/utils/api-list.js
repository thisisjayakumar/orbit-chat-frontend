import { chatApi, presenceApi, mediaApi, handleApiError } from './api-utils';

// Chat API endpoints
export const chatApiEndpoints = {
  // Conversations
  createConversation: async (data) => {
    try {
      console.log('Creating conversation with data:', data);
      const response = await chatApi.post('/api/v1/conversations', data);
      console.log('Conversation created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('Conversation creation failed:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      throw new Error(handleApiError(error));
    }
  },

  getUserConversations: async () => {
    try {
      const response = await chatApi.get('/api/v1/conversations');
      return response.data || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getConversation: async (conversationId) => {
    try {
      const response = await chatApi.get(`/api/v1/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  updateConversation: async (conversationId, data) => {
    try {
      const response = await chatApi.put(`/api/v1/conversations/${conversationId}`, data);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Messages
  getMessages: async (conversationId, limit = 50, offset = 0) => {
    try {
      const response = await chatApi.get(`/api/v1/conversations/${conversationId}/messages`, {
        params: { limit, offset }
      });
      return response.data || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  sendMessage: async (conversationId, messageData) => {
    try {
      const response = await chatApi.post(`/api/v1/conversations/${conversationId}/messages`, messageData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  markAsRead: async (conversationId) => {
    try {
      const response = await chatApi.post(`/api/v1/conversations/${conversationId}/read`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  sendTypingIndicator: async (conversationId, isTyping) => {
    try {
      const response = await chatApi.post(`/api/v1/conversations/${conversationId}/typing`, {
        is_typing: isTyping
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  // Participants
  getParticipants: async (conversationId) => {
    try {
      const response = await chatApi.get(`/api/v1/conversations/${conversationId}/participants`);
      return response.data || [];
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  addParticipant: async (conversationId, participantData) => {
    try {
      const response = await chatApi.post(`/api/v1/conversations/${conversationId}/participants`, participantData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  removeParticipant: async (conversationId, userId) => {
    try {
      const response = await chatApi.delete(`/api/v1/conversations/${conversationId}/participants/${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// Presence API endpoints
export const presenceApiEndpoints = {
  getUserPresence: async (userId) => {
    try {
      const response = await presenceApi.get(`/api/v1/presence/${userId}`);
      return response.data;
    } catch (error) {
      console.warn('Presence service unavailable:', error.message);
      // Return default offline status
      return {
        user_id: userId,
        status: 'offline',
        last_seen: new Date().toISOString()
      };
    }
  },

  setUserStatus: async (userId, status, customStatus = '') => {
    try {
      console.log(`Setting user ${userId} status to ${status} with custom status: ${customStatus}`);
      console.log(`Presence API URL: ${presenceApi.defaults.baseURL}/api/v1/presence/${userId}/status`);
      
      const response = await presenceApi.put(`/api/v1/presence/${userId}/status`, {
        status,
        custom_status: customStatus
      });
      console.log(`Presence update successful for user ${userId}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`Failed to set presence for user ${userId}:`, error);
      console.error(`Error details:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // If presence service is down, don't throw error - just log it
      if (error.response?.status >= 500 || error.code === 'ECONNREFUSED') {
        console.warn('Presence service appears to be down, continuing without presence update');
        return { status: 'offline', message: 'Presence service unavailable' };
      }
      
      throw new Error(handleApiError(error));
    }
  },

  getMultipleUserPresence: async (userIds) => {
    try {
      const response = await presenceApi.post('/api/v1/presence/bulk', {
        user_ids: userIds
      });
      return response.data;
    } catch (error) {
      console.warn('Presence service unavailable:', error.message);
      // Return default offline status for all users
      const defaultPresence = {};
      userIds.forEach(userId => {
        defaultPresence[userId] = {
          user_id: userId,
          status: 'offline',
          last_seen: new Date().toISOString()
        };
      });
      return defaultPresence;
    }
  },

  getUserSessions: async (userId) => {
    try {
      const response = await presenceApi.get(`/api/v1/presence/${userId}/sessions`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// Media API endpoints
export const mediaApiEndpoints = {
  initiateUpload: async (fileData) => {
    try {
      const response = await mediaApi.post('/api/v1/upload/initiate', fileData);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  completeUpload: async (attachmentId) => {
    try {
      const response = await mediaApi.post(`/api/v1/upload/${attachmentId}/complete`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getAttachment: async (attachmentId) => {
    try {
      const response = await mediaApi.get(`/api/v1/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getDownloadUrl: async (attachmentId) => {
    try {
      const response = await mediaApi.get(`/api/v1/attachments/${attachmentId}/download`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  deleteAttachment: async (attachmentId) => {
    try {
      const response = await mediaApi.delete(`/api/v1/attachments/${attachmentId}`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  associateWithMessage: async (attachmentId, messageId) => {
    try {
      const response = await mediaApi.post(`/api/v1/attachments/${attachmentId}/associate`, {
        message_id: messageId
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  getMessageAttachments: async (messageId) => {
    try {
      const response = await mediaApi.get(`/api/v1/messages/${messageId}/attachments`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },

  generateThumbnail: async (attachmentId) => {
    try {
      const response = await mediaApi.post(`/api/v1/attachments/${attachmentId}/thumbnail`);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  },
};

// Utility functions for common operations
export const apiHelpers = {
  // Create a direct message conversation
  createDirectMessage: async (participantId) => {
    return chatApiEndpoints.createConversation({
      type: 'DM',
      participant_ids: [participantId],
      is_encrypted: false
    });
  },

  // Create a group conversation
  createGroupChat: async (title, participantIds, isEncrypted = false) => {
    return chatApiEndpoints.createConversation({
      type: 'GROUP',
      title,
      participant_ids: participantIds,
      is_encrypted: isEncrypted
    });
  },

  // Send a text message
  sendTextMessage: async (conversationId, content, dedupeKey = null) => {
    return chatApiEndpoints.sendMessage(conversationId, {
      content_type: 'text/plain',
      content,
      dedupe_key: dedupeKey || `msg-${Date.now()}-${Math.random()}`
    });
  },

  // Upload and send file
  uploadAndSendFile: async (conversationId, file) => {
    try {
      // Initiate upload
      const uploadResponse = await mediaApiEndpoints.initiateUpload({
        file_name: file.name,
        content_type: file.type,
        size: file.size
      });

      // Complete upload (in real implementation, you'd upload to the presigned URL)
      await mediaApiEndpoints.completeUpload(uploadResponse.attachment_id);

      // Send message with attachment
      const message = await chatApiEndpoints.sendMessage(conversationId, {
        content_type: 'attachment',
        content: file.name,
        meta: {
          attachment_id: uploadResponse.attachment_id,
          file_type: file.type,
          file_size: file.size
        }
      });

      // Associate attachment with message
      await mediaApiEndpoints.associateWithMessage(uploadResponse.attachment_id, message.id);

      return message;
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  },

  // Get conversation with participants and presence
  getConversationDetails: async (conversationId) => {
    try {
      const [conversation, participants] = await Promise.all([
        chatApiEndpoints.getConversation(conversationId),
        chatApiEndpoints.getParticipants(conversationId)
      ]);

      // Get presence for all participants
      const userIds = participants.map(p => p.user_id);
      const presenceData = await presenceApiEndpoints.getMultipleUserPresence(userIds);

      return {
        conversation,
        participants: participants.map(p => ({
          ...p,
          presence: presenceData[p.user_id] || { status: 'offline' }
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get conversation details: ${error.message}`);
    }
  },

  // Get conversations with latest message and unread count
  getConversationsWithDetails: async () => {
    try {
      const conversations = await chatApiEndpoints.getUserConversations();
      
      if (!conversations || !Array.isArray(conversations) || conversations.length === 0) {
        return [];
      }
      
      const conversationsWithDetails = await Promise.all(
        conversations.map(async (conv) => {
          try {
            const [messages, participants] = await Promise.all([
              chatApiEndpoints.getMessages(conv.id, 1, 0),
              chatApiEndpoints.getParticipants(conv.id)
            ]);

            return {
              ...conv,
              latest_message: messages[0] || null,
              participant_count: participants.length,
              participants: participants
            };
          } catch (error) {
            return conv;
          }
        })
      );

      return conversationsWithDetails;
    } catch (error) {
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
  },
};

// Export all endpoints
export default {
  chat: chatApiEndpoints,
  presence: presenceApiEndpoints,
  media: mediaApiEndpoints,
  helpers: apiHelpers,
};
