import { Task } from '../types';

/**
 * Utility functions for safe and consistent state updates.
 * All functions return state updater functions for use with React's setState.
 */

/**
 * Updates a task by ID using a custom updater function.
 * If the updater returns null, the task is removed from the list.
 * 
 * @param taskId - The ID of the task to update
 * @param updater - Function that takes a task and returns the updated task or null
 * @returns State updater function for use with setTasks
 */
export const updateTaskById = (
  taskId: number,
  updater: (task: Task) => Task | null
) => {
  return (prevTasks: Task[]): Task[] => {
    return prevTasks
      .map(task => {
        if (task.id === taskId) {
          const updated = updater(task);
          return updated;
        }
        return task;
      })
      .filter((task): task is Task => task !== null);
  };
};

/**
 * Adds a task safely with deduplication check.
 * Prevents adding tasks with duplicate IDs.
 * 
 * @param newTask - The task to add
 * @returns State updater function for use with setTasks
 */
export const addTaskSafely = (newTask: Task) => {
  return (prevTasks: Task[]): Task[] => {
    // Check if task already exists (by ID)
    if (prevTasks.some(t => t.id === newTask.id)) {
      console.warn(`Task ${newTask.id} already exists, skipping add`);
      return prevTasks;
    }
    return [...prevTasks, newTask];
  };
};

/**
 * Merges refreshed tasks with current tasks, preserving in-flight changes.
 * Uses task ID as the key for merging.
 * 
 * @param refreshedTasks - The tasks from the refresh operation
 * @returns State updater function for use with setTasks
 */
export const mergeTasksWithCurrent = (refreshedTasks: Task[]) => {
  return (prevTasks: Task[]): Task[] => {
    // Create a map of refreshed tasks for efficient lookup
    const refreshedMap = new Map(refreshedTasks.map(t => [t.id, t]));
    
    // Keep tasks that exist in both lists (prefer current version for in-flight changes)
    const mergedTasks = prevTasks.map(task => {
      const refreshedTask = refreshedMap.get(task.id);
      if (refreshedTask) {
        // Task exists in both - check if local version is newer
        const localTime = new Date(task.updatedAt || 0).getTime();
        const refreshedTime = new Date(refreshedTask.updatedAt || 0).getTime();
        
        // If local is newer, keep it (likely an in-flight change)
        if (localTime > refreshedTime) {
          console.info(`Preserving local version of task ${task.id} (newer)`);
          return task;
        }
        return refreshedTask;
      }
      // Task only exists locally - might be newly added
      console.info(`Preserving locally added task ${task.id}`);
      return task;
    });
    
    // Add tasks that only exist in refreshed list (new from server)
    const localIds = new Set(prevTasks.map(t => t.id));
    const newTasks = refreshedTasks.filter(t => !localIds.has(t.id));
    
    if (newTasks.length > 0) {
      console.info(`Adding ${newTasks.length} new tasks from refresh`);
    }
    
    return [...mergedTasks, ...newTasks];
  };
};

/**
 * Removes a task by ID.
 * 
 * @param taskId - The ID of the task to remove
 * @returns State updater function for use with setTasks
 */
export const removeTaskById = (taskId: number) => {
  return (prevTasks: Task[]): Task[] => {
    return prevTasks.filter(task => task.id !== taskId);
  };
};

/**
 * Batch updates multiple tasks at once.
 * Useful for applying multiple changes in a single state update.
 * 
 * @param updates - Map of task ID to update function
 * @returns State updater function for use with setTasks
 */
export const batchUpdateTasks = (
  updates: Map<number, (task: Task) => Task | null>
) => {
  return (prevTasks: Task[]): Task[] => {
    return prevTasks
      .map(task => {
        const updater = updates.get(task.id);
        if (updater) {
          return updater(task);
        }
        return task;
      })
      .filter((task): task is Task => task !== null);
  };
};