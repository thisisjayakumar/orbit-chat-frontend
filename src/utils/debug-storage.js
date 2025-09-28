// Debug utility for localStorage inspection

export const debugStorage = {
  // List all orbit chat storage keys
  listChatKeys: () => {
    if (typeof window === 'undefined') return [];
    
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('orbit_chat_')) {
        keys.push(key);
      }
    }
    return keys;
  },

  // Get all chat storage data
  getAllChatData: () => {
    const keys = debugStorage.listChatKeys();
    const data = {};
    
    keys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        data[key] = value ? JSON.parse(value) : null;
      } catch (error) {
        data[key] = { error: error.message, rawValue: localStorage.getItem(key) };
      }
    });
    
    return data;
  },

  // Clear all chat storage
  clearAllChatData: () => {
    const keys = debugStorage.listChatKeys();
    keys.forEach(key => localStorage.removeItem(key));
    console.log(`Cleared ${keys.length} chat storage keys`);
  },

  // Log storage summary
  logStorageSummary: () => {
    const data = debugStorage.getAllChatData();
    console.log('=== ORBIT CHAT STORAGE SUMMARY ===');
    Object.entries(data).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !value.error) {
        const length = Array.isArray(value) ? value.length : Object.keys(value).length;
        console.log(`${key}: ${Array.isArray(value) ? 'Array' : 'Object'} with ${length} items`);
      } else {
        console.log(`${key}:`, value);
      }
    });
    console.log('================================');
  },

  // Watch for storage changes
  watchStorage: () => {
    const originalSetItem = localStorage.setItem;
    const originalRemoveItem = localStorage.removeItem;
    
    localStorage.setItem = function(key, value) {
      if (key.startsWith('orbit_chat_')) {
        console.log(`🔄 Storage SET: ${key}`, { valueLength: value.length });
      }
      return originalSetItem.apply(this, arguments);
    };
    
    localStorage.removeItem = function(key) {
      if (key.startsWith('orbit_chat_')) {
        console.log(`🗑️ Storage REMOVE: ${key}`);
      }
      return originalRemoveItem.apply(this, arguments);
    };
    
    console.log('👀 Storage watcher enabled for orbit_chat_ keys');
  }
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.debugStorage = debugStorage;
}

export default debugStorage;
