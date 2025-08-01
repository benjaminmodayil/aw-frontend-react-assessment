import { logger } from './logger';

export interface QueuedOperation<T = void> {
  id: string;
  type: 'add' | 'update' | 'delete' | 'refresh' | 'save';
  taskId?: number;
  execute: () => Promise<T>;
  rollback?: () => void;
  timestamp: number;
  description: string;
}

export interface QueueStatus {
  length: number;
  processing: boolean;
  currentOperation: QueuedOperation<any> | null;
}

/**
 * Operation Queue Manager
 * 
 * Ensures all task operations execute in FIFO order to prevent race conditions.
 * Operations are processed sequentially, preventing concurrent localStorage writes.
 */
export class OperationQueue {
  private queue: QueuedOperation<any>[] = [];
  private processing = false;
  private currentOperation: QueuedOperation<any> | null = null;
  private statusListeners: Set<(status: QueueStatus) => void> = new Set();

  /**
   * Enqueue an operation for sequential execution
   */
  async enqueue<T>(operation: QueuedOperation<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Wrap the original execute function to handle resolution
      const wrappedOperation: QueuedOperation<T> = {
        ...operation,
        execute: async () => {
          try {
            logger.info(`Executing operation: ${operation.description}`, {
              id: operation.id,
              type: operation.type,
              taskId: operation.taskId
            });
            
            const result = await operation.execute();
            resolve(result as T);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        }
      };

      this.queue.push(wrappedOperation);
      logger.info(`Operation queued: ${operation.description}`, {
        id: operation.id,
        queueLength: this.queue.length
      });

      this.notifyStatusListeners();

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued operations sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.notifyStatusListeners();

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!;
      this.currentOperation = operation;
      this.notifyStatusListeners();

      try {
        await operation.execute();
        logger.info(`Operation completed: ${operation.description}`, {
          id: operation.id,
          remainingOperations: this.queue.length
        });
      } catch (error) {
        logger.error(`Operation failed: ${operation.description}`, {
          id: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Execute rollback if available
        if (operation.rollback) {
          try {
            operation.rollback();
            logger.info(`Rollback completed for operation: ${operation.description}`, {
              id: operation.id
            });
          } catch (rollbackError) {
            logger.error(`Rollback failed for operation: ${operation.description}`, {
              id: operation.id,
              error: rollbackError instanceof Error ? rollbackError.message : 'Unknown error'
            });
          }
        }
      }

      this.currentOperation = null;
      this.notifyStatusListeners();
    }

    this.processing = false;
    this.notifyStatusListeners();
  }

  /**
   * Cancel a pending operation
   * Note: Cannot cancel currently executing operation
   */
  cancelOperation(operationId: string): boolean {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(op => op.id !== operationId);
    const removed = this.queue.length < initialLength;

    if (removed) {
      logger.info(`Operation cancelled`, { operationId });
      this.notifyStatusListeners();
    }

    return removed;
  }

  /**
   * Cancel all operations for a specific task
   */
  cancelTaskOperations(taskId: number): number {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(op => op.taskId !== taskId);
    const removedCount = initialLength - this.queue.length;

    if (removedCount > 0) {
      logger.info(`Cancelled ${removedCount} operations for task`, { taskId });
      this.notifyStatusListeners();
    }

    return removedCount;
  }

  /**
   * Get current queue status
   */
  getStatus(): QueueStatus {
    return {
      length: this.queue.length,
      processing: this.processing,
      currentOperation: this.currentOperation
    };
  }

  /**
   * Subscribe to queue status changes
   */
  subscribeToStatus(listener: (status: QueueStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately notify with current status
    listener(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Notify all status listeners
   */
  private notifyStatusListeners(): void {
    const status = this.getStatus();
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        logger.error('Status listener error', { error });
      }
    });
  }

  /**
   * Clear all pending operations (for testing/reset)
   */
  clear(): void {
    this.queue = [];
    this.notifyStatusListeners();
    logger.info('Operation queue cleared');
  }

  /**
   * Wait for all operations to complete (useful for tests)
   */
  async waitForCompletion(): Promise<void> {
    while (this.processing || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}

// Singleton instance
export const operationQueue = new OperationQueue();