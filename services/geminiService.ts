import { GoogleGenAI, Type } from "@google/genai";
import { 
    Patient, 
    Appointment, 
    Prescription, 
    TriageSuggestion, 
    ClinicalNote, 
    LabTest,
    PredictiveRiskResult,
    CarePlan,
    InpatientStay,
    VitalTrendAlert,
    PharmacySafetyCheckResult,
    DiagnosticSuggestion,
    LifestyleRecommendation,
    ReferralSuggestion
} from '../types.ts';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const runChat = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `You are a helpful AI assistant for a healthcare platform. The user is asking the following: "${prompt}". Provide a helpful but general response. IMPORTANT: Do not provide medical advice. Always recommend consulting a doctor for health concerns.`,
  });
  return response.text;
};

export const getTriageSuggestion = async (symptoms: string): Promise<TriageSuggestion | null> => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `A patient reports the following symptoms: "${symptoms}". Based on these symptoms, suggest a medical specialty they should consult. Your response MUST be in JSON format. Do not add markdown backticks. The JSON should have three keys: "recommendation" (either "self-care" or "appointment"), "reasoning" (a brief explanation), and "specialty" (e.g., "Cardiology", "Dermatology", "General Practice"). If symptoms are very mild like 'a small scratch', recommend 'self-care'. For anything else, recommend 'appointment'.`,
        config: {
            responseMimeType: "application/json",
        },
    });

    try {
        const jsonText = response.text.trim();
        const suggestion = JSON.parse(jsonText);
        // Basic validation
        if (suggestion.recommendation && suggestion.reasoning && suggestion.specialty) {
            return suggestion as TriageSuggestion;
        }
        return null;
    } catch (e) {
        console.error("Failed to parse triage suggestion JSON:", e);
        return null;
    }
};

export const generateDailyBriefing = async (
  patient: Patient,
  appointments: Appointment[],
  prescriptions: Prescription[]
): Promise<string> => {
  const upcomingAppointment = appointments.find(a => new Date(a.date) >= new Date());
  
  const prompt = `Generate a concise, friendly, and encouraging daily health briefing for a patient named ${patient.name}.
  - Today's date is ${new Date().toDateString()}.
  - They have an upcoming appointment: ${upcomingAppointment ? `${upcomingAppointment.specialty} with ${upcomingAppointment.doctorName} on ${new Date(upcomingAppointment.date).toDateString()}` : 'None scheduled'}.
  - Their active prescriptions are: ${prescriptions.length > 0 ? prescriptions.map(p => p.medication).join(', ') : 'None'}.
  - Their latest wearable data shows: Heart Rate: ${patient.wearableData?.[patient.wearableData.length-1]?.heartRate} bpm, Steps: ${patient.wearableData?.[patient.wearableData.length-1]?.steps} steps.

  Format the output as simple markdown. Start with a greeting. If there's an appointment, remind them. If they have prescriptions, gently remind them to take their medication. Briefly comment on their activity level based on steps. Keep it under 80 words.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  return response.text;
};


export const generateEHRSummary = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<string> => {
    const prompt = `
        Summarize the Electronic Health Record for patient ${patient.name}, born ${patient.dateOfBirth}.
        This is for a clinician's quick review. Be concise and use bullet points.
        
        Recent Clinical Notes:
        ${notes.map(n => `- ${n.date}: Dr. ${n.doctorName} noted: "${n.content.substring(0, 100)}..."`).join('\n')}
        
        Recent Lab Results:
        ${labs.map(l => `- ${l.dateOrdered}: ${l.testName} - Result: ${l.result || l.status}`).join('\n')}
        
        Generate a summary covering major points, recent diagnoses, and outstanding results.
        Format the output using simple markdown with bolding for headers.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
};

