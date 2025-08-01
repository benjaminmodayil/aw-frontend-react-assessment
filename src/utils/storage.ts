import { encryptData, decryptData, generateChecksum, validateChecksum } from './encryption';

// Utility to generate consistent storage keys
export const getStorageKey = (baseKey: string): string => {
  return `task-app_${baseKey}`;
};

// Storage operations with encryption and error handling
export const storageService = {
  save: (key: string, data: any): boolean => {
    try {
      const storageKey = getStorageKey(key);
      const encrypted = encryptData(data);
      const checksum = generateChecksum(data);
      
      const storageData = {
        data: encrypted,
        checksum: checksum,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(storageData));
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to save to localStorage:', error);
      }
      return false;
    }
  },

  load: (key: string): any => {
    try {
      const storageKey = getStorageKey(key);
      const storedData = localStorage.getItem(storageKey);
      
      if (!storedData) return null;
      
      const parsedData = JSON.parse(storedData);
      
      // Handle new encrypted format
      if (parsedData.data && parsedData.checksum) {
        const decrypted = decryptData(parsedData.data);
        
        // Validate data integrity
        if (!validateChecksum(decrypted, parsedData.checksum)) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Data integrity check failed');
          }
          return null;
        }
        
        return decrypted;
      }
      
      // Handle legacy unencrypted data
      return parsedData;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load from localStorage:', error);
      }
      return null;
    }
  },

  loadLegacy: (key: string): any => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load legacy data from localStorage:', error);
      }
      return null;
    }
  },

  clear: (key: string): boolean => {
    try {
      const storageKey = getStorageKey(key);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to clear localStorage:', error);
      }
      return false;
    }
  }
};