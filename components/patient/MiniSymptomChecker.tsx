import React, { useState } from 'react';
// Fix: Add .tsx extension to local module import.
import { PatientView } from '../../pages/patient/PatientDashboard.tsx';
import { SparklesIcon } from '../icons/index.tsx';

interface MiniSymptomCheckerProps {
    setActiveView: (view: PatientView) => void;
}

export const MiniSymptomChecker: React.FC<MiniSymptomCheckerProps> = ({ setActiveView }) => {
    const [symptomInput, setSymptomInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // A future improvement could be to pass the symptomInput to the next view
        setActiveView('symptom-checker');
    };

    return (
        <div className="mini-symptom-checker-card">
            <div className="mini-symptom-checker-header">
                <SparklesIcon className="w-6 h-6 text-primary" />
                <h3 className="font-semibold text-text-primary">How are you feeling today?</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">Get instant information from our AI Health Assistant.</p>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={symptomInput}
                    onChange={(e) => setSymptomInput(e.target.value)}
                    placeholder="e.g., 'I have a headache and a fever...'"
                    className="mini-symptom-checker-input"
                />
                <button type="submit" className="btn btn-primary btn-full-width mt-2">
                    Check Symptoms
                </button>
            </form>
        </div>
    );
};