/**
 * Robust ID generator that guarantees unique numeric IDs
 * even when called multiple times within the same millisecond.
 * 
 * IDs are composed of:
 * - Timestamp (milliseconds since epoch)
 * - Counter (000-999) for operations within the same millisecond
 * 
 * Example: 1706234567890000 (timestamp: 1706234567890, counter: 000)
 */
class IdGenerator {
  private counter: number = 0;
  private lastTimestamp: number = 0;

  /**
   * Generates a unique numeric ID
   * @returns A unique numeric ID
   */
  generateId(): number {
    const timestamp = Date.now();
    
    if (timestamp === this.lastTimestamp) {
      this.counter++;
      if (this.counter > 999) {
        // Wait for next millisecond if we exceed counter limit
        while (Date.now() === timestamp) {
          // Busy wait (should rarely happen)
        }
        return this.generateId();
      }
    } else {
      this.counter = 0;
      this.lastTimestamp = timestamp;
    }
    
    // Combine timestamp with zero-padded counter
    const idString = `${timestamp}${this.counter.toString().padStart(3, '0')}`;
    return parseInt(idString, 10);
  }

  /**
   * Resets the generator state (useful for testing)
   */
  reset(): void {
    this.counter = 0;
    this.lastTimestamp = 0;
  }
}

// Export a singleton instance
export const idGenerator = new IdGenerator();

// Also export the class for testing purposes
export { IdGenerator };