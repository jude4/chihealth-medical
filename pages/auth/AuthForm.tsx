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

export const AuthForm: React.FC<AuthFormProps> = ({ onSsoSuccess: _onSsoSuccess, onForgotPassword, onAuthSuccess, initialTab = 'login' }) => {
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

    // Probe backend health to show a friendly warning if API proxy is down
    const [backendHealthy, setBackendHealthy] = React.useState<boolean | null>(null);
    useEffect(() => {
        let mounted = true;

        const probeHealth = async () => {
                const timeoutMs = 2500;
                const tryFetchWithTimeout = async (probeUrl: string) => {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), timeoutMs);
                    try {
                        const res = await fetch(probeUrl, { signal: controller.signal });
                        clearTimeout(id);
                        return res;
                    } catch (err) {
                        clearTimeout(id);
                        throw err;
                    }
                };

                // Candidate probe URLs (order matters): proxied path first, then configured backend, then origin
                const normalizedApiBase = api.API_BASE_URL.replace(/\/$/, '');
                const originBase = window.location.origin.replace(/\/$/, '');
                const localLoopbacks = ['localhost', '127.0.0.1', '::1'];
                const loopbackCandidates: string[] = [];
                if (localLoopbacks.includes(window.location.hostname)) {
                    loopbackCandidates.push('http://localhost:8080/api/health', 'http://127.0.0.1:8080/api/health');
                }

                const candidates = [
                    '/api/health',
                    `${normalizedApiBase}/api/health`,
                    `${originBase}/api/health`,
                    ...loopbackCandidates
                ].filter((value, index, self) => self.indexOf(value) === index);

                try {
                    try { console.debug('Health probe candidates:', candidates); } catch (e) {}
                    for (const url of candidates) {
                        if (!mounted) return;
                        try {
                            try { console.debug('Probing', url); } catch (e) {}
                            const res = await tryFetchWithTimeout(url);
                            try { console.debug('Probe result for', url, res.status); } catch (e) {}

                            // If the endpoint exists and returns 2xx, mark healthy and stop
                            if (res && res.ok) {
                                if (!mounted) return;
                                setBackendHealthy(true);
                                return;
                            }

                            // If 404 or other non-OK, try the next candidate instead of failing immediately
                            try { console.debug('Probe not OK, status:', res.status, 'for', url); } catch (e) {}
                            continue;
                        } catch (err) {
                            try { console.debug('Probe error for', url, err && (err as any).message); } catch (e) {}
                            // network error or timeout -> try next candidate
                            continue;
                        }
                    }

                    // none of the candidates responded OK
                    if (mounted) setBackendHealthy(false);
                } catch (err) {
                    if (mounted) setBackendHealthy(false);
                }
            };

        probeHealth();
        return () => { mounted = false; };
    }, []);

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
                {backendHealthy === false && (
                    <div className="text-sm text-red-600 mb-3">Connection issue: the backend API appears unreachable — some actions (register/login) may fail.</div>
                )}
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