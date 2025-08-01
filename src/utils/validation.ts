import { APP_CONFIG, ERROR_MESSAGES } from '../constants';
import { sanitizeTaskText as sanitize } from './sanitizer';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateTaskText = (text: string): ValidationResult => {
  const trimmedText = text.trim();
  
  if (!trimmedText) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.TASK_EMPTY
    };
  }
  
  if (trimmedText.length > APP_CONFIG.MAX_TASK_LENGTH) {
    return {
      isValid: false,
      error: ERROR_MESSAGES.TASK_TOO_LONG
    };
  }
  
  return { isValid: true };
};

export const sanitizeTaskText = (text: string): string => {
  // Use the secure sanitizer that prevents XSS
  return sanitize(text);
};

export const isValidId = (id: any): id is number => {
  return typeof id === 'number' && !isNaN(id) && id > 0;
};