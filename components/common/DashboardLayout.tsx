import React from 'react';

interface DashboardLayoutProps {
    sidebar: React.ReactNode;
    header: React.ReactNode;
    children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ sidebar, header, children }) => {
    return (
        <div className="dashboard">
            <a href="#main-content" className="skip-link">Skip to main content</a>
            {sidebar}
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