export const getPredictiveRiskAnalysis = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<PredictiveRiskResult[]> => {
    const prompt = `Analyze the provided patient data to generate a predictive risk stratification for common chronic conditions.
    Patient: ${patient.name}, DOB: ${patient.dateOfBirth}.
    Key Clinical Notes: ${notes.slice(0, 2).map(n => n.content).join('; ')}
    Key Lab Results: ${labs.slice(0, 2).map(l => `${l.testName}: ${l.result}`).join('; ')}

    Return a JSON array with exactly two objects, one for 'Diabetes' and one for 'Hypertension'.
    Each object must have these keys:
    - "condition": string (e.g., "Diabetes")
    - "riskScore": number (a score from 0 to 100)
    - "riskLevel": string ("Low", "Medium", or "High")
    - "justification": string (a brief, one-sentence explanation for the score based on the data).
    
    Do not include markdown backticks in your response.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
    });

    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as PredictiveRiskResult[];
    } catch (e) {
        console.error("Failed to parse risk analysis JSON", e);
        // Return a fallback if parsing fails
        return [
            { condition: 'Diabetes', riskScore: 0, riskLevel: 'Low', justification: 'Error processing data.' },
            { condition: 'Hypertension', riskScore: 0, riskLevel: 'Low', justification: 'Error processing data.' }
        ];
    }
};

export const generateProactiveCarePlan = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<CarePlan> => {
    const prompt = `
    Based on the patient's full medical record, create a proactive and personalized care plan.
    Patient: ${patient.name}, DOB: ${patient.dateOfBirth}.
    Recent Notes: ${notes.slice(-2).map(n => n.content).join('; ')}
    Recent Labs: ${labs.slice(-2).map(l => `${l.testName}: ${l.result || l.status}`).join('; ')}

    Generate a JSON object that follows the specified schema. Do not include markdown backticks.
    The plan should be comprehensive, actionable, and preventative. Base your suggestions on the provided data.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    lifestyleRecommendations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING },
                                recommendation: { type: Type.STRING },
                                details: { type: Type.STRING }
                            },
                            required: ["category", "recommendation", "details"]
                        }
                    },
                    monitoringSuggestions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                parameter: { type: Type.STRING },
                                frequency: { type: Type.STRING },
                                notes: { type: Type.STRING }
                            },
                             required: ["parameter", "frequency", "notes"]
                        }
                    },
                    followUpAppointments: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                specialty: { type: Type.STRING },
                                timeframe: { type: Type.STRING },
                                reason: { type: Type.STRING }
                            },
                            required: ["specialty", "timeframe", "reason"]
                        }
                    },
                    diagnosticSuggestions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                testName: { type: Type.STRING },
                                reason: { type: Type.STRING }
                            },
                            required: ["testName", "reason"]
                        }
                    }
                },
                required: ["lifestyleRecommendations", "monitoringSuggestions", "followUpAppointments"]
            }
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as CarePlan;
};

export const generateDiagnosticSuggestions = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<DiagnosticSuggestion[]> => {
    const prompt = `Based on the patient's record, suggest relevant diagnostic tests.
    Patient: ${patient.name}, DOB: ${patient.dateOfBirth}.
    Recent Notes: ${notes.slice(-2).map(n => n.content).join('; ')}
    Recent Labs: ${labs.slice(-2).map(l => `${l.testName}: ${l.result || l.status}`).join('; ')}
    
    Return a JSON array of objects. Each object should have two keys: "testName" (string) and "reason" (string, a brief clinical justification).
    Suggest 1 to 3 relevant tests. If no tests seem necessary, return an empty array.
    Do not include markdown backticks.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        testName: { type: Type.STRING },
                        reason: { type: Type.STRING }
                    },
                    required: ["testName", "reason"]
                }
            }
        },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as DiagnosticSuggestion[];
};

export const generateLifestylePlan = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<LifestyleRecommendation[]> => {
    const prompt = `Based on the patient's record, create a personalized lifestyle and diet plan.
    Patient: ${patient.name}, DOB: ${patient.dateOfBirth}.
    Recent Notes: ${notes.slice(-2).map(n => n.content).join('; ')}
    Recent Labs: ${labs.slice(-2).map(l => `${l.testName}: ${l.result || l.status}`).join('; ')}

    Return a JSON array of objects. Each object must have "category" ('Diet' or 'Exercise'), "recommendation" (a specific goal), and "details" (actionable advice).
    Provide at least one diet and one exercise recommendation.
    Do not include markdown backticks.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        recommendation: { type: Type.STRING },
                        details: { type: Type.STRING }
                    },
                    required: ["category", "recommendation", "details"]
                }
            }
        },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as LifestyleRecommendation[];
};

