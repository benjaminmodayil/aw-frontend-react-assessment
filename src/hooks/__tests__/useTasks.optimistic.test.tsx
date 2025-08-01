import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '../useTasks';
import { taskService } from '../../services/taskService';

// Mock the task service
jest.mock('../../services/taskService');

// Mock the logger to reduce noise
jest.mock('../../utils/logger');

describe('useTasks - Optimistic Updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Mock taskService methods
    (taskService.loadTasks as jest.Mock).mockResolvedValue([]);
    (taskService.saveTasks as jest.Mock).mockResolvedValue(undefined);
    (taskService.addTask as jest.Mock).mockImplementation(async (text: string) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        id: Date.now() + 1000, // Different from optimistic ID
        text,
        completed: false,
        createdAt: new Date().toISOString()
      };
    });
    (taskService.updateTask as jest.Mock).mockImplementation(async (id: number, updates: any) => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        id,
        ...updates,
        updatedAt: new Date().toISOString()
      };
    });
    (taskService.deleteTask as jest.Mock).mockImplementation(async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Add Task - Optimistic Updates', () => {
    it('should show task immediately with optimistic flag', async () => {
      const { result } = renderHook(() => useTasks());
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Add task
      act(() => {
        result.current.addTask('New optimistic task');
      });

      // Task should appear immediately with optimistic flag
      await waitFor(() => {
        const optimisticTask = result.current.tasks.find(t => t.text === 'New optimistic task');
        expect(optimisticTask).toBeDefined();
        expect(optimisticTask?.optimistic).toBe(true);
      });
    });

    it('should replace optimistic task with real task after success', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      let optimisticTaskId: number;

      // Add task
      act(() => {
        result.current.addTask('New task');
      });

      // Task should appear immediately as optimistic
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.text === 'New task');
        expect(task).toBeDefined();
        expect(task?.optimistic).toBe(true);
        optimisticTaskId = task!.id;
      });

      // Wait for operation to complete
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.text === 'New task');
        expect(task).toBeDefined();
        expect(task?.optimistic).toBeFalsy();
        // Should have a different ID after server response
        expect(task?.id).not.toBe(optimisticTaskId);
      });
    });

    it('should rollback optimistic task on failure', async () => {
      // Mock failure
      (taskService.addTask as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Add task
      await act(async () => {
        try {
          await result.current.addTask('Failed task');
        } catch (e) {
          // Expected to fail
        }
      });

      // Wait for rollback
      await waitFor(() => {
        // Task should be removed
        const task = result.current.tasks.find(t => t.text === 'Failed task');
        expect(task).toBeUndefined();
        // Error should be shown
        expect(result.current.error).toBe('Failed to add task. Please try again.');
      });
    });
  });

  describe('Toggle Task - Optimistic Updates', () => {
    it('should toggle task immediately with optimistic flag', async () => {
      // Start with an existing task
      const existingTask = {
        id: 1,
        text: 'Existing task',
        completed: false
      };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.tasks[0].completed).toBe(false);
      });

      // Toggle task
      act(() => {
        result.current.toggleTask(1);
      });

      // Task should be toggled immediately
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.id === 1);
        expect(task?.completed).toBe(true);
        expect(task?.optimistic).toBe(true);
      });
    });

    it('should confirm toggle after success', async () => {
      const existingTask = {
        id: 1,
        text: 'Existing task',
        completed: false
      };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Toggle task
      await act(async () => {
        await result.current.toggleTask(1);
      });

      // Optimistic flag should be removed after success
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.id === 1);
        expect(task?.completed).toBe(true);
        expect(task?.optimistic).toBeFalsy();
      });
    });

    it('should rollback toggle on failure', async () => {
      const existingTask = {
        id: 1,
        text: 'Existing task',
        completed: false
      };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      (taskService.updateTask as jest.Mock).mockRejectedValueOnce(new Error('Update failed'));
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Toggle task
      await act(async () => {
        try {
          await result.current.toggleTask(1);
        } catch (e) {
          // Expected to fail
        }
      });

      // Should rollback to original state
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.id === 1);
        expect(task?.completed).toBe(false);
        expect(task?.optimistic).toBeUndefined();
        expect(result.current.error).toBe('Failed to update task. Please try again.');
      });
    });
  });

  describe('Delete Task - Optimistic Updates', () => {
    it('should remove task immediately', async () => {
      const existingTask = {
        id: 1,
        text: 'Task to delete',
        completed: false
      };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Delete task
      act(() => {
        result.current.deleteTask(1);
      });

      // Task should be removed immediately
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.id === 1);
        expect(task).toBeUndefined();
      });
    });

    it('should restore task on delete failure', async () => {
      const existingTask = {
        id: 1,
        text: 'Task to delete',
        completed: false
      };
      (taskService.loadTasks as jest.Mock).mockResolvedValueOnce([existingTask]);
      (taskService.deleteTask as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));
      
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.tasks).toHaveLength(1);
      });

      // Delete task
      await act(async () => {
        try {
          await result.current.deleteTask(1);
        } catch (e) {
          // Expected to fail
        }
      });

      // Task should be restored
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.id === 1);
        expect(task).toBeDefined();
        expect(result.current.error).toBe('Failed to delete task. Please try again.');
      });
    });

    it('should handle deleting optimistic tasks', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      let optimisticTaskId: number;

      // Add an optimistic task
      act(() => {
        result.current.addTask('Optimistic task to delete');
      });

      // Should see optimistic task
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.text === 'Optimistic task to delete');
        expect(task).toBeDefined();
        expect(task?.optimistic).toBe(true);
        optimisticTaskId = task!.id;
      });

      // Delete the optimistic task
      await act(async () => {
        await result.current.deleteTask(optimisticTaskId);
      });

      // Task should be removed immediately without any server call
      expect(result.current.tasks.find(t => t.id === optimisticTaskId)).toBeUndefined();
      expect(taskService.deleteTask).not.toHaveBeenCalledWith(optimisticTaskId);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple concurrent optimistic operations', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Add multiple tasks concurrently
      act(() => {
        result.current.addTask('Task 1');
        result.current.addTask('Task 2');
        result.current.addTask('Task 3');
      });

      // All should appear as optimistic
      await waitFor(() => {
        const task1 = result.current.tasks.find(t => t.text === 'Task 1');
        const task2 = result.current.tasks.find(t => t.text === 'Task 2');
        const task3 = result.current.tasks.find(t => t.text === 'Task 3');
        
        expect(task1?.optimistic).toBe(true);
        expect(task2?.optimistic).toBe(true);
        expect(task3?.optimistic).toBe(true);
      });

      // Wait for all to complete
      await waitFor(() => {
        const allNonOptimistic = result.current.tasks.every(t => !t.optimistic);
        expect(allNonOptimistic).toBe(true);
      }, { timeout: 5000 });

      // All tasks should still be present
      expect(result.current.tasks.find(t => t.text === 'Task 1')).toBeDefined();
      expect(result.current.tasks.find(t => t.text === 'Task 2')).toBeDefined();
      expect(result.current.tasks.find(t => t.text === 'Task 3')).toBeDefined();
    });

    it('should not save optimistic tasks to localStorage', async () => {
      const { result } = renderHook(() => useTasks());
      
      await waitFor(() => {
        expect(result.current.loadingState.loadingInitial).toBe(false);
      });

      // Add an optimistic task
      act(() => {
        result.current.addTask('Optimistic task');
      });

      // Should see optimistic task
      await waitFor(() => {
        const task = result.current.tasks.find(t => t.text === 'Optimistic task');
        expect(task).toBeDefined();
        expect(task?.optimistic).toBe(true);
      });

      // Wait a bit for any save operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Check that saveTasks was called but optimistic tasks were filtered out
      const saveCallsWithOptimistic = (taskService.saveTasks as jest.Mock).mock.calls
        .filter(call => call[0].some((task: any) => task.optimistic));
      
      expect(saveCallsWithOptimistic).toHaveLength(0);
    });
  });
});