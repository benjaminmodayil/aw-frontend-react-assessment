import {
  updateTaskById,
  addTaskSafely,
  mergeTasksWithCurrent,
  removeTaskById,
  batchUpdateTasks
} from '../stateUpdateHelpers';
import { Task } from '../../types';

describe('State Update Helpers', () => {
  const createTask = (id: number, text: string, completed = false): Task => ({
    id,
    text,
    completed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  describe('updateTaskById', () => {
    it('should update a task by ID', () => {
      const tasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2'),
        createTask(3, 'Task 3')
      ];

      const updater = updateTaskById(2, task => ({ ...task, completed: true }));
      const result = updater(tasks);

      expect(result).toHaveLength(3);
      expect(result[1].completed).toBe(true);
      expect(result[0].completed).toBe(false);
      expect(result[2].completed).toBe(false);
    });

    it('should remove task if updater returns null', () => {
      const tasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2'),
        createTask(3, 'Task 3')
      ];

      const updater = updateTaskById(2, () => null);
      const result = updater(tasks);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === 2)).toBeUndefined();
    });

    it('should handle non-existent task ID', () => {
      const tasks = [createTask(1, 'Task 1')];
      const updater = updateTaskById(999, task => ({ ...task, completed: true }));
      const result = updater(tasks);

      expect(result).toEqual(tasks);
    });
  });

  describe('addTaskSafely', () => {
    it('should add a new task', () => {
      const tasks = [createTask(1, 'Task 1')];
      const newTask = createTask(2, 'Task 2');

      const updater = addTaskSafely(newTask);
      const result = updater(tasks);

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual(newTask);
    });

    it('should prevent duplicate task IDs', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const tasks = [createTask(1, 'Task 1')];
      const duplicateTask = createTask(1, 'Duplicate Task');

      const updater = addTaskSafely(duplicateTask);
      const result = updater(tasks);

      expect(result).toHaveLength(1);
      expect(result[0].text).toBe('Task 1');
      expect(consoleSpy).toHaveBeenCalledWith('Task 1 already exists, skipping add');

      consoleSpy.mockRestore();
    });
  });

  describe('mergeTasksWithCurrent', () => {
    it('should merge refreshed tasks with current tasks', () => {
      const currentTasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2')
      ];
      const refreshedTasks = [
        createTask(1, 'Task 1 Updated'),
        createTask(3, 'Task 3')
      ];

      const updater = mergeTasksWithCurrent(refreshedTasks);
      const result = updater(currentTasks);

      expect(result).toHaveLength(3);
      expect(result.find(t => t.id === 1)?.text).toBe('Task 1 Updated');
      expect(result.find(t => t.id === 2)?.text).toBe('Task 2');
      expect(result.find(t => t.id === 3)?.text).toBe('Task 3');
    });

    it('should preserve local changes when they are newer', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const now = new Date();
      const earlier = new Date(now.getTime() - 1000);
      
      const currentTasks = [{
        id: 1,
        text: 'Local Version',
        completed: true,
        updatedAt: now.toISOString()
      }];
      
      const refreshedTasks = [{
        id: 1,
        text: 'Server Version',
        completed: false,
        updatedAt: earlier.toISOString()
      }];

      const updater = mergeTasksWithCurrent(refreshedTasks);
      const result = updater(currentTasks);

      expect(result[0].text).toBe('Local Version');
      expect(result[0].completed).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith('Preserving local version of task 1 (newer)');

      consoleSpy.mockRestore();
    });

    it('should preserve locally added tasks', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const currentTasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Local Task')
      ];
      const refreshedTasks = [
        createTask(1, 'Task 1')
      ];

      const updater = mergeTasksWithCurrent(refreshedTasks);
      const result = updater(currentTasks);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === 2)).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith('Preserving locally added task 2');

      consoleSpy.mockRestore();
    });
  });

  describe('removeTaskById', () => {
    it('should remove a task by ID', () => {
      const tasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2'),
        createTask(3, 'Task 3')
      ];

      const updater = removeTaskById(2);
      const result = updater(tasks);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === 2)).toBeUndefined();
    });

    it('should handle non-existent task ID', () => {
      const tasks = [createTask(1, 'Task 1')];
      const updater = removeTaskById(999);
      const result = updater(tasks);

      expect(result).toEqual(tasks);
    });
  });

  describe('batchUpdateTasks', () => {
    it('should update multiple tasks at once', () => {
      const tasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2'),
        createTask(3, 'Task 3')
      ];

      const updates = new Map<number, (task: Task) => Task | null>([
        [1, task => ({ ...task, completed: true })],
        [3, task => ({ ...task, text: 'Task 3 Updated' })]
      ]);

      const updater = batchUpdateTasks(updates);
      const result = updater(tasks);

      expect(result).toHaveLength(3);
      expect(result[0].completed).toBe(true);
      expect(result[2].text).toBe('Task 3 Updated');
      expect(result[1]).toEqual(tasks[1]); // Unchanged
    });

    it('should remove tasks that return null', () => {
      const tasks = [
        createTask(1, 'Task 1'),
        createTask(2, 'Task 2'),
        createTask(3, 'Task 3')
      ];

      const updates = new Map<number, (task: Task) => Task | null>([
        [1, task => ({ ...task, completed: true })],
        [2, () => null] // Remove task 2
      ]);

      const updater = batchUpdateTasks(updates);
      const result = updater(tasks);

      expect(result).toHaveLength(2);
      expect(result.find(t => t.id === 2)).toBeUndefined();
    });
  });
});