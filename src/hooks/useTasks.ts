import { useState, useEffect, useCallback, useRef } from 'react';
import { taskService } from '../services/taskService';
import { Task, TaskContextType, LoadingState } from '../types';
import {
  updateTaskById,
  addTaskSafely,
  mergeTasksWithCurrent,
  removeTaskById
} from '../utils/stateUpdateHelpers';
import { operationQueue, QueuedOperation } from '../utils/operationQueue';
import { idGenerator } from '../utils/idGenerator';

export const useTasks = (): TaskContextType => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    addingTask: false,
    togglingTasks: new Set(),
    deletingTasks: new Set(),
    refreshing: false,
    loadingInitial: true
  });
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const tasksRef = useRef<Task[]>(tasks);
  const operationIdCounter = useRef(0);

  // Keep tasksRef in sync
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Save tasks to localStorage whenever they change (but not on initial load)
  useEffect(() => {
    if (!isInitialLoad && tasks.length >= 0) {
      const operation: QueuedOperation = {
        id: `save-${Date.now()}-${operationIdCounter.current++}`,
        type: 'save',
        timestamp: Date.now(),
        description: 'Auto-save tasks to localStorage',
        execute: async () => {
          // Only save non-optimistic tasks
          const nonOptimisticTasks = tasksRef.current.filter(t => !t.optimistic);
          await taskService.saveTasks(nonOptimisticTasks);
        }
      };
      
      operationQueue.enqueue(operation);
    }
  }, [tasks, isInitialLoad]);

  const loadTasks = useCallback(async () => {
    try {
      setLoadingState(prev => ({ ...prev, loadingInitial: true }));
      setError(null);
      const loadedTasks = await taskService.loadTasks();
      
      // Use functional update to ensure we don't lose any state
      setTasks(() => loadedTasks);
      setIsInitialLoad(false);
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setLoadingState(prev => ({ ...prev, loadingInitial: false }));
    }
  }, []);

  const addTask = useCallback(async (taskText: string) => {
    const operationId = `add-${Date.now()}-${operationIdCounter.current++}`;
    let optimisticTaskId: number | undefined;
    
    // Create optimistic task immediately
    const optimisticTask: Task = {
      id: idGenerator.generateId(), // Use proper ID generator
      text: taskText,
      completed: false,
      optimistic: true,
      createdAt: new Date().toISOString()
    };
    
    // Add task optimistically
    setTasks(addTaskSafely(optimisticTask));
    optimisticTaskId = optimisticTask.id;
    
    // Set loading state immediately (even with optimistic update)
    setLoadingState(prev => ({ ...prev, addingTask: true }));
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'add',
      timestamp: Date.now(),
      description: `Add task: ${taskText}`,
      execute: async () => {
        try {
          setError(null);
          
          const newTask = await taskService.addTask(taskText);
          
          // Replace optimistic task with real task
          setTasks(prevTasks => {
            // Remove optimistic task and add real task
            const filtered = prevTasks.filter(t => t.id !== optimisticTaskId);
            return addTaskSafely(newTask)(filtered);
          });
        } catch (err) {
          setError('Failed to add task');
          console.error('Error adding task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setLoadingState(prev => ({ ...prev, addingTask: false }));
        }
      },
      rollback: () => {
        // Remove optimistic task on failure
        if (optimisticTaskId !== undefined) {
          setTasks(removeTaskById(optimisticTaskId));
        }
        setError('Failed to add task. Please try again.');
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  const toggleTask = useCallback(async (taskId: number) => {
    const operationId = `toggle-${taskId}-${Date.now()}-${operationIdCounter.current++}`;
    let originalTask: Task | undefined;
    
    // Store original task before applying optimistic update
    const currentTasks = tasksRef.current;
    originalTask = currentTasks.find(t => t.id === taskId);
    
    if (!originalTask) {
      setError(`Task ${taskId} not found`);
      return Promise.reject(new Error(`Task ${taskId} not found`));
    }
    
    // Apply optimistic update immediately
    setTasks(updateTaskById(taskId, t => ({ 
      ...t, 
      completed: !t.completed,
      optimistic: true 
    })));
    
    // Set loading state immediately
    setLoadingState(prev => ({
      ...prev,
      togglingTasks: new Set(prev.togglingTasks).add(taskId)
    }));
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'update',
      taskId,
      timestamp: Date.now(),
      description: `Toggle task ${taskId}`,
      execute: async () => {
        try {
          setError(null);

          const updates = await taskService.updateTask(taskId, {
            ...originalTask!,
            completed: !originalTask!.completed
          });

          // Confirm optimistic update
          setTasks(updateTaskById(taskId, task => ({ 
            ...task, 
            ...updates,
            optimistic: false 
          })));
          
          // Save to localStorage after successful update
          await taskService.saveTasks(tasksRef.current);
        } catch (err) {
          setError('Failed to update task');
          console.error('Error updating task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setLoadingState(prev => {
            const newTogglingTasks = new Set(prev.togglingTasks);
            newTogglingTasks.delete(taskId);
            return { ...prev, togglingTasks: newTogglingTasks };
          });
        }
      },
      rollback: () => {
        // Rollback on error if we had an original task
        if (originalTask) {
          setTasks(updateTaskById(taskId, () => ({ ...originalTask } as Task)));
        }
        setError('Failed to update task. Please try again.');
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  const deleteTask = useCallback(async (taskId: number) => {
    const operationId = `delete-${taskId}-${Date.now()}-${operationIdCounter.current++}`;
    let deletedTask: Task | undefined;
    
    // Check if this is an optimistic task that hasn't been saved yet
    const currentTask = tasksRef.current.find(t => t.id === taskId);
    if (currentTask?.optimistic) {
      // Cancel the add operation for this optimistic task
      operationQueue.cancelOperation(`add-${taskId}`);
      // Just remove it immediately
      setTasks(removeTaskById(taskId));
      return Promise.resolve();
    }
    
    // Cancel any pending operations for this task
    operationQueue.cancelTaskOperations(taskId);
    
    // Store the task before deletion for potential rollback
    deletedTask = tasksRef.current.find(t => t.id === taskId);
    
    if (!deletedTask) {
      setError(`Task ${taskId} not found`);
      return Promise.reject(new Error(`Task ${taskId} not found`));
    }
    
    // Optimistically remove the task
    setTasks(removeTaskById(taskId));
    
    // Set loading state immediately
    setLoadingState(prev => ({
      ...prev,
      deletingTasks: new Set(prev.deletingTasks).add(taskId)
    }));
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'delete',
      taskId,
      timestamp: Date.now(),
      description: `Delete task ${taskId}`,
      execute: async () => {
        try {
          setError(null);
          
          // deletedTask might be undefined if it was removed optimistically
          // In that case, the operation has already succeeded
          
          // Perform the actual delete
          await taskService.deleteTask(taskId);
          
          // Success - task is already removed, save to localStorage
          await taskService.saveTasks(tasksRef.current);
        } catch (err) {
          setError('Failed to delete task');
          console.error('Error deleting task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setLoadingState(prev => {
            const newDeletingTasks = new Set(prev.deletingTasks);
            newDeletingTasks.delete(taskId);
            return { ...prev, deletingTasks: newDeletingTasks };
          });
        }
      },
      rollback: () => {
        // Rollback - restore the deleted task
        if (deletedTask) {
          setTasks(addTaskSafely(deletedTask));
        }
        setError('Failed to delete task. Please try again.');
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  const refreshTasks = useCallback(async () => {
    const operationId = `refresh-${Date.now()}-${operationIdCounter.current++}`;
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'refresh',
      timestamp: Date.now(),
      description: 'Refresh tasks from storage',
      execute: async () => {
        try {
          setLoadingState(prev => ({ ...prev, refreshing: true }));
          setError(null);
          const refreshedTasks = await taskService.refreshTasks();
          
          // Use merge utility to preserve in-flight changes
          setTasks(mergeTasksWithCurrent(refreshedTasks));
        } catch (err) {
          // On refresh error, we keep the current state
          setError('Failed to refresh tasks');
          console.error('Error refreshing tasks:', err);
          // Don't re-throw - refresh errors shouldn't trigger rollback
        } finally {
          setLoadingState(prev => ({ ...prev, refreshing: false }));
        }
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  return {
    tasks,
    loadingState,
    error,
    addTask,
    toggleTask,
    deleteTask,
    refreshTasks,
    loadTasks
  };
};