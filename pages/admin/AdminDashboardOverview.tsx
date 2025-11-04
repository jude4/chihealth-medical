import React from 'react';
import { UsersIcon, BuildingIcon, DollarSignIcon, CalendarIcon, BedIcon } from '../../components/icons';

interface AdminDashboardOverviewProps {
  staffCount: number;
  patientCount: number;
  appointmentCount: number;
  totalRevenue: number;
}

const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string | number, color: string }> = ({ icon: Icon, title, value, color }) => (
    <div className="stat-card">
        <div className={`stat-card-icon ${color}`}>
            <Icon className="w-7 h-7 text-white" />
        </div>
        <div>
            <p className="stat-card-title">{title}</p>
            <p className="stat-card-value">{value}</p>
        </div>
    </div>
);

const RevenueChart: React.FC<{ totalRevenue: number }> = ({ totalRevenue }) => {
    // Mock data for previous months for demonstration
    const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
    const mockData = [
        totalRevenue * 0.4,
        totalRevenue * 0.6,
        totalRevenue * 0.5,
        totalRevenue * 0.8,
        totalRevenue * 0.7,
        totalRevenue,
    ];
    const maxRevenue = Math.max(...mockData, 1);

    return (
        <div className="content-card h-full p-6">
             <h3 className="font-semibold text-lg text-text-primary">Revenue Overview</h3>
             <p className="text-sm text-text-secondary">Last 6 months</p>
             <div className="flex justify-between items-end h-64 mt-4 gap-4">
                {mockData.map((revenue, i) => (
                    <div key={months[i]} className="flex-1 flex flex-col items-center justify-end group">
                         <div 
                            className="w-full bg-green-500/50 dark:bg-green-500/30 rounded-t-lg group-hover:bg-green-500 transition-all"
                            style={{ height: `${(revenue / maxRevenue) * 90}%`}}
                            title={`₦${revenue.toLocaleString()}`}
                        ></div>
                        <div className="text-xs text-text-secondary mt-2">{months[i]}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = (props) => (
    <div className="space-y-6">
        <h2 className="text-3xl font-bold text-text-primary">Platform Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={UsersIcon} title="Total Patients" value={props.patientCount.toLocaleString()} color="bg-cyan-500" />
            <StatCard icon={UsersIcon} title="Total Staff" value={props.staffCount.toLocaleString()} color="bg-violet-500" />
            <StatCard icon={BedIcon} title="Bed Occupancy" value="76%" color="bg-amber-500" />
            <StatCard icon={DollarSignIcon} title="Total Revenue" value={`₦${props.totalRevenue.toLocaleString()}`} color="bg-green-500" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <RevenueChart totalRevenue={props.totalRevenue} />
            </div>
            <div className="content-card p-6">
                 <h3 className="font-semibold text-lg text-text-primary mb-4">Recent Activity</h3>
                 <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                        <div className="bg-green-500/20 text-green-500 dark:text-green-400 rounded-full p-2"><UsersIcon className="w-4 h-4" /></div>
                        <p className="text-sm text-text-secondary"><span className="font-semibold text-text-primary">New Patient</span> registration for 'Amina Bello'.</p>
                    </li>
                     <li className="flex items-start gap-3">
                        <div className="bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 rounded-full p-2"><CalendarIcon className="w-4 h-4" /></div>
                        <p className="text-sm text-text-secondary">Appointment booked for 'Chinedu Eze' with Dr. Okoro.</p>
                    </li>
                     <li className="flex items-start gap-3">
                        <div className="bg-violet-500/20 text-violet-500 dark:text-violet-400 rounded-full p-2"><UsersIcon className="w-4 h-4" /></div>
                        <p className="text-sm text-text-secondary"><span className="font-semibold text-text-primary">New Staff</span> 'Dr. Funmi' was added to the platform.</p>
                    </li>
                     <li className="flex items-start gap-3">
                        <div className="bg-amber-500/20 text-amber-500 dark:text-amber-400 rounded-full p-2"><BuildingIcon className="w-4 h-4" /></div>
                        <p className="text-sm text-text-secondary">Organization 'Lagos General Hospital' updated their profile.</p>
                    </li>
                 </ul>
            </div>
        </div>
    </div>
);