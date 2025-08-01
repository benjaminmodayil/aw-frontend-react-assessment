# Task 001: Fix Stale Closure Problem in Task Operations

## Description
The current implementation of `useTasks` hook has a critical stale closure bug where the `addTask`, `toggleTask`, and `deleteTask` callbacks capture outdated `tasks` state in their closures. When users interact rapidly with the application, operations reference stale task arrays, causing tasks to disappear, reappear with incorrect states, or get lost entirely.

This is the root cause of the reported bug: "Tasks are randomly disappearing and reappearing when I work quickly. Sometimes when I mark a task as complete and immediately add a new one, the completed task becomes uncompleted again."

## Technical Analysis
The problem occurs in `src/hooks/useTasks.ts`:
- Line 45: `addTask` depends on `[tasks]`
- Line 72: `toggleTask` depends on `[tasks]`
- Line 90: `deleteTask` depends on `[tasks]`

When an async operation is in flight and another operation starts, both reference the same stale `tasks` array. The last operation to complete overwrites all changes from earlier operations.

## Acceptance Criteria
- [ ] Remove `tasks` from dependency arrays of all task operation callbacks
- [ ] Convert all `setTasks` calls to use functional updates: `setTasks(prevTasks => ...)`
- [ ] Ensure operations always work with the latest state, not captured values
- [ ] All existing tests must pass
- [ ] Add new tests to verify rapid operation sequences work correctly
- [ ] No tasks should be lost during rapid interactions
- [ ] Task states should remain consistent regardless of operation timing

## Priority
high

## Labels
bug, critical, state-management, race-condition

## Dependencies
None - This is the foundational fix that other improvements depend on

## Implementation Notes
1. Replace direct state access with functional updates:
   ```typescript
   // Before:
   const updatedTasks = [...tasks, newTask];
   setTasks(updatedTasks);
   
   // After:
   setTasks(prevTasks => [...prevTasks, newTask]);
   ```

2. For operations that need the current state, access it inside the functional update:
   ```typescript
   setTasks(prevTasks => {
     const taskToUpdate = prevTasks.find(task => task.id === taskId);
     if (!taskToUpdate) return prevTasks;
     // ... perform update
   });
   ```

3. Ensure localStorage operations also use the latest state from functional updates

## Testing Requirements
- Test rapid add operations (5+ tasks in quick succession)
- Test interleaved toggle and add operations
- Test delete operations during other operations
- Verify localStorage consistency after rapid operations

## Status
completed

## Created
2025-08-01

## Updated
2025-08-01

## Implementation Notes (Completed)
- Successfully converted all state updates to use functional updates
- Removed `tasks` from dependency arrays in `addTask`, `toggleTask`, and `deleteTask`
- Moved localStorage saves inside functional updates to ensure consistency
- Used Promise pattern for accessing current state in `toggleTask` operation
- All existing tests pass without regression