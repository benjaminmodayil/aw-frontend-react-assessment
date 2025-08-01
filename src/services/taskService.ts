import { storageService } from '../utils/storage';
import { delayPatterns } from '../utils/delay';
import { logger } from '../utils/logger';
import { validateTaskText, sanitizeTaskText } from '../utils/validation';
import { idGenerator } from '../utils/idGenerator';
import { Task } from '../types';
import { STORAGE_KEYS } from '../constants';

const STORAGE_KEY = STORAGE_KEYS.TASKS;

// Default tasks for initial app state
const getDefaultTasks = (): Task[] => [
  { id: 1, text: 'Review marketing campaign proposal', completed: false },
  { id: 2, text: 'Schedule team meeting for next week', completed: false },
  { id: 3, text: 'Update project timeline document', completed: true },
  { id: 4, text: 'Send follow-up email to client', completed: false },
  { id: 5, text: 'Prepare presentation slides', completed: false }
];

export const taskService = {
  // Load tasks from storage
  async loadTasks(): Promise<Task[]> {
    await delayPatterns.short();
    
    let tasks = storageService.load(STORAGE_KEY);
    
    if (!tasks) {
      // Check for legacy tasks without timezone key
      tasks = storageService.loadLegacy(STORAGE_KEY);
      
      if (!tasks) {
        tasks = getDefaultTasks();
        storageService.save(STORAGE_KEY, tasks);
      }
    }
    
    return tasks;
  },

  // Save tasks to storage
  async saveTasks(tasks: Task[]): Promise<boolean> {
    await delayPatterns.short();
    return storageService.save(STORAGE_KEY, tasks);
  },

  // Add a new task
  async addTask(taskText: string): Promise<Task> {
    const validation = validateTaskText(taskText);
    if (!validation.isValid) {
      logger.warn('Task validation failed', { taskText, error: validation.error });
      throw new Error(validation.error);
    }

    await delayPatterns.medium();
    
    const sanitizedText = sanitizeTaskText(taskText);
    const newTask = {
      id: idGenerator.generateId(),
      text: sanitizedText,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    logger.info('Task created', { taskId: newTask.id, text: sanitizedText });
    return newTask;
  },

  // Update an existing task
  async updateTask(_taskId: number, updates: Partial<Task>): Promise<Partial<Task> & { updatedAt: string }> {
    await delayPatterns.medium();
    
    return {
      ...updates,
      updatedAt: new Date().toISOString()
    };
  },

  // Delete a task
  async deleteTask(taskId: number): Promise<number> {
    await delayPatterns.short();
    return taskId;
  },

  // Refresh tasks from storage
  async refreshTasks(): Promise<Task[]> {
    await delayPatterns.short();
    return storageService.load(STORAGE_KEY) || [];
  }
};