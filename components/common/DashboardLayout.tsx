import React from 'react';

interface DashboardLayoutProps {
    sidebar: React.ReactNode;
    header: React.ReactNode;
    children: React.ReactNode;
    onSignOut?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, header, children, onSignOut }) => {
    return (
        <div className="dashboard">
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <div className="dashboard-sidebar-wrapper">
                {sidebar}
                {onSignOut && (
                    <div className="dashboard-sidebar-footer p-4">
                        <button onClick={onSignOut} className="w-full btn-ghost" aria-label="Sign Out from sidebar">
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
            <div className="dashboard-main">
                {header}
                <main id="main-content" className="dashboard-content">
                    <div className="content-container">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};