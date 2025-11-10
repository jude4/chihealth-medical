import React, { useState } from 'react';
import { Patient, LabTest, ClinicalNote, User, Prescription, Referral, CarePlan, CarePlanAdherence, DiagnosticSuggestion, LifestyleRecommendation, ReferralSuggestion } from '../../types.ts';
import { Button } from './Button.tsx';
import { SparklesIcon, TargetIcon, MicroscopeIcon, DietIcon, RepeatIcon, DownloadCloudIcon } from '../icons/index.tsx';
import { AISummaryModal } from './AISummaryModal.tsx';
import * as geminiService from '../../services/geminiService.ts';
import { ClinicalNoteModal } from '../hcw/ClinicalNoteModal.tsx';
import { CreatePrescriptionModal } from '../../pages/hcw/CreatePrescriptionModal.tsx';
// Fix: Add .tsx extension to local module import.
import { OrderLabTestModal } from '../../pages/hcw/OrderLabTestModal.tsx';
import { ReferralModal } from '../hcw/ReferralModal.tsx';
import { CarePlanDisplay } from '../hcw/CarePlanDisplay.tsx';
import { CarePlanAdherenceView } from '../hcw/CarePlanAdherenceView.tsx';
import { DiagnosticSuggestionsModal } from '../hcw/DiagnosticSuggestionsModal.tsx';
import { LifestylePlanModal } from '../hcw/LifestylePlanModal.tsx';
import { ReferralSuggestionModal } from '../hcw/ReferralSuggestionModal.tsx';
import { useToasts } from '../../hooks/useToasts.ts';
import { canAccessFeature } from '../../services/permissionService.ts';

interface EHRViewProps {
  patient: Patient;
  currentUser: User;
  labTests: LabTest[];
  clinicalNotes: ClinicalNote[];
  carePlan?: CarePlan;
  carePlanAdherence?: CarePlanAdherence;
  onDownload: () => void;
  onBack?: () => void;
  // HCW-specific actions
  onCreateClinicalNote?: (note: Omit<ClinicalNote, 'id' | 'doctorId' | 'doctorName'>) => void;
  onOrderLabTest?: (test: Omit<LabTest, 'id' | 'orderedById' | 'status'>) => void;
  onCreatePrescription?: (rx: Omit<Prescription, 'id' | 'prescriberId'>) => void;
  onReferPatient?: (referral: Omit<Referral, 'id'| 'fromDoctorId'>) => void;
}

const GeneratingState: React.FC<{ title?: string }> = ({ title = "Proactive Care Plan" }) => (
    <div className="recommendation-generating-state">
        <SparklesIcon className="generating-icon" />
        <h4 className="generating-title">Generating {title}...</h4>
        <p className="generating-subtitle">Our AI is analyzing the patient's record to create personalized recommendations. This may take a moment.</p>
        <ul className="generating-steps">
            <li>Analyzing clinical notes & history...</li>
            <li>Evaluating recent lab results...</li>
            <li>Cross-referencing latest medical guidelines...</li>
            <li>Formulating personalized recommendations...</li>
        </ul>
    </div>
);


