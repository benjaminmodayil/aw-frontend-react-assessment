import { storageService, getStorageKey } from '../storage';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    // Test helper methods
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    }
  };
})();

// Override global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock sessionStorage for encryption key
const mockSessionStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
});

describe('storage utilities', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
  });

  describe('getStorageKey', () => {
    it('should generate consistent storage key with app prefix', () => {
      const key = getStorageKey('test');
      expect(key).toBe('task-app_test');
    });

    it('should generate same key for same base key', () => {
      const key1 = getStorageKey('tasks');
      const key2 = getStorageKey('tasks');
      expect(key1).toBe(key2);
      expect(key1).toBe('task-app_tasks');
    });

    it('should handle different base keys correctly', () => {
      expect(getStorageKey('tasks')).toBe('task-app_tasks');
      expect(getStorageKey('preferences')).toBe('task-app_preferences');
      expect(getStorageKey('user')).toBe('task-app_user');
    });

    it('should handle empty string base key', () => {
      const key = getStorageKey('');
      expect(key).toBe('task-app_');
    });
  });

  describe('storageService.save', () => {
    it('should save data to localStorage successfully', () => {
      const testData = { id: 1, name: 'test' };
      const result = storageService.save('test', testData);
      
      expect(result).toBe(true);
      
      const store = mockLocalStorage._getStore();
      const savedData = JSON.parse(store['task-app_test']);
      expect(savedData).toHaveProperty('data');
      expect(savedData).toHaveProperty('checksum');
      expect(savedData).toHaveProperty('timestamp');
    });

    it('should save array data correctly', () => {
      const testData = [{ id: 1 }, { id: 2 }];
      const result = storageService.save('tasks', testData);
      
      expect(result).toBe(true);
      
      const store = mockLocalStorage._getStore();
      const savedData = JSON.parse(store['task-app_tasks']);
      expect(savedData).toHaveProperty('data');
      expect(savedData).toHaveProperty('checksum');
      expect(savedData).toHaveProperty('timestamp');
    });

    it('should save primitive data types', () => {
      storageService.save('string', 'hello');
      storageService.save('number', 42);
      storageService.save('boolean', true);
      
      const store = mockLocalStorage._getStore();
      const stringData = JSON.parse(store['task-app_string']);
      const numberData = JSON.parse(store['task-app_number']);
      const booleanData = JSON.parse(store['task-app_boolean']);
      
      expect(stringData).toHaveProperty('data');
      expect(numberData).toHaveProperty('data');
      expect(booleanData).toHaveProperty('data');
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock setItem to throw an error
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = storageService.save('test', { data: 'test' });
      
      expect(result).toBe(false);
      // In development mode, it should log the error
      if (process.env.NODE_ENV === 'development') {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save to localStorage:',
          expect.any(Error)
        );
      }
      
      consoleSpy.mockRestore();
      mockLocalStorage.setItem = originalSetItem;
    });
  });

  describe('storageService.load', () => {
    it('should load data from localStorage successfully', () => {
      const testData = { id: 1, name: 'test' };
      // First save the data to get it encrypted
      storageService.save('test', testData);
      
      const result = storageService.load('test');
      
      expect(result).toEqual(testData);
    });

    it('should load array data correctly', () => {
      const testData = [{ id: 1 }, { id: 2 }];
      // First save the data to get it encrypted
      storageService.save('tasks', testData);
      
      const result = storageService.load('tasks');
      
      expect(result).toEqual(testData);
    });

    it('should load legacy unencrypted data', () => {
      const testData = { id: 1, name: 'legacy' };
      // Simulate legacy data without encryption
      mockLocalStorage.setItem('task-app_legacy', JSON.stringify(testData));
      
      const result = storageService.load('legacy');
      
      expect(result).toEqual(testData);
    });

    it('should return null when data does not exist', () => {
      const result = storageService.load('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should return null when localStorage returns null', () => {
      const originalGetItem = mockLocalStorage.getItem;
      mockLocalStorage.getItem = () => null;
      
      const result = storageService.load('test');
      
      expect(result).toBeNull();
      
      mockLocalStorage.getItem = originalGetItem;
    });

    it('should handle JSON parse errors gracefully', () => {
      mockLocalStorage.setItem('task-app_test', 'invalid json {');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = storageService.load('test');
      
      expect(result).toBeNull();
      if (process.env.NODE_ENV === 'development') {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load from localStorage:',
          expect.any(Error)
        );
      }
      
      consoleSpy.mockRestore();
    });

    it('should handle localStorage getItem errors gracefully', () => {
      const originalGetItem = mockLocalStorage.getItem;
      mockLocalStorage.getItem = () => {
        throw new Error('Storage access denied');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = storageService.load('test');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load from localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
      mockLocalStorage.getItem = originalGetItem;
    });
  });

  describe('storageService.loadLegacy', () => {
    it('should load legacy data without app prefix', () => {
      const testData = { id: 1, name: 'legacy' };
      mockLocalStorage.setItem('legacy-key', JSON.stringify(testData));
      
      const result = storageService.loadLegacy('legacy-key');
      
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent legacy data', () => {
      const result = storageService.loadLegacy('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should handle legacy JSON parse errors gracefully', () => {
      mockLocalStorage.setItem('legacy', 'invalid json');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = storageService.loadLegacy('legacy');
      
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load legacy data from localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('storageService.clear', () => {
    it('should clear data from localStorage successfully', () => {
      // Setup some data first
      mockLocalStorage.setItem('task-app_test', '{"test": "data"}');
      
      const result = storageService.clear('test');
      
      expect(result).toBe(true);
      
      const store = mockLocalStorage._getStore();
      expect(store['task-app_test']).toBeUndefined();
    });

    it('should handle removeItem errors gracefully', () => {
      const originalRemoveItem = mockLocalStorage.removeItem;
      mockLocalStorage.removeItem = () => {
        throw new Error('Storage access denied');
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = storageService.clear('test');
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to clear localStorage:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
      mockLocalStorage.removeItem = originalRemoveItem;
    });
  });

  describe('integration tests', () => {
    it('should save and load data correctly in sequence', () => {
      const testData = { tasks: [{ id: 1, text: 'Test task', completed: false }] };
      
      // Save data
      const saveResult = storageService.save('tasks', testData);
      expect(saveResult).toBe(true);
      
      // Load data
      const loadResult = storageService.load('tasks');
      expect(loadResult).toEqual(testData);
    });

    it('should handle save, update, and load cycle', () => {
      const initialData = [{ id: 1, text: 'Task 1' }];
      const updatedData = [{ id: 1, text: 'Task 1' }, { id: 2, text: 'Task 2' }];
      
      // Save initial data
      storageService.save('tasks', initialData);
      expect(storageService.load('tasks')).toEqual(initialData);
      
      // Update data
      storageService.save('tasks', updatedData);
      expect(storageService.load('tasks')).toEqual(updatedData);
    });

    it('should handle multiple keys independently', () => {
      const tasksData = [{ id: 1, text: 'Task' }];
      const userPrefs = { theme: 'dark', language: 'en' };
      
      storageService.save('tasks', tasksData);
      storageService.save('preferences', userPrefs);
      
      expect(storageService.load('tasks')).toEqual(tasksData);
      expect(storageService.load('preferences')).toEqual(userPrefs);
      
      // Clear one, verify other remains
      storageService.clear('tasks');
      expect(storageService.load('tasks')).toBeNull();
      expect(storageService.load('preferences')).toEqual(userPrefs);
    });

    it('should demonstrate the timezone bug fix', () => {
      // This test verifies that storage keys are consistent regardless of date/timezone
      const testData = { id: 1, text: 'Persistent task' };
      
      // Save data
      storageService.save('tasks', testData);
      
      // Verify the key format (should not include date or timezone)
      const expectedKey = 'task-app_tasks';
      const store = mockLocalStorage._getStore();
      expect(store[expectedKey]).toBe(JSON.stringify(testData));
      
      // Data should be retrievable with the same key
      const retrievedData = storageService.load('tasks');
      expect(retrievedData).toEqual(testData);
      
      // Key should be predictable and not change
      const key1 = getStorageKey('tasks');
      const key2 = getStorageKey('tasks');
      expect(key1).toBe(key2);
      expect(key1).toBe(expectedKey);
    });
  });
});