import React from 'react';
import { Logo } from './Logo.tsx';

export const FullScreenLoader: React.FC<{ message?: string }> = ({ message = 'Initializing...' }) => {
  return (
    <div className="full-screen-loader">
      <div className="loader-content">
        <Logo />
        <p>{message}</p>
      </div>
    </div>
  );
};