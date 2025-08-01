# Task 002: Implement Robust ID Generation System

## Description
The current ID generation using `Date.now()` can create duplicate IDs when tasks are created in rapid succession (within the same millisecond). This can lead to task overwrites, incorrect updates, and data loss. We need a more robust ID generation system that guarantees uniqueness even under high-frequency operations.

## Technical Analysis
Current issue in `src/services/taskService.ts:57`:
```typescript
id: Date.now() // Can produce duplicates in sub-millisecond operations
```

When users create multiple tasks very quickly (common during busy periods as reported), the same timestamp can be assigned to multiple tasks, causing one to overwrite the other.

## Acceptance Criteria
- [ ] Replace `Date.now()` with a guaranteed unique ID generation method
- [ ] IDs must be unique even when generated within microseconds of each other
- [ ] IDs should remain numeric for backward compatibility with existing data
- [ ] No performance degradation for ID generation
- [ ] Existing tasks with current IDs must continue to work
- [ ] Add unit tests for ID uniqueness under rapid generation

## Priority
high

## Labels
bug, data-integrity, foundational

## Dependencies
None - This is a foundational fix needed before other improvements

## Implementation Notes
Options to consider:
1. **Timestamp + Counter** (Recommended):
   ```typescript
   let counter = 0;
   let lastTimestamp = 0;
   
   function generateId(): number {
     const timestamp = Date.now();
     if (timestamp === lastTimestamp) {
       counter++;
     } else {
       counter = 0;
       lastTimestamp = timestamp;
     }
     // Combine timestamp with counter for uniqueness
     return parseInt(`${timestamp}${counter.toString().padStart(3, '0')}`);
   }
   ```

2. **High-resolution timestamp**:
   ```typescript
   // Use performance.now() for microsecond precision
   const id = Date.now() * 1000 + Math.floor(performance.now() % 1000);
   ```

3. **UUID converted to number** (if we can handle larger numbers):
   ```typescript
   // Generate UUID and convert to numeric representation
   ```

## Testing Requirements
- Generate 1000 IDs in a tight loop and verify uniqueness
- Test concurrent ID generation scenarios
- Verify IDs are strictly increasing (helps with sorting)
- Test ID generation across different time zones/system times

## Status
completed

## Created
2025-08-01

## Updated
2025-08-01

## Implementation Summary
- Created a robust IdGenerator class that combines timestamp with a counter
- Replaced `Date.now()` with `idGenerator.generateId()` in taskService
- Added comprehensive unit tests verifying uniqueness under rapid generation
- Tested with 1000 rapid ID generations - all unique
- Maintains backward compatibility with existing numeric IDs
- No performance impact - ID generation remains O(1)