import { OperationQueue } from '../operationQueue';
import { delay } from '../delay';

describe('OperationQueue - Race Condition Prevention', () => {
  let queue: OperationQueue;
  let executionLog: string[] = [];

  beforeEach(() => {
    queue = new OperationQueue();
    executionLog = [];
    jest.clearAllMocks();
  });

  afterEach(() => {
    queue.clear();
  });

  it('should prevent race conditions with varying delays', async () => {
    // Simulate the exact scenario from the bug report
    const operations = [
      {
        id: 'op1',
        delay: 300, // Long delay
        value: 'Operation 1'
      },
      {
        id: 'op2',
        delay: 50,  // Short delay
        value: 'Operation 2'
      },
      {
        id: 'op3',
        delay: 100, // Medium delay
        value: 'Operation 3'
      }
    ];

    // Enqueue all operations rapidly (simulating fast user interactions)
    const promises = operations.map((op, index) => {
      return queue.enqueue({
        id: op.id,
        type: 'update' as const,
        timestamp: Date.now() + index,
        description: op.value,
        execute: async () => {
          await delay(op.delay);
          executionLog.push(op.value);
          return op.value;
        }
      });
    });

    // Wait for all operations
    const results = await Promise.all(promises);

    // Verify execution order matches enqueue order, not delay order
    expect(executionLog).toEqual(['Operation 1', 'Operation 2', 'Operation 3']);
    expect(results).toEqual(['Operation 1', 'Operation 2', 'Operation 3']);
  });

  it('should handle rapid task operations in correct order', async () => {
    const mockLocalStorage: Record<string, any> = {};
    
    // Track localStorage writes
    const writeLog: Array<{ operation: string; data: any }> = [];

    // Simulate 10 rapid operations as reported in the bug
    const operationCount = 10;
    const promises = [];

    for (let i = 0; i < operationCount; i++) {
      const operation = queue.enqueue({
        id: `task-${i}`,
        type: i % 3 === 0 ? 'add' : i % 3 === 1 ? 'update' : 'delete',
        taskId: i,
        timestamp: Date.now() + i,
        description: `Operation ${i}`,
        execute: async () => {
          // Random delay between 25-350ms (matching the bug scenario)
          const operationDelay = Math.random() * 325 + 25;
          await delay(operationDelay);
          
          // Simulate localStorage write
          const data = { taskId: i, timestamp: Date.now() };
          mockLocalStorage[`task-${i}`] = data;
          writeLog.push({ operation: `Operation ${i}`, data });
          
          executionLog.push(`Operation ${i}`);
          return i;
        }
      });
      
      promises.push(operation);
    }

    const results = await Promise.all(promises);

    // Verify all operations completed in order
    expect(executionLog).toEqual(
      Array.from({ length: operationCount }, (_, i) => `Operation ${i}`)
    );
    
    // Verify results match order
    expect(results).toEqual(Array.from({ length: operationCount }, (_, i) => i));

    // Verify no writes were lost or overwritten out of order
    expect(writeLog.length).toBe(operationCount);
    for (let i = 0; i < operationCount; i++) {
      expect(writeLog[i].operation).toBe(`Operation ${i}`);
      expect(mockLocalStorage[`task-${i}`].taskId).toBe(i);
    }
  });

  it('should handle operation failures without losing order', async () => {
    const operations = [
      { id: 'op1', shouldFail: false },
      { id: 'op2', shouldFail: true },  // This will fail
      { id: 'op3', shouldFail: false },
      { id: 'op4', shouldFail: false }
    ];

    const promises = operations.map((op, index) => {
      return queue.enqueue({
        id: op.id,
        type: 'update' as const,
        timestamp: Date.now() + index,
        description: `Operation ${index + 1}`,
        execute: async () => {
          await delay(50);
          if (op.shouldFail) {
            throw new Error(`${op.id} failed`);
          }
          executionLog.push(`${op.id} completed`);
          return op.id;
        },
        rollback: () => {
          executionLog.push(`${op.id} rolled back`);
        }
      });
    });

    // Wait for all operations (some will reject)
    const results = await Promise.allSettled(promises);

    // Check results
    expect(results[0]).toEqual({ status: 'fulfilled', value: 'op1' });
    expect(results[1]).toEqual({ 
      status: 'rejected', 
      reason: expect.objectContaining({ message: 'op2 failed' })
    });
    expect(results[2]).toEqual({ status: 'fulfilled', value: 'op3' });
    expect(results[3]).toEqual({ status: 'fulfilled', value: 'op4' });

    // Verify execution log shows proper order and rollback
    expect(executionLog).toEqual([
      'op1 completed',
      'op2 rolled back',
      'op3 completed',
      'op4 completed'
    ]);
  });

  it('should properly cancel operations for deleted tasks', async () => {
    let resolveOp1: () => void;
    
    // Start a long-running operation
    const promise1 = queue.enqueue({
      id: 'op1',
      type: 'update' as const,
      taskId: 1,
      timestamp: Date.now(),
      description: 'Update task 1',
      execute: async () => {
        await new Promise<void>(resolve => {
          resolveOp1 = resolve;
        });
        executionLog.push('op1 completed');
        return 'op1';
      }
    });

    // Enqueue more operations for the same task
    queue.enqueue({
      id: 'op2',
      type: 'update' as const,
      taskId: 1,
      timestamp: Date.now() + 1,
      description: 'Another update for task 1',
      execute: async () => {
        executionLog.push('op2 completed');
        return 'op2';
      }
    });

    // Enqueue operation for different task
    const promise3 = queue.enqueue({
      id: 'op3',
      type: 'update' as const,
      taskId: 2,
      timestamp: Date.now() + 2,
      description: 'Update task 2',
      execute: async () => {
        executionLog.push('op3 completed');
        return 'op3';
      }
    });

    // Cancel all operations for task 1 (op2 should be cancelled)
    const cancelledCount = queue.cancelTaskOperations(1);
    expect(cancelledCount).toBe(1); // Only op2, as op1 is already executing

    // Complete op1
    resolveOp1!();

    await Promise.all([promise1, promise3]);

    // op2 should not have executed
    expect(executionLog).toEqual(['op1 completed', 'op3 completed']);
  });

  it('should maintain consistency during concurrent save operations', async () => {
    const saveLog: Array<{ id: string; tasks: any[] }> = [];
    
    // Simulate multiple components triggering saves simultaneously
    const saveOperations = Array.from({ length: 5 }, (_, i) => ({
      id: `save-${i}`,
      tasks: Array.from({ length: 3 }, (_, j) => ({
        id: i * 10 + j,
        text: `Task ${i}-${j}`,
        completed: false
      }))
    }));

    const promises = saveOperations.map((op, index) => {
      return queue.enqueue({
        id: op.id,
        type: 'save' as const,
        timestamp: Date.now() + index,
        description: `Save operation ${index}`,
        execute: async () => {
          // Varying delays to simulate real conditions
          await delay(Math.random() * 100 + 25);
          saveLog.push({ id: op.id, tasks: op.tasks });
          return op.id;
        }
      });
    });

    await Promise.all(promises);

    // Verify saves happened in order
    expect(saveLog.map(s => s.id)).toEqual([
      'save-0', 'save-1', 'save-2', 'save-3', 'save-4'
    ]);

    // Verify no saves were lost or interleaved
    expect(saveLog.length).toBe(5);
  });
});