export const EHRView: React.FC<EHRViewProps> = (props) => {
  const isHcw = props.currentUser.role === 'hcw';
  const { addToast } = useToasts();
  const [isSummaryModalOpen, setSummaryModalOpen] = useState(false);
  const [isNoteModalOpen, setNoteModalOpen] = useState(false);
  const [isRxModalOpen, setRxModalOpen] = useState(false);
  const [isLabModalOpen, setLabModalOpen] = useState(false);
  const [isReferralModalOpen, setReferralModalOpen] = useState(false);
  
  const [summary, setSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [showAdherence, setShowAdherence] = useState(false);

  // State for the recommendation wizard
  type WizardStep = 'selection' | 'generating' | 'review';
  const [wizardStep, setWizardStep] = useState<WizardStep>('selection');
  const [generatedPlan, setGeneratedPlan] = useState<CarePlan | null>(null);

  // State for other recommendation modals
  const [isDiagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);
  const [diagnosticSuggestions, setDiagnosticSuggestions] = useState<DiagnosticSuggestion[] | null>(null);
  const [isLifestyleModalOpen, setLifestyleModalOpen] = useState(false);
  const [lifestylePlan, setLifestylePlan] = useState<LifestyleRecommendation[] | null>(null);
  const [isReferralSuggestionModalOpen, setReferralSuggestionModalOpen] = useState(false);
  const [referralSuggestion, setReferralSuggestion] = useState<ReferralSuggestion | null>(null);
  const [isLoadingRecommendation, setIsLoadingRecommendation] = useState(false);


  const activeCarePlan = props.carePlan;

  const recommendationOptions = [
    { type: 'care_plan', title: 'Full Proactive Care Plan', description: 'Generate a comprehensive plan including lifestyle, monitoring, and follow-ups.', icon: SparklesIcon, feature: 'ai_proactive_care' },
    { type: 'diagnostics', title: 'Diagnostic Suggestions', description: 'Get suggestions for relevant lab tests or imaging based on patient data.', icon: MicroscopeIcon, feature: 'ai_proactive_care' },
    { type: 'lifestyle', title: 'Lifestyle & Diet Plan', description: 'Create a personalized diet and exercise plan for the patient.', icon: DietIcon, feature: 'ai_proactive_care' },
    { type: 'referral', title: 'Referral Suggestion', description: 'Receive a recommendation for which specialty to refer the patient to.', icon: RepeatIcon, feature: 'ai_proactive_care' },
  ];

  const handleGenerateSummary = async () => {
    setSummaryModalOpen(true);
    setIsLoadingSummary(true);
    try {
      const result = await geminiService.generateEHRSummary(props.patient, props.clinicalNotes, props.labTests);
  setSummary(result && result.length ? result : 'No summary could be generated.');
    } catch (e) {
  const msg = (e && (e as any).message) ? (e as any).message : 'Failed to generate summary.';
  setSummary(`Error: ${msg}`);
  addToast(`AI Summary failed: ${msg}`, 'error');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleGenerateCarePlan = async () => {
    setWizardStep('generating');
    setGeneratedPlan(null);
    try {
        const plan = await geminiService.generateProactiveCarePlan(props.patient, props.clinicalNotes, props.labTests);
        setGeneratedPlan(plan);
        setWizardStep('review');
    } catch (error) {
        console.error("Failed to generate care plan", error);
        addToast("An error occurred while generating the care plan. Please try again.", 'error');
        setWizardStep('selection');
    }
  };
  
  const handleGenerateDiagnostics = async () => {
    setIsLoadingRecommendation(true);
    setDiagnosticsModalOpen(true);
    setDiagnosticSuggestions(null);
    try {
        const suggestions = await geminiService.generateDiagnosticSuggestions(props.patient, props.clinicalNotes, props.labTests);
        setDiagnosticSuggestions(suggestions);
    } catch(e) {
        console.error(e);
        addToast("Failed to generate suggestions.", 'error');
        setDiagnosticsModalOpen(false);
    } finally {
        setIsLoadingRecommendation(false);
    }
  };

  const handleGenerateLifestyle = async () => {
    setIsLoadingRecommendation(true);
    setLifestyleModalOpen(true);
    setLifestylePlan(null);
    try {
        const plan = await geminiService.generateLifestylePlan(props.patient, props.clinicalNotes, props.labTests);
        setLifestylePlan(plan);
    } catch(e) {
        console.error(e);
        addToast("Failed to generate plan.", 'error');
        setLifestyleModalOpen(false);
    } finally {
        setIsLoadingRecommendation(false);
    }
  };

  const handleGenerateReferral = async () => {
    setIsLoadingRecommendation(true);
    setReferralSuggestionModalOpen(true);
    setReferralSuggestion(null);
    try {
        const suggestion = await geminiService.generateReferralSuggestion(props.patient, props.clinicalNotes, props.labTests);
        setReferralSuggestion(suggestion);
    } catch(e) {
        console.error(e);
        addToast("Failed to generate suggestion.", 'error');
        setReferralSuggestionModalOpen(false);
    } finally {
        setIsLoadingRecommendation(false);
    }
  };

  const handleRecommendationClick = (type: string) => {
    switch(type) {
        case 'care_plan': return handleGenerateCarePlan();
        case 'diagnostics': return handleGenerateDiagnostics();
        case 'lifestyle': return handleGenerateLifestyle();
        case 'referral': return handleGenerateReferral();
        default: addToast(`Coming soon: ${type}`, 'info');
    }
  }
  
  const handleSavePlan = () => {
    // In a real app, this would trigger an API call to save the plan.
    addToast("Care plan saved to patient's EHR!", 'success');
    setWizardStep('selection');
    setGeneratedPlan(null);
    // You would then trigger a data refresh to show the new active plan.
  };

  const handleDiscardPlan = () => {
    setWizardStep('selection');
    setGeneratedPlan(null);
  };

  const renderWizardContent = () => {
    switch(wizardStep) {
        case 'generating':
            return <GeneratingState />;
        case 'review':
            if (!generatedPlan) return <p>An error occurred.</p>;
            return (
                <div>
                    <CarePlanDisplay plan={generatedPlan} />
                    <div className="flex justify-end gap-4 mt-6">
                        <Button onClick={handleDiscardPlan} className="btn-secondary">Discard</Button>
                        <Button onClick={handleSavePlan}>Save to EHR</Button>
                    </div>
                </div>
            );
        case 'selection':
        default:
            return (
                <>
                    <p className="text-sm text-text-secondary mb-4">
                        Step 1: What would you like help with?
                    </p>
                    <div className="recommendation-wizard-grid">
                        {recommendationOptions
                          .filter(opt => canAccessFeature(props.currentUser, opt.feature))
                          .map(opt => (
                            <button 
                                key={opt.type} 
                                className="recommendation-wizard-card" 
                                onClick={() => handleRecommendationClick(opt.type)}
                            >
                                <div className="recommendation-wizard-card-icon">
                                    <opt.icon />
                                </div>
                                <h4 className="recommendation-wizard-card-title">{opt.title}</h4>
                                <p className="recommendation-wizard-card-description">{opt.description}</p>
                            </button>
                        ))}
                    </div>
                </>
            );
    }
  }


  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-text-primary">Electronic Health Record</h2>
          <p className="text-text-secondary">Patient: {props.patient.name} (ID: {props.patient.id})</p>
        </div>
        <div className="ehr-actions">
          <div className="ehr-action-left">
            {props.onBack && <Button onClick={props.onBack}>&larr; Back to Patients</Button>}
          </div>
          <div className="ehr-action-buttons">
            <Button onClick={props.onDownload} aria-label="Download medical record PDF">
              <DownloadCloudIcon className="w-5 h-5 mr-2" />
              Download PDF
            </Button>
            {canAccessFeature(props.currentUser, 'ai_summary') && (
              <Button onClick={handleGenerateSummary} style={{ backgroundColor: 'var(--violet-500)', color: 'white' }}>
                <SparklesIcon className="w-5 h-5 mr-2" />
                AI Summary
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {isHcw && (
        <div className="mb-6 p-4 bg-background-secondary border border-border-primary rounded-lg flex flex-wrap gap-4 justify-center">
            <Button onClick={() => setNoteModalOpen(true)}>Add Clinical Note</Button>
            {canAccessFeature(props.currentUser, 'prescribing') && <Button onClick={() => setRxModalOpen(true)}>Create Prescription</Button>}
            {canAccessFeature(props.currentUser, 'lab') && <Button onClick={() => setLabModalOpen(true)}>Order Lab Test</Button>}
            <Button onClick={() => setReferralModalOpen(true)}>Refer Patient</Button>
        </div>
      )}

      <div className="space-y-6">
         {/* Demographics */}
        <div className="content-card">
            <h3 className="card-header p-6 font-semibold text-lg text-text-primary">Patient Information</h3>
            <div className="p-6 pt-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="font-semibold text-text-secondary">Full Name</p><p>{props.patient.name}</p></div>
                <div><p className="font-semibold text-text-secondary">Date of Birth</p><p>{props.patient.dateOfBirth}</p></div>
                <div><p className="font-semibold text-text-secondary">Email</p><p>{props.patient.email}</p></div>
                <div><p className="font-semibold text-text-secondary">Last Visit</p><p>{props.patient.lastVisit}</p></div>
            </div>
        </div>
        
        {/* AI Proactive Care & Recommendation Modules */}
        {isHcw && activeCarePlan && !generatedPlan && (
            <div className="content-card">
                <div className="p-6">
                <h3 className="font-semibold text-lg text-text-primary">Current Proactive Care Plan</h3>
                
                <CarePlanDisplay plan={activeCarePlan} />
                
                {props.carePlanAdherence && (
                    <div className="mt-6 text-center border-t border-border-primary pt-6">
                        <Button onClick={() => setShowAdherence(!showAdherence)} style={{backgroundColor: 'var(--teal-700)'}}>
                            <TargetIcon className="w-5 h-5 mr-2" />
                            {showAdherence ? 'Hide Adherence Report' : 'View Adherence Report'}
                        </Button>
                    </div>
                )}

                {showAdherence && props.carePlanAdherence && (
                    <CarePlanAdherenceView plan={activeCarePlan} adherence={props.carePlanAdherence} />
                )}
                </div>
            </div>
        )}
        
        {isHcw && canAccessFeature(props.currentUser, 'ai_proactive_care') && (
            <div className="content-card">
                <div className="p-6">
                    <h3 className="font-semibold text-lg text-text-primary">AI Recommendation Assistant</h3>
                    {renderWizardContent()}
                </div>
            </div>
        )}


        {/* Clinical Notes */}
        <div className="content-card">
            <h3 className="card-header p-6 font-semibold text-lg text-text-primary">Clinical Notes</h3>
            <div className="p-6 pt-0 space-y-4">
               {props.clinicalNotes.map(note => (
                    <div key={note.id} className="p-4 bg-background-tertiary rounded-md">
                        <p className="text-sm font-semibold text-text-secondary">
                            {new Date(note.date).toDateString()} - Dr. {note.doctorName}
                        </p>
                        <p className="whitespace-pre-wrap mt-2 text-sm">{note.content}</p>
                    </div>
                ))}
                 {props.clinicalNotes.length === 0 && <p className="text-text-secondary text-center py-4">No clinical notes recorded.</p>}
            </div>
        </div>
        
        {/* Lab Test Results */}
        <div className="content-card">
          <h3 className="card-header p-6 font-semibold text-lg text-text-primary">Lab Test Results</h3>
          <table className="styled-table">
            <thead><tr><th>Date</th><th>Test Name</th><th>Result</th><th>Status</th></tr></thead>
            <tbody>
              {props.labTests.map(test => (
                <tr key={test.id}>
                  <td>{test.dateOrdered}</td>
                  <td>{test.testName}</td>
                  <td className="font-mono">{test.result || 'Pending'}</td>
                  <td><span className="status-chip status-chip-slate">{test.status}</span></td>
                </tr>
              ))}
               {props.labTests.length === 0 && <tr><td colSpan={4} className="text-center text-text-secondary py-8">No lab tests found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AISummaryModal isOpen={isSummaryModalOpen} onClose={() => setSummaryModalOpen(false)} summary={summary} isLoading={isLoadingSummary} />
      {isHcw && props.onCreateClinicalNote && <ClinicalNoteModal isOpen={isNoteModalOpen} onClose={() => setNoteModalOpen(false)} patient={props.patient} doctor={props.currentUser} onSave={(note) => { props.onCreateClinicalNote!(note); setNoteModalOpen(false); }} />}
      {isHcw && props.onCreatePrescription && canAccessFeature(props.currentUser, 'prescribing') && <CreatePrescriptionModal isOpen={isRxModalOpen} onClose={() => setRxModalOpen(false)} patients={[props.patient]} onCreatePrescription={(rx) => { props.onCreatePrescription!(rx); setRxModalOpen(false); }} />}
      {isHcw && props.onOrderLabTest && canAccessFeature(props.currentUser, 'lab') && <OrderLabTestModal isOpen={isLabModalOpen} onClose={() => setLabModalOpen(false)} patient={props.patient} onOrderLabTest={(test) => { props.onOrderLabTest!(test); setLabModalOpen(false); }} />}
      {isHcw && props.onReferPatient && <ReferralModal isOpen={isReferralModalOpen} onClose={() => setReferralModalOpen(false)} patient={props.patient} onReferPatient={(referral) => { props.onReferPatient!(referral); setReferralModalOpen(false); }} />}
      
      {/* AI Recommendation Modals */}
      <DiagnosticSuggestionsModal 
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
        isLoading={isLoadingRecommendation}
        suggestions={diagnosticSuggestions}
        onSave={() => { addToast('Suggestions saved to a new draft clinical note.', 'success'); setDiagnosticsModalOpen(false); }}
      />
      <LifestylePlanModal
        isOpen={isLifestyleModalOpen}
        onClose={() => setLifestyleModalOpen(false)}
        isLoading={isLoadingRecommendation}
        recommendations={lifestylePlan}
        onSave={() => { addToast("Lifestyle plan saved and added to the patient's active care plan.", 'success'); setLifestyleModalOpen(false); }}
      />
      <ReferralSuggestionModal
        isOpen={isReferralSuggestionModalOpen}
        onClose={() => setReferralSuggestionModalOpen(false)}
        isLoading={isLoadingRecommendation}
        suggestion={referralSuggestion}
        onSave={() => { setReferralSuggestionModalOpen(false); setReferralModalOpen(true); }}
      />
    </>
  );
};