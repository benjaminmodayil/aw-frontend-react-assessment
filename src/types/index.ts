export interface Task {
  id: number;
  text: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  optimistic?: boolean;
}

export interface LoadingState {
  addingTask: boolean;
  togglingTasks: Set<number>;
  deletingTasks: Set<number>;
  refreshing: boolean;
  loadingInitial: boolean;
}

export interface TaskContextType {
  tasks: Task[];
  loadingState: LoadingState;
  error: string | null;
  addTask: (taskText: string) => Promise<void>;
  toggleTask: (taskId: number) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  refreshTasks: () => Promise<void>;
  loadTasks: () => Promise<void>;
}

export interface TaskFormProps {
  onAddTask: (taskText: string) => Promise<void>;
  isAddingTask: boolean;
}

export interface TaskItemProps {
  task: Task;
  onToggle: (taskId: number) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  isToggling: boolean;
  isDeleting: boolean;
}

export interface TaskListProps {
  tasks: Task[];
  onToggleTask: (taskId: number) => Promise<void>;
  onDeleteTask: (taskId: number) => Promise<void>;
  loadingState: LoadingState;
}

export interface HeaderProps {
  onRefresh: () => Promise<void>;
}

export interface LoadingIndicatorProps {
  isLoading: boolean;
  message?: string;
}