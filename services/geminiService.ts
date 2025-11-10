// Client-safe Gemini proxy wrapper
// This module proxies AI prompts to the backend endpoint /api/ai/generate.


import { API_BASE_URL } from './apiService.ts';
import type { VitalTrendAlert } from '../types';

export type RunModelPayload = { model: string; contents: string; config?: any };

async function callAiProxy(payload: RunModelPayload): Promise<string> {
  const url = `${API_BASE_URL}/api/ai/generate`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout for AI
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    let parsed: any = { message: 'AI server error' };
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { parsed = { message: raw }; }
    }
    throw new Error(parsed.error || parsed.message || 'AI server error');
  }

  if (!raw) return '';
  try { const json = JSON.parse(raw); return (json.text ?? json.output ?? '') as string; } catch { 
    // If backend returned raw text (dev stub), return it as-is.
    return raw;
  }
}

function sanitizeAiText(text: string) {
  if (!text) return text;
  // Strip dev stub prefix like: (dev AI) Response for model=...\n\n
  const stripped = text.replace(/^\(dev AI\)[\s\S]*?\n\n/, '');
  return stripped.trim();
}

export const runModel = async (payload: RunModelPayload) => callAiProxy(payload);
export const runChat = async (prompt: string) => runModel({ model: 'gemini-2.5-flash', contents: prompt });
export const getTriageSuggestion = async (symptoms: string) => runModel({ model: 'gemini-2.5-flash', contents: symptoms });

export async function generateEHRSummary(a: any, b?: any, c?: any) {
  let prompt: string;
  if (typeof a === 'string' && b === undefined && c === undefined) {
    prompt = a;
  } else {
    const patient = a;
    const clinicalNotes = Array.isArray(b) ? b : [];
    const labTests = Array.isArray(c) ? c : [];
    prompt = `Please write a concise EHR summary for the following patient record. Patient:\n${JSON.stringify(patient, null, 2)}\n\nClinical Notes:\n${JSON.stringify(clinicalNotes, null, 2)}\n\nLab Tests:\n${JSON.stringify(labTests, null, 2)}\n\nReturn a short, structured summary suitable for providers.`;
  }
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  return text;
}

export const generateDailyBriefing = async (briefingPrompt: string | any, appointments?: any, prescriptions?: any) => {
  // If caller passed structured data, build a prompt; otherwise treat as raw prompt string.
  let prompt: string;
  if (typeof briefingPrompt === 'string' && appointments === undefined && prescriptions === undefined) {
    prompt = briefingPrompt;
  } else {
    const patient = briefingPrompt;
    prompt = `Daily briefing for patient ${patient?.name || ''} with appointments: ${JSON.stringify(appointments || [])} and prescriptions: ${JSON.stringify(prescriptions || [])}`;
  }
  return runModel({ model: 'gemini-2.5-flash', contents: prompt });
};

export async function checkForVitalAnomalies(vitals: any[]): Promise<VitalTrendAlert | null> {
  // Lightweight local heuristic for demo: flag if any vitals outside expected ranges
  if (!Array.isArray(vitals) || vitals.length === 0) return null;
  const issues: string[] = [];
  vitals.forEach(v => {
    const spO2 = v.spO2 ?? v.spo2 ?? v.sp_o2;
    if (v.heartRate && (v.heartRate < 40 || v.heartRate > 130)) issues.push(`Abnormal heart rate: ${v.heartRate}`);
    if (typeof spO2 === 'number' && spO2 < 90) issues.push(`Low SpO2: ${spO2}`);
    if (v.steps && v.steps > 100000) issues.push(`Suspicious step count: ${v.steps}`);
  });

  if (issues.length === 0) return null;

  const severity = issues.some(i => /Abnormal|Low|Suspicious/i.test(i)) ? 'critical' : 'warning';
  const summary = severity === 'critical' ? 'Critical vital sign anomalies detected' : 'Vital sign anomalies detected';
  return {
    alertType: severity as 'critical' | 'warning',
    summary,
    details: issues.join('; '),
  } as VitalTrendAlert;
}

export async function generateAiChannelResponse(command: string, patient: any, patientNotes: any[], patientLabs: any[]) {
  const prompt = `You are a clinical assistant.\nCommand: ${command}\n\nPatient:\n${JSON.stringify(patient, null, 2)}\n\nRecent notes:\n${JSON.stringify(patientNotes, null, 2)}\n\nRecent labs:\n${JSON.stringify(patientLabs, null, 2)}\n\nProvide a concise, helpful response suitable for insertion into the messaging channel.`;
  return await runModel({ model: 'gemini-2.5-flash', contents: prompt });
}

