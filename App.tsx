import React, { useState, useEffect, useCallback } from 'react';
import Auth from './pages/auth/Auth';
import SsoComplete from './pages/auth/SsoComplete';
import RegisterOrg from './pages/auth/RegisterOrg';
import ForgotPassword from './pages/auth/ForgotPassword';
import { AuthLayout } from './pages/auth/AuthLayout';
import { PricingPage } from './pages/auth/PricingPage';

import PatientDashboard from './pages/patient/PatientDashboard';
import HealthcareWorkerDashboard from './pages/hcw/HealthcareWorkerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import NurseDashboard from './pages/nurse/NurseDashboard';
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard';
import LabTechnicianDashboard from './pages/lab/LabTechnicianDashboard';
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import LogisticsDashboard from './pages/logistics/LogisticsDashboard';
import CommandCenterDashboard from './pages/command-center/CommandCenterDashboard.tsx';

import { FullScreenLoader } from './components/common/FullScreenLoader';
import { SessionTimeoutModal } from './components/common/SessionTimeoutModal';

import { User, Patient } from './types';
import * as api from './services/apiService';
import { useDarkMode } from './hooks/useDarkMode';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import { useWebSocket } from './hooks/useWebSocket';

type View = 'auth' | 'ssoComplete' | 'dashboard' | 'registerOrg' | 'forgotPassword' | 'pricing';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [ssoUser, setSsoUser] = useState<Partial<Patient> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>('auth');
  const [initialTab, setInitialTab] = useState<'login' | 'register'>('login');
  const [theme, toggleTheme] = useDarkMode();

  const handleSignOut = useCallback(() => {
    api.clearAuthToken();
    setUser(null);
    setView('auth');
  }, []);
  
  const { isWarningModalOpen, countdown, handleStay } = useSessionTimeout(handleSignOut);

  const fetchUser = useCallback(async () => {
    setIsLoading(true);
    const token = api.getAuthToken();
    if (token) {
      try {
        const userData = await api.fetchCurrentUser();
        setUser(userData);
        setView('dashboard');
      } catch (error) {
        console.error("Session expired or invalid", error);
        handleSignOut();
      }
    }
    setIsLoading(false);
  }, [handleSignOut]);
  
  useWebSocket(user?.id, fetchUser);

  useEffect(() => {
    const checkSsoCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tempToken = urlParams.get('tempToken');
      const isNewUser = urlParams.get('isNewUser');
      const error = urlParams.get('error');

      if (error) {
        // Handle SSO error
        console.error('SSO Error:', error);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      
      if (tempToken) {
        if (isNewUser === 'true') {
            const userData = await api.getSsoUserData(tempToken);
            setSsoUser(userData);
            setView('ssoComplete');
        } else {
            api.setAuthToken(tempToken);
            await fetchUser();
            window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        await fetchUser();
      }
    };
    
    checkSsoCallback();
  }, [fetchUser]);

  const handleAuthSuccess = (authedUser: User) => {
    setUser(authedUser);
    setView('dashboard');
  };

  const renderDashboard = () => {
    if (!user) return <Auth onAuthSuccess={handleAuthSuccess} onSsoSuccess={setSsoUser} onForgotPassword={() => setView('forgotPassword')} onNavigateToPricing={() => setView('pricing')} />;
    switch (user.role) {
      case 'patient':
        return <PatientDashboard user={user as Patient} onSignOut={() => handleSignOut()} theme={theme} toggleTheme={toggleTheme} />;
      case 'hcw':
        return <HealthcareWorkerDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'admin':
        return <AdminDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'nurse':
        return <NurseDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'pharmacist':
        return <PharmacistDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'lab_technician':
        return <LabTechnicianDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'receptionist':
         return <ReceptionistDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'logistics':
        return <LogisticsDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      case 'command_center':
        return <CommandCenterDashboard user={user} onSignOut={handleSignOut} onSwitchOrganization={api.switchOrganization} theme={theme} toggleTheme={toggleTheme} />;
      default:
        return <div>Unknown user role. Please contact support.</div>;
    }
  };
  
  const renderContent = () => {
    if (isLoading) return <FullScreenLoader />;

    switch (view) {
      case 'auth':
        return (
          <AuthLayout onNavigate={() => setView('pricing')} pageType='login' theme={theme} toggleTheme={toggleTheme}>
            <Auth 
              initialTab={initialTab}
              onAuthSuccess={handleAuthSuccess} 
              onSsoSuccess={setSsoUser} 
              onForgotPassword={() => setView('forgotPassword')}
              onNavigateToPricing={() => setView('pricing')}
            />
          </AuthLayout>
        );
      case 'ssoComplete':
         return (
          <AuthLayout onNavigate={() => { setSsoUser(null); setView('auth'); }} pageType='ssoComplete' theme={theme} toggleTheme={toggleTheme}>
            {ssoUser && <SsoComplete user={ssoUser} onAuthSuccess={handleAuthSuccess} onCancel={() => { setSsoUser(null); setView('auth'); }} />}
          </AuthLayout>
         );
      case 'registerOrg':
        return (
          <AuthLayout onNavigate={() => setView('auth')} pageType='registerOrg' theme={theme} toggleTheme={toggleTheme}>
            <RegisterOrg onNavigate={() => { setView('auth'); setInitialTab('login'); }} />
          </AuthLayout>
        );
      case 'forgotPassword':
        return (
          <AuthLayout onNavigate={() => setView('auth')} pageType='forgotPassword' theme={theme} toggleTheme={toggleTheme}>
            <ForgotPassword onBackToLogin={() => setView('auth')} />
          </AuthLayout>
        );
      case 'pricing':
        return (
            <AuthLayout onNavigate={() => setView('auth')} pageType='pricing' theme={theme} toggleTheme={toggleTheme}>
                <PricingPage onSelectPlan={() => setView('registerOrg')} onSelectPatientPlan={() => { setView('auth'); setInitialTab('register'); }}/>
            </AuthLayout>
        );
      case 'dashboard':
        return renderDashboard();
      default:
        return <div>An unexpected error occurred.</div>;
    }
  }

  return (
    <>
      {renderContent()}
      <SessionTimeoutModal isOpen={isWarningModalOpen} countdown={countdown} onStay={handleStay} onLogout={handleSignOut} />
    </>
  );
};

export default App;