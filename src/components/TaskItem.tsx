import React from 'react';
import { TaskItemProps } from '../types';
import LoadingSpinner from './LoadingSpinner';

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onDelete, isToggling, isDeleting }) => {
  const handleToggle = () => {
    onToggle(task.id);
  };

  const handleDelete = () => {
    onDelete(task.id);
  };

  const isDisabled = isToggling || isDeleting;

  return (
    <div className={`task-item ${task.optimistic ? 'optimistic' : ''} ${isDisabled ? 'task-loading' : ''}`}>
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.completed}
        onChange={handleToggle}
        disabled={isToggling}
        aria-label={`Mark "${task.text}" as ${task.completed ? 'incomplete' : 'complete'}`}
        aria-busy={isToggling}
      />
      <span className={`task-text ${task.completed ? 'task-completed' : ''}`}>
        {task.text}
        {isToggling && <LoadingSpinner size="small" />}
      </span>
      <div className="task-actions">
        <button
          className="delete-button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Delete task "${task.text}"`}
          aria-busy={isDeleting}
        >
          {isDeleting ? <LoadingSpinner size="small" /> : 'Delete'}
        </button>
      </div>
    </div>
  );
};

export default TaskItem;