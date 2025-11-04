import { User, Patient, Appointment, ClinicalNote, LabTest, Prescription, Referral, Organization } from '../types';

export const API_BASE_URL = window.location.origin;
const AUTH_TOKEN_KEY = 'chihealth_auth_token';

// --- Token Management ---
export const getAuthToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

// --- API Fetch Wrapper ---
const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  const response = await fetch(`/api${url}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized, clear token and force re-login
      clearAuthToken();
      window.location.href = '/'; 
    }
    const errorData = await response.json().catch(() => ({ message: 'An unknown API error occurred.' }));
    throw new Error(errorData.message);
  }
  
  if (response.headers.get('content-type')?.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

// --- Auth & User ---
export const fetchCurrentUser = (): Promise<User> => apiFetch('/users/me');

export const getSsoUserData = (tempToken: string): Promise<Partial<Patient>> => {
    return apiFetch(`/auth/sso/user-data?tempToken=${tempToken}`);
};

export const registerOrganizationAndAdmin = (orgData: any, adminData: any): Promise<{organization: Organization}> => {
    return apiFetch('/auth/register-org', {
        method: 'POST',
        body: JSON.stringify({ orgData, adminData }),
    });
};

export const switchOrganization = async (orgId: string): Promise<User> => {
    const { user, token } = await apiFetch('/users/switch-organization', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId }),
    });
    setAuthToken(token);
    // Reload the page to refetch all data for the new organization context
    window.location.reload();
    return user;
};
export const updateUser = (user: User): Promise<User> => {
    return apiFetch(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(user) });
};


// --- Patient Dashboard ---
export const fetchPatientData = () => apiFetch('/patient/dashboard');
export const bookAppointment = (appointment: Omit<Appointment, 'id' | 'status' | 'patientId'>) => {
  return apiFetch('/patient/appointments', {
    method: 'POST',
    body: JSON.stringify(appointment),
  });
};
export const simulateWearableData = () => apiFetch('/patient/simulate-wearable', { method: 'POST' });

// --- HCW Dashboard ---
export const fetchHcwData = () => apiFetch('/hcw/dashboard');
export const createClinicalNote = (note: Omit<ClinicalNote, 'id' | 'doctorId' | 'doctorName'>) => {
    return apiFetch('/hcw/notes', { method: 'POST', body: JSON.stringify(note) });
};
export const orderLabTest = (test: Omit<LabTest, 'id' | 'orderedById' | 'status'>) => {
    return apiFetch('/hcw/lab-tests', { method: 'POST', body: JSON.stringify(test) });
};
export const createPrescription = (rx: Omit<Prescription, 'id' | 'prescriberId'>) => {
    return apiFetch('/hcw/prescriptions', { method: 'POST', body: JSON.stringify(rx) });
};
export const referPatient = (referral: Omit<Referral, 'id' | 'fromDoctorId'>) => {
    return apiFetch('/hcw/referrals', { method: 'POST', body: JSON.stringify(referral) });
};


// --- Shared / Other Dashboards ---
export const sendMessage = (message: { recipientId: string; content: string; patientId?: string, senderId: string; }) => {
  return apiFetch('/messages', {
    method: 'POST',
    body: JSON.stringify(message),
  });
};
export const fetchAdminData = () => apiFetch('/admin/dashboard');
export const fetchPharmacistData = () => apiFetch('/pharmacist/dashboard');
export const fetchNurseData = () => apiFetch('/nurse/dashboard');
export const fetchLabTechnicianData = () => apiFetch('/lab/dashboard');
export const fetchReceptionistData = () => apiFetch('/receptionist/dashboard');
export const fetchLogisticsData = () => apiFetch('/logistics/dashboard');

// --- Command Center ---
export const fetchCommandCenterData = () => apiFetch('/command-center/dashboard');
export const admitPatient = (patientId: string, bedId: string, reason: string) => {
    return apiFetch('/command-center/admit', { method: 'POST', body: JSON.stringify({ patientId, bedId, reason }) });
};
export const dischargePatient = (patientId: string) => {
    return apiFetch('/command-center/discharge', { method: 'POST', body: JSON.stringify({ patientId }) });
};


// --- Updates ---
export const updatePrescriptionStatus = (id: string, status: Prescription['status']) => {
    return apiFetch(`/prescriptions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
};
export const updateLabTest = (id: string, status: LabTest['status'], result?: string) => {
    return apiFetch(`/lab-tests/${id}`, { method: 'PUT', body: JSON.stringify({ status, result }) });
};
export const checkInPatient = (appointmentId: string) => {
    return apiFetch(`/appointments/${appointmentId}/check-in`, { method: 'POST' });
};
export const saveVitals = (patientId: string, vitals: any) => {
    return apiFetch(`/triage/${patientId}/vitals`, { method: 'POST', body: JSON.stringify(vitals) });
};
export const updateTransportRequestStatus = (id: string, status: any) => {
    return apiFetch(`/transport/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
};
export const updateLabSampleStatus = (id: string, status: any) => {
    return apiFetch(`/lab-samples/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
};
export const linkOrganization = (childId: string, parentId: string) => {
    return apiFetch('/admin/organizations/link', { method: 'POST', body: JSON.stringify({ childId, parentId }) });
};
export const unlinkOrganization = (childId: string) => {
    return apiFetch('/admin/organizations/unlink', { method: 'POST', body: JSON.stringify({ childId }) });
};

// --- Facility Management ---
export const createDepartment = (name: string) => {
    return apiFetch('/admin/departments', { method: 'POST', body: JSON.stringify({ name }) });
};
export const createRoom = (name: string, type: string) => {
    return apiFetch('/admin/rooms', { method: 'POST', body: JSON.stringify({ name, type }) });
};
export const createBed = (name: string, roomId: string) => {
    return apiFetch('/admin/beds', { method: 'POST', body: JSON.stringify({ name, roomId }) });
};
