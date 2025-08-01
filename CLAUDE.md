# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run tests
npm test

# Run tests in watch mode
npm test -- --watchAll

# Run a specific test file
npm test -- TaskForm.test.tsx

# Build for production
npm build
```

## Architecture Overview

This is a React TypeScript task management application using Create React App. The application follows a context-based state management pattern with clear separation of concerns:

### Key Components

- **Context Layer**: `TaskContext` provides global state management using React Context API
- **Custom Hook**: `useTasks` hook manages all task operations and local storage persistence
- **Service Layer**: `taskService.ts` handles data operations with simulated async behavior
- **Component Structure**: 
  - `TaskApp` - Main application container
  - `TaskForm` - Handles new task creation
  - `TaskList` & `TaskItem` - Display and manage individual tasks
  - `ErrorBoundary` - Catches and displays React errors gracefully

### Data Flow

1. All task data is stored in browser's localStorage
2. State updates flow through the TaskContext
3. Components access state via `useTaskContext` hook
4. All operations (add/toggle/delete) include loading states and error handling

### State Management Patterns

**Important**: The `useTasks` hook uses functional state updates to prevent race conditions:
- All `setTasks` calls use the pattern: `setTasks(prevTasks => ...)`
- Task operations do NOT include `tasks` in their dependency arrays
- This ensures operations always work with the latest state, even during rapid user interactions

### ID Generation

**Important**: Task IDs are generated using a custom ID generator (`src/utils/idGenerator.ts`):
- Combines timestamp with a counter (000-999) for uniqueness within the same millisecond
- Guarantees unique IDs even during rapid task creation
- IDs are numeric and monotonically increasing
- Do NOT use `Date.now()` directly for ID generation

### TypeScript Configuration

- Strict mode enabled
- All components and utilities are fully typed
- Type definitions centralized in `src/types/index.ts`

### Testing Approach

- Uses React Testing Library and Jest
- Test files located alongside components in `__tests__` directories
- Focus on user interactions and behavior over implementation details

## Node Version

This project requires Node.js v23.11.0 (specified in `.nvmrc`)