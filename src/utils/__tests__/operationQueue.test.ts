import { OperationQueue, QueuedOperation, QueueStatus } from '../operationQueue';

describe('OperationQueue', () => {
  let queue: OperationQueue;

  beforeEach(() => {
    queue = new OperationQueue();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queue.clear();
  });

  describe('Basic functionality', () => {
    it('should execute operations in FIFO order', async () => {
      const executionOrder: string[] = [];
      
      const operation1: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Operation 1',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          executionOrder.push('op1');
        }
      };

      const operation2: QueuedOperation = {
        id: 'op2',
        type: 'update',
        timestamp: Date.now(),
        description: 'Operation 2',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          executionOrder.push('op2');
        }
      };

      const operation3: QueuedOperation = {
        id: 'op3',
        type: 'delete',
        timestamp: Date.now(),
        description: 'Operation 3',
        execute: async () => {
          executionOrder.push('op3');
        }
      };

      // Enqueue all operations
      await Promise.all([
        queue.enqueue(operation1),
        queue.enqueue(operation2),
        queue.enqueue(operation3)
      ]);

      // Verify execution order is FIFO despite different delays
      expect(executionOrder).toEqual(['op1', 'op2', 'op3']);
    });

    it('should handle operation errors without blocking queue', async () => {
      const executionOrder: string[] = [];
      const rollbackCalled = jest.fn();

      const operation1: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Operation 1 (will fail)',
        execute: async () => {
          throw new Error('Operation 1 failed');
        },
        rollback: rollbackCalled
      };

      const operation2: QueuedOperation = {
        id: 'op2',
        type: 'update',
        timestamp: Date.now(),
        description: 'Operation 2',
        execute: async () => {
          executionOrder.push('op2');
        }
      };

      // Enqueue operations
      const promise1 = queue.enqueue(operation1);
      const promise2 = queue.enqueue(operation2);

      // First operation should reject
      await expect(promise1).rejects.toThrow('Operation 1 failed');
      
      // Second operation should still execute
      await expect(promise2).resolves.toBeUndefined();
      
      expect(executionOrder).toEqual(['op2']);
      expect(rollbackCalled).toHaveBeenCalledTimes(1);
    });

    it('should return values from operations', async () => {
      const operation: QueuedOperation<number> = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Return value operation',
        execute: async () => {
          return 42;
        }
      };

      const result = await queue.enqueue(operation);
      expect(result).toBe(42);
    });
  });

  describe('Operation cancellation', () => {
    it('should cancel pending operations', async () => {
      const executionOrder: string[] = [];
      let resolveOp1: () => void;

      const operation1: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Operation 1',
        execute: async () => {
          await new Promise<void>(resolve => {
            resolveOp1 = resolve;
          });
          executionOrder.push('op1');
        }
      };

      const operation2: QueuedOperation = {
        id: 'op2',
        type: 'update',
        timestamp: Date.now(),
        description: 'Operation 2',
        execute: async () => {
          executionOrder.push('op2');
        }
      };

      const operation3: QueuedOperation = {
        id: 'op3',
        type: 'delete',
        timestamp: Date.now(),
        description: 'Operation 3',
        execute: async () => {
          executionOrder.push('op3');
        }
      };

      // Enqueue operations
      queue.enqueue(operation1);
      queue.enqueue(operation2);
      queue.enqueue(operation3);

      // Cancel operation 2 while operation 1 is still running
      const cancelled = queue.cancelOperation('op2');
      expect(cancelled).toBe(true);

      // Complete operation 1
      resolveOp1!();
      
      await queue.waitForCompletion();

      // Operation 2 should not have executed
      expect(executionOrder).toEqual(['op1', 'op3']);
    });

    it('should cancel all operations for a specific task', async () => {
      const executionOrder: string[] = [];
      let resolveOp1: () => void;

      // First operation will block the queue
      const operation1: QueuedOperation = {
        id: 'op1',
        type: 'update',
        taskId: 1,
        timestamp: Date.now(),
        description: 'Update task 1',
        execute: async () => {
          await new Promise<void>(resolve => {
            resolveOp1 = resolve;
          });
          executionOrder.push('task1-op1');
        }
      };

      const operation2: QueuedOperation = {
        id: 'op2',
        type: 'update',
        taskId: 2,
        timestamp: Date.now(),
        description: 'Update task 2',
        execute: async () => {
          executionOrder.push('task2-op1');
        }
      };

      const operation3: QueuedOperation = {
        id: 'op3',
        type: 'delete',
        taskId: 1,
        timestamp: Date.now(),
        description: 'Delete task 1',
        execute: async () => {
          executionOrder.push('task1-op2');
        }
      };

      // Enqueue all operations
      queue.enqueue(operation1);
      queue.enqueue(operation2);
      queue.enqueue(operation3);

      // Wait a tiny bit to ensure the first operation is processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cancel all operations for task 1 (should cancel op3, op1 is already executing)
      const cancelledCount = queue.cancelTaskOperations(1);
      expect(cancelledCount).toBe(1); // Only op3 can be cancelled

      // Complete op1
      resolveOp1!();

      await queue.waitForCompletion();

      // op1 and op2 should have executed, op3 should be cancelled
      expect(executionOrder).toEqual(['task1-op1', 'task2-op1']);
    });

    it('should return false when cancelling non-existent operation', () => {
      const cancelled = queue.cancelOperation('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('Status tracking', () => {
    it('should provide accurate queue status', async () => {
      const status = queue.getStatus();
      expect(status).toEqual({
        length: 0,
        processing: false,
        currentOperation: null
      });

      let resolveOp: () => void;
      const operation: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Test operation',
        execute: async () => {
          await new Promise<void>(resolve => {
            resolveOp = resolve;
          });
        }
      };

      queue.enqueue(operation);
      
      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const processingStatus = queue.getStatus();
      expect(processingStatus.processing).toBe(true);
      expect(processingStatus.currentOperation?.id).toBe('op1');

      resolveOp!();
      await queue.waitForCompletion();

      const finalStatus = queue.getStatus();
      expect(finalStatus).toEqual({
        length: 0,
        processing: false,
        currentOperation: null
      });
    });

    it('should notify status listeners', async () => {
      const statusUpdates: QueueStatus[] = [];
      const unsubscribe = queue.subscribeToStatus(status => {
        statusUpdates.push({ ...status });
      });

      // Should immediately receive current status
      expect(statusUpdates.length).toBe(1);
      expect(statusUpdates[0].processing).toBe(false);

      const operation: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Test operation',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
      };

      await queue.enqueue(operation);

      // Should have received multiple status updates
      expect(statusUpdates.length).toBeGreaterThan(1);
      
      // Verify we got processing state changes
      const processingStates = statusUpdates.map(s => s.processing);
      expect(processingStates).toContain(true);
      expect(processingStates).toContain(false);

      unsubscribe();
    });
  });

  describe('Queue management', () => {
    it('should clear all pending operations', async () => {
      const executionOrder: string[] = [];
      let resolveOp1: () => void;

      const operation1: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Operation 1',
        execute: async () => {
          await new Promise<void>(resolve => {
            resolveOp1 = resolve;
          });
          executionOrder.push('op1');
        }
      };

      const operation2: QueuedOperation = {
        id: 'op2',
        type: 'update',
        timestamp: Date.now(),
        description: 'Operation 2',
        execute: async () => {
          executionOrder.push('op2');
        }
      };

      // Enqueue operations
      queue.enqueue(operation1);
      queue.enqueue(operation2);

      // Clear queue while first operation is running
      queue.clear();

      // Complete first operation
      resolveOp1!();
      
      await queue.waitForCompletion();

      // Only first operation should have executed
      expect(executionOrder).toEqual(['op1']);
      expect(queue.getStatus().length).toBe(0);
    });

    it('should handle rapid sequential operations', async () => {
      const operationCount = 20;
      const executionOrder: number[] = [];

      const promises = Array.from({ length: operationCount }, (_, i) => {
        const operation: QueuedOperation<number> = {
          id: `op${i}`,
          type: 'add',
          timestamp: Date.now(),
          description: `Operation ${i}`,
          execute: async () => {
            // Random delay to simulate varying operation times
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
            executionOrder.push(i);
            return i;
          }
        };
        return queue.enqueue(operation);
      });

      const results = await Promise.all(promises);

      // Verify all operations completed in order
      expect(executionOrder).toEqual(Array.from({ length: operationCount }, (_, i) => i));
      expect(results).toEqual(Array.from({ length: operationCount }, (_, i) => i));
    });
  });

  describe('Error handling', () => {
    it('should handle rollback errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const operation: QueuedOperation = {
        id: 'op1',
        type: 'add',
        timestamp: Date.now(),
        description: 'Operation with failing rollback',
        execute: async () => {
          throw new Error('Execute failed');
        },
        rollback: () => {
          throw new Error('Rollback failed');
        }
      };

      await expect(queue.enqueue(operation)).rejects.toThrow('Execute failed');

      // Queue should still be functional
      const successOperation: QueuedOperation = {
        id: 'op2',
        type: 'add',
        timestamp: Date.now(),
        description: 'Success operation',
        execute: async () => {
          return 'success';
        }
      };

      const result = await queue.enqueue(successOperation);
      expect(result).toBe('success');

      consoleSpy.mockRestore();
    });
  });
});