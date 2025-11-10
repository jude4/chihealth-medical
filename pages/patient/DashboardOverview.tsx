

import React, { useMemo, useState, useEffect } from 'react';
import { Patient, Appointment, Prescription, WearableDataPoint, Message, User, CarePlan } from '../../types.ts';
import { CalendarIcon, HeartPulseIcon, StepIcon, MoonIcon, SparklesIcon } from '../../components/icons/index.tsx';
import { HealthChart } from '../../components/common/HealthChart.tsx';
// Fix: Add .tsx extension to local module import.
import { PatientView } from './PatientDashboard.tsx';
import * as geminiService from '../../services/geminiService.ts';
import { MarkdownRenderer } from '../../components/common/MarkdownRenderer.tsx';
import { MiniSymptomChecker } from '../../components/patient/MiniSymptomChecker.tsx';
import { RecentMessages } from '../../components/patient/RecentMessages.tsx';
import { CoachingCorner } from '../../components/patient/CoachingCorner.tsx';

interface DashboardOverviewProps {
  user: Patient;
  appointments: Appointment[];
  prescriptions: Prescription[];
  messages: Message[];
  contacts: User[];
  carePlan?: CarePlan;
  t: (key: string) => string;
  setActiveView: (view: PatientView) => void;
}

const getGreeting = (t: (key: string) => string): string => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
}

const AIBriefingCard: React.FC<{ briefing: string; isLoading: boolean }> = ({ briefing, isLoading }) => (
  <div className="ai-insight-card">
    <div className="ai-insight-card-icon">
      <SparklesIcon />
    </div>
    <div className="flex-1">
      <h3 className="ai-insight-card-title">AI Daily Briefing</h3>
      {isLoading ? (
        <div className="ai-insight-loading">
          <div className="ai-insight-loader-bar w-3/4"></div>
          <div className="ai-insight-loader-bar w-1/2"></div>
        </div>
      ) : (
        <div className="ai-insight-card-content">
          <MarkdownRenderer content={briefing} />
        </div>
      )}
    </div>
  </div>
);

