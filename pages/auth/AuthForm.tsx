import React, { useState, useRef, useEffect } from 'react';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';
import { SSOButton } from '../../components/common/SSOButton.tsx';
import { GoogleIcon, MicrosoftIcon } from '../../components/icons/index.tsx';
import * as authService from '../../services/authService.ts';
import * as api from '../../services/apiService.ts';
import { Patient, User } from '../../types.ts';
import { useToasts } from '../../hooks/useToasts.ts';

interface AuthFormProps {
    onSsoSuccess: (user: Partial<Patient>) => void;
    onForgotPassword: () => void;
    onAuthSuccess: (user: User) => void;
    initialTab?: 'login' | 'register';
}

type AuthView = 'login' | 'register';

export const AuthForm: React.FC<AuthFormProps> = ({ onSsoSuccess, onForgotPassword, onAuthSuccess, initialTab = 'login' }) => {
    const [view, setView] = useState<AuthView>(initialTab);
    const [isSsoLoading, setIsSsoLoading] = useState(false);
    const [formHeight, setFormHeight] = useState<number | undefined>(undefined);
    const formRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToasts();

    useEffect(() => {
        const formElement = formRef.current;
        if (!formElement) return;

        // Use ResizeObserver to automatically update height on content changes,
        // such as the password strength meter appearing.
        const resizeObserver = new ResizeObserver(() => {
            if (formRef.current) {
                setFormHeight(formRef.current.scrollHeight);
            }
        });

        resizeObserver.observe(formElement);

        // Set initial height
        setFormHeight(formElement.scrollHeight);

        // Cleanup observer on component unmount or when view changes
        return () => {
            if (formElement) {
                resizeObserver.unobserve(formElement);
            }
        };
    }, [view]); // Rerun when the view changes to attach the observer to the new form content

    const handleSsoLogin = async (provider: 'Google') => {
        setIsSsoLoading(true);
        try {
            await authService.signInWithSso(provider);
            // The browser will be redirected, so we don't need to do anything else here.
            // The loading state will be reset if the user navigates back.
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown SSO error occurred.';
            addToast(message, 'error');
            setIsSsoLoading(false);
        }
    };
    
    return (
        <div className="auth-card">
             <div className="auth-tabs">
                <button onClick={() => setView('login')} className={`auth-tab ${view === 'login' ? 'active' : ''}`}>
                    Sign In
                </button>
                <button onClick={() => setView('register')} className={`auth-tab ${view === 'register' ? 'active' : ''}`}>
                    Create Account
                </button>
            </div>

            <div className="auth-form-wrapper" style={{ height: formHeight }}>
                <div ref={formRef}>
                {view === 'login' ? (
                    <LoginForm onForgotPassword={onForgotPassword} onAuthSuccess={onAuthSuccess} />
                ) : (
                    <RegisterForm 
                        onSuccess={() => {
                            addToast('Registration successful! Please sign in.', 'success');
                            setView('login');
                        }}
                    />
                )}
                </div>
            </div>

            <div className="auth-card__divider">
                <span>Or continue with</span>
            </div>

            <div className="sso-providers">
                <SSOButton providerName="Google" onClick={() => handleSsoLogin('Google')} isLoading={isSsoLoading}><GoogleIcon /></SSOButton>
                <SSOButton providerName="Microsoft" disabled><MicrosoftIcon /></SSOButton>
            </div>
        </div>
    );
};