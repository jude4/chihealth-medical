import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, name, error, children, ...props }) => {
  const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:border-teal-500 focus:ring-teal-500';

  return (
    <div className="w-full">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <select
        id={name}
        name={name}
        className={`block w-full bg-slate-50 dark:bg-slate-900/50 border rounded-md shadow-sm py-3 px-4 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 sm:text-sm transition ${errorClasses}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
};