const HealthVitals: React.FC<{ wearableData: WearableDataPoint[] | undefined }> = ({ wearableData }) => {
    const data = wearableData || [];
    const latestData = data.length > 0 ? data[data.length - 1] : null;
    const lastNightData = data.find(d => new Date(d.timestamp).getDate() === new Date().getDate() - 1);

    // Prepare small sparkline data for heart rate & steps (last 7)
    const hrPoints = data.slice(-7).map(d => ({ value: d.heartRate || 0, label: new Date(d.timestamp).toLocaleDateString() }));
    const stepPoints = data.slice(-7).map(d => ({ value: d.steps || 0, label: new Date(d.timestamp).toLocaleDateString() }));

    return (
        <div className="content-card p-6">
            <h3 className="font-semibold text-lg text-text-primary mb-4">Health Vitals</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-full"><HeartPulseIcon className="w-6 h-6 text-red-500" /></div>
                        <div>
                            <p className="text-sm text-text-secondary">Heart Rate</p>
                            <p className="text-xl font-bold text-text-primary">{latestData?.heartRate ?? '--'} <span className="text-sm font-normal">bpm</span></p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <div style={{ height: '48px' }}><HealthChart data={hrPoints} color="#ef4444" unit="bpm" /></div>
                        <p className="text-xs text-text-secondary mt-1">Last updated: {latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-sky-500/10 rounded-full"><StepIcon className="w-6 h-6 text-sky-500" /></div>
                        <div>
                            <p className="text-sm text-text-secondary">Steps Today</p>
                            <p className="text-xl font-bold text-text-primary">{latestData?.steps?.toLocaleString() ?? '--'}</p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <div style={{ height: '48px' }}><HealthChart data={stepPoints} color="#0284c7" unit="steps" /></div>
                        <p className="text-xs text-text-secondary mt-1">Last updated: {latestData ? new Date(latestData.timestamp).toLocaleString() : 'N/A'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-500/10 rounded-full"><MoonIcon className="w-6 h-6 text-violet-500" /></div>
                        <div>
                            <p className="text-sm text-text-secondary">Last Sleep</p>
                            <p className="text-xl font-bold text-text-primary">{lastNightData?.sleepHours ?? '--'} <span className="text-sm font-normal">hrs</span></p>
                        </div>
                    </div>
                    <p className="text-xs text-text-secondary mt-2">Recorded: {lastNightData ? new Date(lastNightData.timestamp).toLocaleString() : 'N/A'}</p>
                </div>
            </div>
        </div>
    );
};

export const DashboardOverview: React.FC<DashboardOverviewProps> = (props) => {
  const [briefing, setBriefing] = useState('');
  const [isBriefingLoading, setIsBriefingLoading] = useState(true);

  const upcomingAppointment = useMemo(() => props.appointments
    .filter(a => new Date(`${a.date}T${a.time}`) >= new Date() && a.status === 'Confirmed')
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0], [props.appointments]);

  useEffect(() => {
    const fetchBriefing = async () => {
        if (!props.user) return;
        setIsBriefingLoading(true);
        try {
            const activePrescriptions = props.prescriptions.filter(p => p.status === 'Active');
            const response = await geminiService.generateDailyBriefing(props.user, props.appointments, activePrescriptions);
            setBriefing(response);
        } catch (e) {
            setBriefing('Could not load AI briefing at this time.');
        } finally {
            setIsBriefingLoading(false);
        }
    };
    fetchBriefing();
  }, [props.user, props.appointments, props.prescriptions]);

  const greeting = getGreeting(props.t);
  const appointmentDateTime = upcomingAppointment ? new Date(`${upcomingAppointment.date}T${upcomingAppointment.time}`) : null;

  return (
    <div className="space-y-8" style={{ animation: 'fadeIn 0.5s ease-out forwards' }}>
        <div>
            <h1 className="text-4xl font-bold text-text-primary">{greeting}, {props.user.name.split(' ')[0]}!</h1>
            <p className="text-text-secondary mt-1 text-lg">{props.t('whatToDo')}</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {props.carePlan ? (
                    <CoachingCorner patient={props.user} carePlan={props.carePlan} />
                ) : (
                    <AIBriefingCard briefing={briefing} isLoading={isBriefingLoading} />
                )}
                <HealthVitals wearableData={props.user.wearableData} />
                <MiniSymptomChecker setActiveView={props.setActiveView} />
            </div>

            <div className="space-y-6">
                {upcomingAppointment && (
                    <div className="content-card p-6">
                        <div className="flex items-center gap-3 mb-4">
                             <div className="p-3 bg-primary-light-bg rounded-full">
                                <CalendarIcon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-text-primary">{props.t('upcomingAppointment')}</h3>
                                <p className="text-sm text-text-secondary">
                                    {new Date(appointmentDateTime!).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                        <div className="bg-background-tertiary p-4 rounded-lg border border-border-primary">
                            <p className="font-bold text-lg text-text-primary">{appointmentDateTime?.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-text-secondary text-sm">{props.t('with')} <span className="font-medium text-text-primary">{upcomingAppointment.doctorName}</span></p>
                            <p className="text-primary text-sm font-semibold">{upcomingAppointment.specialty}</p>
                                {props.user.wearableDevices && props.user.wearableDevices.length > 0 && (
                                    <div className="content-card p-4">
                                        <h4 className="font-semibold text-lg mb-2">Connected Devices</h4>
                                        <ul className="text-sm text-text-secondary">
                                            {props.user.wearableDevices.slice(0,3).map(d => (
                                                <li key={d.id}>{d.name} • {d.type}</li>
                                            ))}
                                            {props.user.wearableDevices.length > 3 && <li className="mt-2 text-xs">And {props.user.wearableDevices.length - 3} more...</li>}
                                        </ul>
                                    </div>
                                )}
                        </div>
                    </div>
                )}
                <RecentMessages 
                    messages={props.messages} 
                    contacts={props.contacts} 
                    currentUser={props.user} 
                    setActiveView={props.setActiveView}
                />
            </div>
        </div>
    </div>
  );
};