export const generateReferralSuggestion = async (patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<ReferralSuggestion> => {
    const prompt = `Analyze the patient's record and suggest a specialty for referral if one seems appropriate.
    Patient: ${patient.name}, DOB: ${patient.dateOfBirth}.
    Recent Notes: ${notes.slice(-2).map(n => n.content).join('; ')}
    Recent Labs: ${labs.slice(-2).map(l => `${l.testName}: ${l.result || l.status}`).join('; ')}

    Return a JSON object with two keys: "specialty" (e.g., "Cardiology", "Endocrinology") and "reason" (a brief clinical justification).
    If no referral seems necessary, suggest "General Practice" for a routine follow-up.
    Do not include markdown backticks.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    specialty: { type: Type.STRING },
                    reason: { type: Type.STRING }
                },
                required: ["specialty", "reason"]
            }
        },
    });
    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as ReferralSuggestion;
};

export const generateCoachingMessage = async (patient: Patient, carePlan: CarePlan): Promise<string> => {
    const dietGoal = carePlan.lifestyleRecommendations.find(r => r.category === 'Diet')?.recommendation;
    const exerciseGoal = carePlan.lifestyleRecommendations.find(r => r.category === 'Exercise')?.recommendation;

    const prompt = `
    Generate a short, single-paragraph, encouraging coaching message for ${patient.name}.
    The message should be friendly and motivational, based on their care plan.
    - Their dietary goal is: "${dietGoal}".
    - Their exercise goal is: "${exerciseGoal}".
    Pick one of these goals and provide a gentle reminder or a positive tip.
    Do not sound robotic. Keep it under 50 words. Use simple markdown.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
};

export const generateNoteFromTranscript = async (transcript: string): Promise<string> => {
    const prompt = `
    Given the following transcript from a doctor-patient telemedicine call, generate a clinical note in SOAP format.
    The note should be professional, concise, and accurately reflect the conversation.
    
    Transcript:
    "${transcript}"

    Format the output as a single block of text, using markdown for headers (e.g., **Subjective:**, **Objective:**, **Assessment:**, **Plan:**).
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });
    return response.text;
};

export const generateAiChannelResponse = async (command: string, patient: Patient, notes: ClinicalNote[], labs: LabTest[]): Promise<string> => {
    let contextData = '';
    let query = '';

    if (command.toLowerCase().includes('summarize') || command.toLowerCase().includes('summary')) {
        contextData = `Notes: ${notes.slice(-1).map(n => n.content).join('. ')}. Labs: ${labs.slice(-1).map(l => `${l.testName}: ${l.result}`).join('. ')}.`;
        query = `Provide a very brief one-sentence summary of the patient's latest status based on the following: ${contextData}`;
    } else if (command.toLowerCase().includes('last note')) {
        contextData = notes.length > 0 ? notes[notes.length - 1].content : 'No notes available.';
        query = `Summarize this clinical note in one sentence: "${contextData}"`;
    } else if (command.toLowerCase().includes('last labs') || command.toLowerCase().includes('cbc')) {
        contextData = labs.length > 0 ? labs.filter(l => l.result).map(l => `${l.testName}: ${l.result}`).join(', ') : 'No lab results available.';
        query = `What are the latest lab results? Here is the data: ${contextData}`;
    } else {
        return "I can help with 'summarize', 'last note', or 'last labs'. Please try one of those.";
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
    });

    return response.text;
};

export const checkForVitalAnomalies = async (vitalHistory: InpatientStay['vitalHistory']): Promise<VitalTrendAlert | null> => {
    const prompt = `
    Analyze this series of recent vital signs for an inpatient. The data is ordered from oldest to newest.
    Data: ${JSON.stringify(vitalHistory.slice(-5))}
    
    Identify if there are any clinically concerning trends (e.g., consistent drop in SpO2, sudden spike in heart rate).
    
    If a concerning trend is detected, return a JSON object with the following keys:
    - "alertType": "critical" or "warning"
    - "summary": A very short summary of the issue (e.g., "SpO2 Declining").
    - "details": A one-sentence explanation of the trend (e.g., "Patient's oxygen saturation has dropped by 3% over the last 15 minutes.").
    
    If there are no concerning trends, return the string "null".
    Do not include markdown backticks in your response.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
    });

    const text = response.text.trim();
    if (text === 'null') {
        return null;
    }
    try {
        return JSON.parse(text) as VitalTrendAlert;
    } catch (e) {
        console.error("Failed to parse vital alert JSON", e);
        return null;
    }
};

export const runPharmacySafetyCheck = async (newMedication: string, existingMedications: string[]): Promise<PharmacySafetyCheckResult> => {
    const prompt = `
    A pharmacist is dispensing a new medication. Check for potential drug-to-drug interactions.
    New Medication: "${newMedication}"
    Patient's Existing Active Medications: ${JSON.stringify(existingMedications)}

    Analyze for interactions. Respond with a JSON object. Do not use markdown backticks.
    
    If there is a significant interaction:
    - "status": "warn"
    - "interactionSeverity": "Low", "Medium", or "High"
    - "interactionDetails": "Explain the specific interaction (e.g., 'Lisinopril and Potassium Chloride can lead to hyperkalemia.')."
    - "recommendation": "Suggest a clinical action (e.g., 'Monitor serum potassium levels.' or 'Consult with prescriber before dispensing.')."

    If there are no significant interactions:
    - "status": "pass"
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    status: { type: Type.STRING },
                    interactionSeverity: { type: Type.STRING },
                    interactionDetails: { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                },
                required: ["status"]
            }
        },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as PharmacySafetyCheckResult;
};