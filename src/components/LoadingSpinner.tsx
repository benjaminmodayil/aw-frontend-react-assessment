import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium' }) => {
  return (
    <span 
      className={`loading-spinner loading-spinner--${size}`}
      role="status"
      aria-label="Loading"
    >
      <span className="visually-hidden">Loading...</span>
    </span>
  );
};

export default LoadingSpinner;