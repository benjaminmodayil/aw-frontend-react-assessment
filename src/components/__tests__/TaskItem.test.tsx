import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskItem from '../TaskItem';
import { Task } from '../../types';

const mockTask: Task = {
  id: 1,
  text: 'Test task',
  completed: false,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z'
};

const mockProps = {
  task: mockTask,
  onToggle: jest.fn(),
  onDelete: jest.fn(),
  isToggling: false,
  isDeleting: false
};

describe('TaskItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task text correctly', () => {
    render(<TaskItem {...mockProps} />);
    expect(screen.getByText('Test task')).toBeInTheDocument();
  });

  it('shows checked state when task is completed', () => {
    const completedTask = { ...mockTask, completed: true };
    render(<TaskItem {...mockProps} task={completedTask} />);
    
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('calls onToggle when checkbox is clicked', () => {
    render(<TaskItem {...mockProps} />);
    
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    expect(mockProps.onToggle).toHaveBeenCalledWith(1);
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<TaskItem {...mockProps} />);
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
    
    expect(mockProps.onDelete).toHaveBeenCalledWith(1);
  });

  it('disables checkbox when toggling', () => {
    render(<TaskItem {...mockProps} isToggling={true} />);
    
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
  });

  it('disables delete button when deleting', () => {
    render(<TaskItem {...mockProps} isDeleting={true} />);
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeDisabled();
  });

  it('applies completed styles to completed tasks', () => {
    const completedTask = { ...mockTask, completed: true };
    render(<TaskItem {...mockProps} task={completedTask} />);
    
    const taskText = screen.getByText('Test task');
    expect(taskText).toHaveClass('task-completed');
  });
});