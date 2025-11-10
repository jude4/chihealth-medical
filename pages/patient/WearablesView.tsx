
import React, { useState } from 'react';
import { Patient } from '../../types.ts';
import { HeartPulseIcon, StepIcon, MoonIcon, RefreshCwIcon } from '../../components/icons/index.tsx';
import { Button } from '../../components/common/Button.tsx';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.tsx';
import { ConnectWearableModal } from './ConnectWearableModal.tsx';
import * as api from '../../services/apiService.ts';

interface WearablesViewProps {
    patient: Patient;
    onSimulateData: () => Promise<void>;
}

const MetricCard: React.FC<{ icon: React.ElementType, title: string, value: string, unit: string, color: string, lastUpdated?: string, sparkData?: number[], sparkColor?: string }> = ({ icon: Icon, title, value, unit, color, lastUpdated, sparkData, sparkColor }) => (
    <div className="content-card p-5">
        <div className="flex items-center gap-5">
            <div className={`rounded-full p-3 ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
                <p className="text-sm text-text-secondary">{title}</p>
                <p className="text-2xl font-bold text-text-primary">
                    {value} <span className="text-lg font-medium text-text-secondary">{unit}</span>
                </p>
            </div>
            {sparkData && sparkData.length > 0 && (
                <div style={{ width: 120, height: 40 }} className="flex items-center">
                    <Chart data={sparkData} color={sparkColor || 'rgba(107,114,128,0.2)'} />
                </div>
            )}
        </div>
        {lastUpdated ? <p className="text-xs text-text-secondary mt-3">Last updated: {new Date(lastUpdated).toLocaleString()}</p> : null}
    </div>
);

const Chart: React.FC<{ data: number[], color: string }> = ({ data, color }) => {
    const height = 120;
    if (data.length < 2) return <div style={{height: `${height}px`}} className="flex items-center justify-center text-text-tertiary text-xs">Not enough data for chart</div>;
    
    const maxVal = Math.max(...data, 1);

    return (
        <div className="flex items-end h-full gap-2 pt-4">
            {data.map((val, i) => (
                <div key={i} className="flex-1 rounded-t-md transition-all duration-300" style={{ height: `${(val / maxVal) * 100}%`, backgroundColor: color }}></div>
            ))}
        </div>
    );
};

export const WearablesView: React.FC<WearablesViewProps> = ({ patient, onSimulateData }) => {
    const [isSimulating, setIsSimulating] = useState(false);
    const [isModalOpen, setModalOpen] = useState(false);
    const [deviceToRemove, setDeviceToRemove] = useState<string | null>(null);
    const [_isRemoving, setIsRemoving] = useState(false);

    const handleSimulation = async () => {
        setIsSimulating(true);
        await onSimulateData();
        setIsSimulating(false);
    };

    const data = patient.wearableData || [];
    const today = new Date().toISOString().split('T')[0];
    
    const todaysData = data.find(d => d.timestamp.startsWith(today)) || data[data.length - 1];
    const lastNightData = data.find(d => new Date(d.timestamp).getDate() === new Date().getDate() - 1);

    const heartRateHistory = data.map(d => d.heartRate || 0).slice(-7);
    const stepHistory = data.map(d => d.steps || 0).slice(-7);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-text-primary">Health Metrics</h2>
                    <p className="text-text-secondary">Data from your connected wearable devices.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={() => setModalOpen(true)}>
                        Connect Wearable
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <MetricCard icon={HeartPulseIcon} title="Current Heart Rate" value={todaysData?.heartRate?.toString() ?? 'N/A'} unit="bpm" color="bg-red-500" lastUpdated={todaysData?.timestamp} sparkData={heartRateHistory} sparkColor="var(--error-color)" />
                <MetricCard icon={StepIcon} title="Today's Steps" value={todaysData?.steps?.toLocaleString() ?? 'N/A'} unit="steps" color="bg-sky-500" lastUpdated={todaysData?.timestamp} sparkData={stepHistory} sparkColor="#0284c7" />
                <MetricCard icon={MoonIcon} title="Last Night's Sleep" value={lastNightData?.sleepHours?.toString() ?? 'N/A'} unit="hours" color="bg-violet-500" lastUpdated={lastNightData?.timestamp} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="content-card p-6">
                    <h4 className="text-lg font-semibold text-primary mb-1">Heart Rate Trend</h4>
                    <p className="text-sm text-text-secondary mb-4">Last 7 days</p>
                    <div style={{ height: '120px' }}>
                       <Chart data={heartRateHistory} color="var(--error-color)" />
                    </div>
                 </div>
                 <div className="content-card p-6">
                    <h4 className="text-lg font-semibold text-primary mb-1">Steps Trend</h4>
                    <p className="text-sm text-text-secondary mb-4">Last 7 days</p>
                    <div style={{ height: '120px' }}>
                       <Chart data={stepHistory} color="#0284c7" />
                    </div>
                 </div>
            </div>
            
            <div className="content-card p-6 mt-6">
                <h4 className="text-lg font-semibold text-primary mb-2">Wearable Device Simulator</h4>
                <p className="text-sm text-text-secondary mb-4">This tool simulates receiving a new data point from your connected health device to demonstrate real-time updates.</p>
                <Button onClick={handleSimulation} isLoading={isSimulating}>
                    <RefreshCwIcon className={`w-5 h-5 mr-2 ${isSimulating ? 'animate-spin' : ''}`} />
                    Simulate New Data
                </Button>
            </div>
            {patient.wearableDevices && patient.wearableDevices.length > 0 && (
                <div className="content-card p-6 mt-6">
                    <h4 className="text-lg font-semibold text-primary mb-2">Connected Devices</h4>
                    <p className="text-sm text-text-secondary mb-4">The devices currently registered to your account.</p>
                    <ul className="space-y-3">
                        {patient.wearableDevices.map((d: any) => (
                            <li key={d.id} className="flex items-center justify-between p-3 border rounded">
                                <div>
                                    <div className="font-medium">{d.name}</div>
                                    <div className="text-xs text-text-secondary">{d.type} • added {new Date(d.addedAt).toLocaleString()}</div>
                                </div>
                                <div>
                                    <Button onClick={() => setDeviceToRemove(d.id)}>Remove</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <ConfirmationModal isOpen={!!deviceToRemove} onClose={() => setDeviceToRemove(null)} onConfirm={async () => {
                if (!deviceToRemove) return;
                setIsRemoving(true);
                try {
                    await api.removeWearableDevice(deviceToRemove);
                    setDeviceToRemove(null);
                    // trigger refresh
                    if (onSimulateData) await onSimulateData(); else await api.simulateWearableData();
                } catch (err) {
                    console.error('Failed to remove device', err);
                    // show toast if available
                } finally {
                    setIsRemoving(false);
                }
            }} title="Remove device" message="Are you sure you want to remove this device?" confirmText="Remove" cancelText="Cancel" type="danger" />
            <ConnectWearableModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} onConnected={async () => {
                // After connecting, trigger a fetch/refresh. Prefer the provided simulate handler if available.
                try {
                    if (onSimulateData) await onSimulateData();
                    else await api.simulateWearableData();
                } catch (err) {
                    console.warn('Failed to refresh wearable data after connect', err);
                }
            }} />
        </div>
    );
};