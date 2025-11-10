// This service now communicates with our Express backend API.
import { User, Patient } from '../types.ts';

/**
 * Registers a new user via the backend API.
 */
export const registerWithEmail = async (fullName: string, email: string, password: string): Promise<{ user: User }> => {
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password }),
    });
    const raw = await response.text().catch(() => '');
    if (!response.ok) {
        let parsed: any = { message: 'Registration failed' };
        if (raw) {
            try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
        }
        throw new Error(parsed.message || 'Registration failed');
    }
    if (!raw) return { user: {} as User };
    try { return { user: JSON.parse(raw) as User }; } catch { return { user: raw as any } }
};

/**
 * Signs in a user via the backend API and returns the user and token.
 */
export const signInWithEmail = async (email: string, password: string): Promise<{ user: User, token: string }> => {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    const raw = await response.text().catch(() => '');
    if (!response.ok) {
        let parsed: any = { message: 'Login failed' };
        if (raw) {
            try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
        }
        throw new Error(parsed.message || 'Login failed');
    }
    if (!raw) throw new Error('Login returned no data');
    try { return JSON.parse(raw); } catch { return raw as any }
};

/**
 * Initiates the live Google SSO flow by redirecting the user to the backend endpoint.
 */
export const signInWithSso = async (_provider: 'Google'): Promise<void> => {
    // The pre-flight check was fragile. The standard approach is to directly navigate
    // to the backend endpoint and let the browser handle the redirect chain.
    const authUrl = `/api/auth/google`;
    window.location.href = authUrl;
};


/**
 * Completes the registration for a new SSO user via the backend API.
 * This is called from the SsoComplete page.
 */
export const completeSsoRegistration = async (tempToken: string, details: { dateOfBirth: string }): Promise<{ user: Patient, token: string }> => {
    const response = await fetch('/api/auth/sso/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, ...details }),
    });
    const raw = await response.text().catch(() => '');
    if (!response.ok) {
        let parsed: any = { message: 'SSO completion failed' };
        if (raw) {
            try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
        }
        throw new Error(parsed.message || 'SSO completion failed');
    }
    if (!raw) throw new Error('SSO completion returned no data');
    try { return JSON.parse(raw); } catch { return raw as any }
};