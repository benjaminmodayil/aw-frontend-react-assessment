import { useState, useEffect } from 'react';
import { operationQueue, QueueStatus } from '../utils/operationQueue';

/**
 * Hook to subscribe to operation queue status
 * Provides real-time updates on queue length and processing state
 */
export const useQueueStatus = () => {
  const [status, setStatus] = useState<QueueStatus>(() => operationQueue.getStatus());

  useEffect(() => {
    // Subscribe to queue status updates
    const unsubscribe = operationQueue.subscribeToStatus(setStatus);

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return {
    queueLength: status.length,
    isProcessing: status.processing,
    hasOperations: status.length > 0 || status.processing,
    currentOperation: status.currentOperation
  };
};