export async function runPharmacySafetyCheck(medication: string, existingMedications: string[]) {
  const prompt = `You are a pharmacist safety check assistant. Analyze the following medication for potential interactions, duplications, or contraindications with the patient's current medication list.\n\nMedication under review: ${medication}\n\nCurrent medications: ${existingMedications.length ? existingMedications.join(', ') : '(none)'}\n\nReturn a short JSON object with keys:\n- issues: array of strings describing any problems\n- severity: one of "ok", "caution", "high"\n- advice: a concise suggestion for the pharmacist.`;
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  try { return JSON.parse(text); } catch { return text; }
}

export async function generateProactiveCarePlan(patient: any, clinicalNotes: any[], labTests: any[]) {
  const prompt = `Generate a comprehensive proactive care plan for the patient. Patient:\n${JSON.stringify(patient, null, 2)}\n\nClinical notes:\n${JSON.stringify(clinicalNotes, null, 2)}\n\nLab tests:\n${JSON.stringify(labTests, null, 2)}\n\nReturn a JSON object summarizing recommended monitoring, lifestyle changes, follow-ups, and medication suggestions.`;
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  try { return JSON.parse(text); } catch { return text; }
}

export async function generateDiagnosticSuggestions(patient: any, clinicalNotes: any[], labTests: any[]) {
  const prompt = `Based on the patient record below, suggest likely diagnostic tests or imaging to consider. Patient:\n${JSON.stringify(patient, null, 2)}\n\nClinical notes:\n${JSON.stringify(clinicalNotes, null, 2)}\n\nLab tests:\n${JSON.stringify(labTests, null, 2)}\n\nReturn a JSON array of suggestions with brief rationale.`;
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  try { return JSON.parse(text); } catch { return text; }
}

export async function generateLifestylePlan(patient: any, clinicalNotes: any[], labTests: any[]) {
  const prompt = `Create a concise lifestyle and diet recommendation for this patient based on their record. Patient:\n${JSON.stringify(patient, null, 2)}\n\nClinical notes:\n${JSON.stringify(clinicalNotes, null, 2)}\n\nLab tests:\n${JSON.stringify(labTests, null, 2)}\n\nReturn a JSON array of recommendations.`;
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  try { return JSON.parse(text); } catch { return text; }
}

export async function generateReferralSuggestion(patient: any, clinicalNotes: any[], labTests: any[]) {
  const prompt = `Recommend specialty referral options for this patient based on the record. Patient:\n${JSON.stringify(patient, null, 2)}\n\nClinical notes:\n${JSON.stringify(clinicalNotes, null, 2)}\n\nLab tests:\n${JSON.stringify(labTests, null, 2)}\n\nReturn a short JSON object with recommended specialties and rationale.`;
  const text = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  try { return JSON.parse(text); } catch { return text; }
}

export async function generateCoachingMessage(patient: any, carePlan: any) {
  const prompt = `You are a friendly health coach. Given the patient record:\n${JSON.stringify(patient, null, 2)}\n\nAnd the care plan:\n${JSON.stringify(carePlan, null, 2)}\n\nProduce a short, encouraging coaching message (1-3 sentences) focused on adherence and simple actionable steps.`;
  const raw = await runModel({ model: 'gemini-2.5-flash', contents: prompt });
  const cleaned = sanitizeAiText(raw);

  // If the dev stub simply echoed the prompt or returned JSON, fall back to a simple local message
  const looksLikeJsonEcho = /^\s*\{/.test(cleaned) || cleaned.includes(JSON.stringify(patient).slice(0, 40));
  if (looksLikeJsonEcho) {
    const name = patient?.name ? String(patient.name).split(' ')[0] : 'there';
    return `Hi ${name}, small steps make a big difference — follow your care plan, take medications as prescribed, and contact your care team if you notice any new or worsening symptoms.`;
  }

  return cleaned;
}

export default {
  runModel,
  runChat,
  getTriageSuggestion,
  generateEHRSummary,
  generateDailyBriefing,
  generateAiChannelResponse,
  runPharmacySafetyCheck,
  generateProactiveCarePlan,
  generateDiagnosticSuggestions,
  generateLifestylePlan,
  generateReferralSuggestion,
  generateCoachingMessage,
};
