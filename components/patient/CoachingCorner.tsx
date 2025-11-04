import React, { useState, useEffect } from 'react';
import { Patient, CarePlan } from '../../types.ts';
import * as geminiService from '../../services/geminiService.ts';
import { BotMessageSquareIcon } from '../icons/index.tsx';
import { MarkdownRenderer } from '../common/MarkdownRenderer.tsx';

interface CoachingCornerProps {
  patient: Patient;
  carePlan: CarePlan;
}

export const CoachingCorner: React.FC<CoachingCornerProps> = ({ patient, carePlan }) => {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCoachingMessage = async () => {
      setIsLoading(true);
      try {
        const response = await geminiService.generateCoachingMessage(patient, carePlan);
        setMessage(response);
      } catch (error) {
        console.error("Failed to fetch coaching message", error);
        setMessage("Remember to take a moment for your health today!");
      } finally {
        setIsLoading(false);
      }
    };
    fetchCoachingMessage();
  }, [patient, carePlan]);

  return (
    <div className="coaching-card">
      <div className="coaching-card-icon">
        <BotMessageSquareIcon className="w-8 h-8" />
      </div>
      <div className="flex-1">
        <h3 className="coaching-card-title">Your AI Health Coach</h3>
        {isLoading ? (
          <div className="ai-insight-loading">
            <div className="ai-insight-loader-bar w-3/4"></div>
            <div className="ai-insight-loader-bar w-1/2"></div>
          </div>
        ) : (
          <div className="coaching-card-content">
            <MarkdownRenderer content={message} />
          </div>
        )}
      </div>
    </div>
  );
};