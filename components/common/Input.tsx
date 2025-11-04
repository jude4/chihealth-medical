import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, name, error, ...props }) => {
  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`form-input ${error ? 'form-input-error' : ''}`}
        {...props}
      />
      {error && <p className="form-error-text">{error}</p>}
    </div>
  );
};