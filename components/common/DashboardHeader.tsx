import React, { useState } from 'react';
import { User, Notification } from '../../types.ts';
import * as Icons from '../icons/index.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { NotificationPanel } from './NotificationPanel.tsx';
import { LanguageSelector } from './LanguageSelector.tsx';
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { OrganizationSwitcher } from './OrganizationSwitcher.tsx';

interface DashboardHeaderProps {
  user: User;
  onSignOut: () => void;
  onSwitchOrganization: (orgId: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  title: string;
  notifications: Notification[];
  onMarkNotificationsAsRead: () => void;
  language?: string;
  onLanguageChange?: (lang: string) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = (props) => {
    const { user, onSignOut, theme, toggleTheme, title, language, onLanguageChange, onSwitchOrganization } = props;
    const [isNotificationsOpen, setNotificationsOpen] = useState(false);
    const [isSignOutModalOpen, setSignOutModalOpen] = useState(false);
    
    const unreadCount = props.notifications.filter(n => !n.isRead).length;

    const UserAvatar: React.FC = () => (
        <div className="flex items-center gap-3">
             <img 
                src={`https://i.pravatar.cc/150?u=${user.id}`} 
                alt={user.name}
                className="w-10 h-10 rounded-full border-2 border-slate-300 dark:border-slate-600"
            />
            <div>
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
        </div>
    );
    
    return (
        <>
            <header className="dashboard-header">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">{title}</h1>
                <div className="flex items-center gap-4">
                    {user.organizations && user.organizations.length > 1 && onSwitchOrganization && (
                      <OrganizationSwitcher user={user} onSwitch={onSwitchOrganization} />
                    )}
                
                    {language && onLanguageChange && <LanguageSelector language={language} onLanguageChange={onLanguageChange} />}
                    <ThemeToggle theme={theme} toggleTheme={toggleTheme} />

                    <div className="relative">
                        <button onClick={() => setNotificationsOpen(p => !p)} className="notification-bell" aria-label={`Notifications (${unreadCount} unread)`}>
                            <Icons.BellIcon />
                            {unreadCount > 0 && <span className="notification-unread-dot"></span>}
                        </button>
                        {isNotificationsOpen && <NotificationPanel notifications={props.notifications} onClose={() => setNotificationsOpen(false)} onMarkAllAsRead={props.onMarkNotificationsAsRead} />}
                    </div>
                    
                    <UserAvatar />
                    
                    <button onClick={() => setSignOutModalOpen(true)} className="theme-toggle-button" aria-label="Sign Out">
                        <Icons.LogOutIcon />
                    </button>
                </div>
            </header>
             <ConfirmationModal
                isOpen={isSignOutModalOpen}
                onClose={() => setSignOutModalOpen(false)}
                onConfirm={onSignOut}
                title="Confirm Sign Out"
                message="Are you sure you want to sign out of your account?"
                confirmText="Sign Out"
                type="danger"
            />
        </>
    );
};
