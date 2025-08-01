import React from 'react';
import TaskItem from './TaskItem';
import { TaskListProps } from '../types';

const TaskList: React.FC<TaskListProps> = ({ tasks, onToggleTask, onDeleteTask, loadingState }) => {
  if (tasks.length === 0) {
    return (
      <div className="task-list">
        <div className="empty-state">
          <p>No tasks yet. Add one above to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggleTask}
          onDelete={onDeleteTask}
          isToggling={loadingState.togglingTasks.has(task.id)}
          isDeleting={loadingState.deletingTasks.has(task.id)}
        />
      ))}
    </div>
  );
};

export default TaskList;