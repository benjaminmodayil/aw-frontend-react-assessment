import { useState, useEffect, useCallback, useRef } from 'react';
import { taskService } from '../services/taskService';
import { Task, TaskContextType } from '../types';
import {
  updateTaskById,
  addTaskSafely,
  mergeTasksWithCurrent,
  removeTaskById
} from '../utils/stateUpdateHelpers';
import { operationQueue, QueuedOperation } from '../utils/operationQueue';

export const useTasks = (): TaskContextType => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
          await taskService.saveTasks(tasksRef.current);
        }
      };
      
      operationQueue.enqueue(operation);
    }
  }, [tasks, isInitialLoad]);

  const loadTasks = useCallback(async () => {
    try {
      // TODO: Make loading state operation-specific (Task 006)
      setIsLoading(true);
      setError(null);
      const loadedTasks = await taskService.loadTasks();
      
      // Use functional update to ensure we don't lose any state
      setTasks(() => loadedTasks);
      setIsInitialLoad(false);
    } catch (err) {
      setError('Failed to load tasks');
      console.error('Error loading tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTask = useCallback(async (taskText: string) => {
    const operationId = `add-${Date.now()}-${operationIdCounter.current++}`;
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'add',
      timestamp: Date.now(),
      description: `Add task: ${taskText}`,
      execute: async () => {
        try {
          // TODO: Make loading state operation-specific (Task 006)
          setIsLoading(true);
          setError(null);
          
          const newTask = await taskService.addTask(taskText);
          
          // Use utility for safe task addition with deduplication
          setTasks(addTaskSafely(newTask));
        } catch (err) {
          setError('Failed to add task');
          console.error('Error adding task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setIsLoading(false);
        }
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  const toggleTask = useCallback(async (taskId: number) => {
    const operationId = `toggle-${taskId}-${Date.now()}-${operationIdCounter.current++}`;
    let originalTask: Task | undefined;
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'update',
      taskId,
      timestamp: Date.now(),
      description: `Toggle task ${taskId}`,
      execute: async () => {
        try {
          // TODO: Make loading state operation-specific (Task 006)
          setIsLoading(true);
          setError(null);
          
          // Get current task state safely
          const currentTask = await new Promise<Task | undefined>((resolve) => {
            setTasks(prevTasks => {
              const task = prevTasks.find(t => t.id === taskId);
              originalTask = task ? { ...task } : undefined; // Deep copy for rollback
              resolve(task);
              return prevTasks; // No change yet
            });
          });

          if (!currentTask) {
            throw new Error(`Task ${taskId} not found`);
          }

          const updates = await taskService.updateTask(taskId, {
            ...currentTask,
            completed: !currentTask.completed
          });

          // Use utility for safe task update
          setTasks(updateTaskById(taskId, task => ({ ...task, ...updates })));
        } catch (err) {
          setError('Failed to update task');
          console.error('Error updating task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setIsLoading(false);
        }
      },
      rollback: () => {
        // Rollback on error if we had an original task
        if (originalTask) {
          setTasks(updateTaskById(taskId, () => originalTask as Task));
        }
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  const deleteTask = useCallback(async (taskId: number) => {
    const operationId = `delete-${taskId}-${Date.now()}-${operationIdCounter.current++}`;
    let deletedTask: Task | undefined;
    
    // Cancel any pending operations for this task
    operationQueue.cancelTaskOperations(taskId);
    
    const operation: QueuedOperation<void> = {
      id: operationId,
      type: 'delete',
      taskId,
      timestamp: Date.now(),
      description: `Delete task ${taskId}`,
      execute: async () => {
        try {
          // TODO: Make loading state operation-specific (Task 006)
          setIsLoading(true);
          setError(null);
          
          // Optimistically remove the task
          setTasks(prevTasks => {
            deletedTask = prevTasks.find(t => t.id === taskId);
            return prevTasks.filter(task => task.id !== taskId);
          });
          
          // Perform the actual delete
          await taskService.deleteTask(taskId);
          
          // Success - task is already removed
        } catch (err) {
          setError('Failed to delete task');
          console.error('Error deleting task:', err);
          throw err; // Re-throw to trigger rollback
        } finally {
          setIsLoading(false);
        }
      },
      rollback: () => {
        // Rollback - restore the deleted task
        if (deletedTask) {
          setTasks(addTaskSafely(deletedTask));
        }
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
          // TODO: Make loading state operation-specific (Task 006)
          setIsLoading(true);
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
          setIsLoading(false);
        }
      }
    };

    return operationQueue.enqueue(operation);
  }, []);

  return {
    tasks,
    isLoading,
    error,
    addTask,
    toggleTask,
    deleteTask,
    refreshTasks,
    loadTasks
  };
};