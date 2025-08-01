import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import TaskForm from '../TaskForm';

const mockProps = {
  onAddTask: jest.fn(),
  isAddingTask: false
};

describe('TaskForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders input and button correctly', () => {
    render(<TaskForm {...mockProps} />);
    
    expect(screen.getByPlaceholderText('Enter a new task...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add new task/i })).toBeInTheDocument();
  });

  it('calls onAddTask when form is submitted with valid input', async () => {
    const user = userEvent.setup();
    render(<TaskForm {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    const button = screen.getByRole('button', { name: /add new task/i });
    
    await user.type(input, 'New test task');
    await user.click(button);
    
    expect(mockProps.onAddTask).toHaveBeenCalledWith('New test task');
  });

  it('clears input after successful submission', async () => {
    const user = userEvent.setup();
    render(<TaskForm {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    await user.type(input, 'New test task');
    fireEvent.submit(input.closest('form')!);
    
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('does not submit empty or whitespace-only tasks', async () => {
    const user = userEvent.setup();
    render(<TaskForm {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    const button = screen.getByRole('button', { name: /add new task/i });
    
    // Test with empty string
    await user.click(button);
    expect(mockProps.onAddTask).not.toHaveBeenCalled();
    
    // Test with whitespace
    await user.type(input, '   ');
    await user.click(button);
    expect(mockProps.onAddTask).not.toHaveBeenCalled();
  });

  it('disables form when loading', () => {
    render(<TaskForm {...mockProps} isAddingTask={true} />);
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    const button = screen.getByRole('button');
    
    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Adding...');
  });

  it('trims whitespace from input before submission', async () => {
    const user = userEvent.setup();
    render(<TaskForm {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Enter a new task...');
    
    await user.type(input, '  Test task with spaces  ');
    fireEvent.submit(input.closest('form')!);
    
    expect(mockProps.onAddTask).toHaveBeenCalledWith('Test task with spaces');
  });
});