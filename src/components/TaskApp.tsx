import React from 'react';
import { useTaskContext } from '../context/TaskContext';
import { Header, TaskForm, TaskList, LoadingIndicator } from './index';

const TaskApp = () => {
  const {
    tasks,
    loadingState,
    error,
    addTask,
    toggleTask,
    deleteTask,
    refreshTasks
  } = useTaskContext();

  const handleAddTask = async (taskText: string) => {
    await addTask(taskText);
  };

  if (error) {
    return (
      <div className="app">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Header onRefresh={refreshTasks} />
      
      <TaskForm 
        onAddTask={handleAddTask}
        isAddingTask={loadingState.addingTask}
      />
      
      <TaskList
        tasks={tasks}
        onToggleTask={toggleTask}
        onDeleteTask={deleteTask}
        loadingState={loadingState}
      />
      
      <LoadingIndicator 
        isLoading={loadingState.refreshing || loadingState.loadingInitial}
        message={loadingState.loadingInitial ? 'Loading tasks...' : 'Refreshing...'}
      />
    </div>
  );
};

export default TaskApp;