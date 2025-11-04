

import React, { useMemo } from 'react';
import { User, Appointment, LabTest, Message } from '../../types.ts';
import { CalendarIcon, MessageSquareIcon, FlaskConicalIcon } from '../../components/icons/index.tsx';

interface HCWDashboardOverviewProps {
    user: User;
    appointments: Appointment[];
    messages: Message[];
    labTests: LabTest[];
}

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string }> = ({ icon: Icon, title, value, color }) => (
    <div className="stat-card">
        <div className={`stat-card-icon ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="stat-card-title">{title}</p>
            <p className="stat-card-value">{value}</p>
        </div>
    </div>
);

const WeeklyScheduleChart: React.FC<{ appointments: Appointment[] }> = ({ appointments }) => {
    const data = useMemo(() => {
        const counts = Array(7).fill(0);
        const labels = Array(7).fill(0).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        });

        appointments.forEach(appt => {
            const apptDate = new Date(appt.date);
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffDays = Math.floor((apptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if(diffDays >= 0 && diffDays < 7) {
                counts[diffDays]++;
            }
        });
        return { labels, counts };
    }, [appointments]);

    const maxCount = Math.max(...data.counts, 1);

    return (
        <div className="content-card p-6">
            <h3 className="font-semibold text-lg text-text-primary">Weekly Forecast</h3>
            <div className="flex justify-between items-end h-40 mt-4 gap-2">
                {data.counts.map((count, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end group">
                        <div className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity text-text-primary">{count}</div>
                        <div 
                            className="w-full bg-teal-500/50 dark:bg-teal-500/30 rounded-t-md group-hover:bg-teal-500 transition-all"
                            style={{ height: `${(count / maxCount) * 85}%`}}
                            title={`${count} appointments`}
                        ></div>
                        <div className="text-xs text-text-secondary mt-1">{data.labels[i]}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const HCWDashboardOverview: React.FC<HCWDashboardOverviewProps> = ({ user, appointments, messages, labTests }) => {
    const today = new Date().toISOString().split('T')[0];
    const todaysAppointments = appointments.filter(a => a.date === today);
    const unreadMessages = messages.length; // Mocking unread logic
    const pendingLabs = labTests.filter(t => t.status === 'Ordered' || t.status === 'In-progress');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-text-primary">Welcome back, {user.name.split(' ')[0]}!</h1>
                <p className="text-text-secondary">Here's a summary of your activities for today.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={CalendarIcon} title="Today's Appointments" value={todaysAppointments.length} color="bg-cyan-500" />
                <StatCard icon={MessageSquareIcon} title="Unread Messages" value={unreadMessages} color="bg-violet-500" />
                <StatCard icon={FlaskConicalIcon} title="Pending Lab Results" value={pendingLabs.length} color="bg-amber-500" />
            </div>

            <WeeklyScheduleChart appointments={appointments} />
        </div>
    );
};