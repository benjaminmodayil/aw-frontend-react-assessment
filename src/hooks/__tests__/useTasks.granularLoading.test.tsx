import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '../useTasks';
import { taskService } from '../../services/taskService';

// Mock the task service
jest.mock('../../services/taskService');

// Mock the logger to reduce noise
jest.mock('../../utils/logger');

describe('useTasks - Granular Loading States', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Mock taskService methods
    (taskService.loadTasks as jest.Mock).mockResolvedValue([]);
    (taskService.saveTasks as jest.Mock).mockResolvedValue(undefined);
    (taskService.addTask as jest.Mock).mockImplementation(async (text: string) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        id: Date.now(),
        text,
        completed: false,
        createdAt: new Date().toISOString()
      };
    });
    (taskService.updateTask as jest.Mock).mockImplementation(async (id: number, updates: any) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    });
    (taskService.deleteTask as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    (taskService.refreshTasks as jest.Mock).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return [];
    });
  });

  describe('Initial Loading State', () => {
    it('should set loadingInitial true during initial load', async () => {
      const { result } = renderHook(() => useTasks());
      
      expect(result.current.loadingState.loadingInitial).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });
    });
  });

  describe('Add Task Loading State', () => {
    it('should only set addingTask true when adding a task', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Start adding a task
      act(() => {
        result.current.addTask('New task');
      });

      // Should only affect addingTask
      await waitFor(() => {
        expect(result.current.loadingState.addingTask).toBe(true);
        expect(result.current.loadingState.togglingTasks.size).toBe(0);
        expect(result.current.loadingState.deletingTasks.size).toBe(0);
        expect(result.current.loadingState.refreshing).toBe(false);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loadingState.addingTask).toBe(false);
      });
    });
  });

  describe('Toggle Task Loading State', () => {
    it('should only add task ID to togglingTasks when toggling', async () => {
      const existingTask = { id: 1, text: 'Task 1', completed: false };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Start toggling
      act(() => {
        result.current.toggleTask(1);
      });

      // Should only affect the specific task
      await waitFor(() => {
        expect(result.current.loadingState.togglingTasks.has(1)).toBe(true);
        expect(result.current.loadingState.togglingTasks.size).toBe(1);
        expect(result.current.loadingState.addingTask).toBe(false);
        expect(result.current.loadingState.deletingTasks.size).toBe(0);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loadingState.togglingTasks.has(1)).toBe(false);
      });
    });

    it('should handle multiple tasks toggling concurrently', async () => {
      const tasks = [
        { id: 1, text: 'Task 1', completed: false },
        { id: 2, text: 'Task 2', completed: false },
        { id: 3, text: 'Task 3', completed: false }
      ];
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce(tasks);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(3);
      });

      // Toggle multiple tasks
      act(() => {
        result.current.toggleTask(1);
        result.current.toggleTask(2);
        result.current.toggleTask(3);
      });

      // All should be toggling
      await waitFor(() => {
        expect(result.current.loadingState.togglingTasks.has(1)).toBe(true);
        expect(result.current.loadingState.togglingTasks.has(2)).toBe(true);
        expect(result.current.loadingState.togglingTasks.has(3)).toBe(true);
        expect(result.current.loadingState.togglingTasks.size).toBe(3);
      });

      // Wait for all to complete
      await waitFor(() => {
        expect(result.current.loadingState.togglingTasks.size).toBe(0);
      }, { timeout: 5000 });
    });
  });

  describe('Delete Task Loading State', () => {
    it('should only add task ID to deletingTasks when deleting', async () => {
      const existingTask = { id: 1, text: 'Task 1', completed: false };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Start deleting
      act(() => {
        result.current.deleteTask(1);
      });

      // Should only affect the specific task
      await waitFor(() => {
        expect(result.current.loadingState.deletingTasks.has(1)).toBe(true);
        expect(result.current.loadingState.deletingTasks.size).toBe(1);
        expect(result.current.loadingState.addingTask).toBe(false);
        expect(result.current.loadingState.togglingTasks.size).toBe(0);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loadingState.deletingTasks.has(1)).toBe(false);
      });
    });
  });

  describe('Refresh Loading State', () => {
    it('should only set refreshing true when refreshing', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Start refreshing
      act(() => {
        result.current.refreshTasks();
      });

      // Should only affect refreshing
      await waitFor(() => {
        expect(result.current.loadingState.refreshing).toBe(true);
        expect(result.current.loadingState.addingTask).toBe(false);
        expect(result.current.loadingState.togglingTasks.size).toBe(0);
        expect(result.current.loadingState.deletingTasks.size).toBe(0);
      });

      // Wait for completion
      await waitFor(() => {
        expect(result.current.loadingState.refreshing).toBe(false);
      });
    });
  });

  describe('Concurrent Operations', () => {
    it('should allow non-conflicting operations concurrently', async () => {
      const tasks = [
        { id: 1, text: 'Task 1', completed: false },
        { id: 2, text: 'Task 2', completed: false }
      ];
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce(tasks);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(2);
      });

      // Perform multiple different operations
      act(() => {
        result.current.addTask('New task');
        result.current.toggleTask(1);
        result.current.deleteTask(2);
      });

      // All should be loading independently
      await waitFor(() => {
        expect(result.current.loadingState.addingTask).toBe(true);
        expect(result.current.loadingState.togglingTasks.has(1)).toBe(true);
        expect(result.current.loadingState.deletingTasks.has(2)).toBe(true);
      });

      // Wait for all to complete
      await waitFor(() => {
        expect(result.current.loadingState.addingTask).toBe(false);
        expect(result.current.loadingState.togglingTasks.size).toBe(0);
        expect(result.current.loadingState.deletingTasks.size).toBe(0);
      }, { timeout: 5000 });
    });
  });

  describe('Error Handling', () => {
    it('should clear loading state on error', async () => {
      const existingTask = { id: 1, text: 'Task 1', completed: false };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      (taskService.updateTask as jest.Mock).mockRejectedValueOnce(new Error('Update failed'));
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Toggle should fail
      await act(async () => {
        try {
          await result.current.toggleTask(1);
        } catch (e) {
          // Expected to fail
        }
      });

      // Loading state should be cleared
      expect(result.current.loadingState.togglingTasks.has(1)).toBe(false);
    });
  });
});