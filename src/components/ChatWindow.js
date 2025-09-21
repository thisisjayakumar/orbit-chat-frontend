'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { 
  Send, 
  Paperclip, 
  Smile, 
  MoreVertical, 
  Phone, 
  Video,
  Info,
  User,
  Users,
  Loader2,
  X,
  FileText,
  Image
} from 'lucide-react';

export default function ChatWindow() {
  const { user } = useAuth();
  const { 
    activeConversation, 
    getConversation, 
    getMessages, 
    getParticipants, 
    getTypingUsers,
    getUserPresence,
    sendMessage, 
    sendMessageWithFiles,
    sendTypingIndicator,
    loadMessages 
  } = useChat();

  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastSendTimeRef = useRef(0);
  const fileInputRef = useRef(null);

  const conversation = getConversation(activeConversation);
  const messages = getMessages(activeConversation);
  const participants = getParticipants(activeConversation);
  const typingUsers = getTypingUsers(activeConversation);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cleanup file preview URLs on unmount
  useEffect(() => {
    return () => {
      selectedFiles.forEach(fileObj => {
        if (fileObj.preview) {
          URL.revokeObjectURL(fileObj.preview);
        }
      });
    };
  }, [selectedFiles]);

  // Handle typing indicator
  const handleTypingStart = useCallback(() => {
    if (!isTyping && activeConversation) {
      setIsTyping(true);
      sendTypingIndicator(activeConversation, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (activeConversation) {
        sendTypingIndicator(activeConversation, false);
      }
    }, 3000);
  }, [isTyping, activeConversation, sendTypingIndicator]);

  const handleTypingStop = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping && activeConversation) {
      setIsTyping(false);
      sendTypingIndicator(activeConversation, false);
    }
  }, [isTyping, activeConversation, sendTypingIndicator]);

  // Handle message input
  const handleInputChange = (e) => {
    setMessageText(e.target.value);
    if (e.target.value.trim()) {
      handleTypingStart();
    } else {
      handleTypingStop();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // File validation constants
  const ALLOWED_FILE_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'application/pdf': ['.pdf']
  };
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // File handling functions
  const validateFile = (file) => {
    // Check file type
    if (!ALLOWED_FILE_TYPES[file.type]) {
      throw new Error(`File type ${file.type} is not supported. Please select JPG, PNG, or PDF files.`);
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    // Check file extension matches MIME type
    const allowedExtensions = ALLOWED_FILE_TYPES[file.type];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      throw new Error(`File extension ${fileExtension} does not match the file type`);
    }

    return true;
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = [];
    const errors = [];

    files.forEach(file => {
      try {
        validateFile(file);
        validFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
        });
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
    });

    if (errors.length > 0) {
      alert('Some files could not be added:\n' + errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }

    // Clear the input
    event.target.value = '';
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      // Clean up preview URLs
      const removedFile = prev.find(f => f.id === fileId);
      if (removedFile?.preview) {
        URL.revokeObjectURL(removedFile.preview);
      }
      return updated;
    });
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleSendMessage = async () => {
    if ((!messageText.trim() && selectedFiles.length === 0) || !activeConversation || isSending || isUploading) return;

    // Prevent rapid double-clicks/submissions (debounce)
    const now = Date.now();
    if (now - lastSendTimeRef.current < 1000) {
      return;
    }
    lastSendTimeRef.current = now;

    const content = messageText.trim();
    const filesToSend = [...selectedFiles];
    
    // Clear message text and files immediately to prevent double sends
    setMessageText('');
    setSelectedFiles([]);
    setIsSending(true);
    handleTypingStop();

    try {
      // If there are files, upload them first
      if (filesToSend.length > 0) {
        setIsUploading(true);
        await sendMessageWithFiles(activeConversation, content, filesToSend);
      } else {
        // Send text-only message
        await sendMessage(activeConversation, content);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore message text and files on error
      setMessageText(content);
      setSelectedFiles(filesToSend);
      alert('Failed to send message: ' + error.message);
    } finally {
      setIsSending(false);
      setIsUploading(false);
      messageInputRef.current?.focus();
    }
  };

  // Get conversation title
  const getConversationTitle = () => {
    if (!conversation) return 'Loading...';

    if (conversation.title) {
      return conversation.title;
    }

    if (conversation.type === 'DM' && participants.length > 0) {
      const otherParticipant = participants.find(p => p.user_id !== user?.id);
      return otherParticipant?.display_name || 'Unknown User';
    }

    return 'Conversation';
  };

  // Get online participants count
  const getOnlineCount = () => {
    if (!participants) return 0;
    
    return participants.filter(p => {
      const presence = getUserPresence(p.user_id);
      return presence.status === 'online';
    }).length;
  };

  // Format message timestamp
  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  const renderMessageStatus = (message, isOwn) => {
    if (!isOwn) return null;
    
    return (
      <span className="ml-1 text-xs">
        {message.is_read ? (
          <span className="text-blue-500" title="Read">✓✓</span>
        ) : (
          <span className="text-gray-400" title="Sent">✓</span>
        )}
      </span>
    );
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentGroup = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.sent_at);
      const dateKey = format(messageDate, 'yyyy-MM-dd');

      if (!currentGroup || currentGroup.date !== dateKey) {
        currentGroup = {
          date: dateKey,
          displayDate: isToday(messageDate) 
            ? 'Today' 
            : isYesterday(messageDate) 
              ? 'Yesterday' 
              : format(messageDate, 'MMMM d, yyyy'),
          messages: []
        };
        groups.push(currentGroup);
      }

      currentGroup.messages.push(message);
    });

    return groups;
  };

  // Render message
  const renderMessage = (message, isOwn, showAvatar) => {
    const sender = participants.find(p => p.user_id === message.sender_id);
    
    return (
      <div
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}
      >
        {!isOwn && showAvatar && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2 flex-shrink-0">
            <span className="text-xs font-medium text-gray-600">
              {sender?.display_name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}
        
        {!isOwn && !showAvatar && <div className="w-10 mr-2" />}

        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-1' : 'order-2'}`}>
          {!isOwn && showAvatar && (
            <p className="text-xs text-gray-500 mb-1 ml-1">
              {sender?.display_name || 'Unknown User'}
            </p>
          )}
          
          <div
            className={`
              px-4 py-2 rounded-2xl
              ${isOwn 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-900'
              }
            `}
          >
            {message.content_type === 'text/plain' ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : message.content_type === 'attachment' ? (
              <div className="space-y-2">
                {message.content && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                {/* Always show attachment info if we have file metadata */}
                {(message.meta?.attachment_id || message.meta?.file_name) && (
                  <div className={`flex items-center space-x-2 p-2 rounded-lg ${
                    isOwn 
                      ? 'bg-black bg-opacity-10' 
                      : 'bg-gray-200 bg-opacity-80'
                  }`}>
                    {message.meta.file_type?.startsWith('image/') ? (
                      <Image className={`w-4 h-4 ${
                        isOwn ? 'text-white' : 'text-gray-600'
                      }`} />
                    ) : (
                      <FileText className={`w-4 h-4 ${
                        isOwn ? 'text-white' : 'text-gray-600'
                      }`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isOwn ? 'text-white' : 'text-gray-900'
                      }`}>
                        {message.meta.file_name || 'Attachment'}
                      </p>
                      <div className="flex items-center space-x-2">
                        {message.meta.file_size && (
                          <span className={`text-xs ${
                            isOwn ? 'text-white opacity-75' : 'text-gray-600'
                          }`}>
                            {(message.meta.file_size / 1024 / 1024).toFixed(1)} MB
                          </span>
                        )}
                        {message.meta.status === 'uploading' && (
                          <span className={`text-xs ${
                            isOwn ? 'text-white opacity-75' : 'text-gray-600'
                          }`}>Uploading...</span>
                        )}
                        {message.meta.status === 'ready' && message.meta.attachment_id && (
                          <span className={`text-xs ${
                            isOwn ? 'text-green-200' : 'text-green-600'
                          }`}>Ready</span>
                        )}
                      </div>
                    </div>
                    {message.meta.attachment_id && message.meta.status === 'ready' ? (
                      <button className={`text-xs underline opacity-75 hover:opacity-100 ${
                        isOwn ? 'text-white' : 'text-indigo-600'
                      }`}>
                        Download
                      </button>
                    ) : (
                      <div className={`w-2 h-2 rounded-full animate-pulse ${
                        isOwn ? 'bg-white bg-opacity-50' : 'bg-gray-400'
                      }`}></div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4" />
                <span className="text-sm">{message.content}</span>
              </div>
            )}
          </div>
          
          <p className={`text-xs text-gray-500 mt-1 ${isOwn ? 'text-right' : 'text-left'}`}>
            {formatMessageTime(message.sent_at)}
            {renderMessageStatus(message, isOwn)}
          </p>
        </div>
      </div>
    );
  };

  if (!conversation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate([...messages].reverse());

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {/* Avatar */}
          <div className="relative">
            {conversation.type === 'GROUP' ? (
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            )}
            
            {conversation.type === 'DM' && (
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>

          {/* Title and Status */}
          <div>
            <h2 className="font-semibold text-gray-900">{getConversationTitle()}</h2>
            <p className="text-sm text-gray-500">
              {conversation.type === 'GROUP' 
                ? `${participants.length} members, ${getOnlineCount()} online`
                : (() => {
                    const otherParticipant = participants.find(p => p.user_id !== user?.id);
                    const presence = getUserPresence(otherParticipant?.user_id);
                    return presence?.status || 'offline';
                  })()
              }
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Video className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden p-4" 
        style={{ 
          height: 'calc(100vh - 140px)', // Account for header (~70px) + input area (~70px)
          minHeight: 0 
        }}
      >
        {messageGroups.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-gray-400" />
            </div>
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full">
                    {group.displayDate}
                  </div>
                </div>

                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((message, index) => {
                    const isOwn = message.sender_id === user?.id;
                    const prevMessage = group.messages[index - 1];
                    const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;
                    
                    return (
                      <div key={`${message.id}-${index}`}>
                        {renderMessage(message, isOwn, showAvatar)}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Typing indicators */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-gray-500 text-sm mt-4">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            <span>
              {typingUsers.length === 1 
                ? `${typingUsers[0].display_name} is typing...`
                : `${typingUsers.length} people are typing...`
              }
            </span>
          </div>
        )}

        {/* Bottom padding and scroll anchor */}
        <div className="pb-4">
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {/* File Preview Area */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {selectedFiles.map((fileObj) => (
                <div key={fileObj.id} className="flex items-center space-x-3 p-2 bg-white rounded border">
                  {fileObj.preview ? (
                    <img 
                      src={fileObj.preview} 
                      alt={fileObj.name}
                      className="w-10 h-10 object-cover rounded"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileObj.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(fileObj.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(fileObj.id)}
                    className="p-1 text-gray-400 hover:text-red-500 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button 
            onClick={handleAttachmentClick}
            disabled={isUploading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={messageInputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Smile className="w-5 h-5" />
          </button>

          <button
            onClick={handleSendMessage}
            disabled={(!messageText.trim() && selectedFiles.length === 0) || isSending || isUploading}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSending || isUploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
