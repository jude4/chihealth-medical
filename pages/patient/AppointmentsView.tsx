import React, { useState, useEffect } from 'react';
import { Appointment, Room } from '../../types.ts';
import { Button } from '../../components/common/Button.tsx';
import { BookingModal } from './BookingModal.tsx';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { CalendarIcon } from '../../components/icons/index.tsx';
import * as api from '../../services/apiService.ts';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.tsx';
import { RescheduleModal } from '../../components/common/RescheduleModal.tsx';

interface AppointmentsViewProps {
  appointments: Appointment[];
  rooms: Room[];
  onBookAppointment: (newAppointment: Omit<Appointment, 'id' | 'status' | 'patientId'>) => void;
  suggestedSpecialty?: string | null;
  onSuggestionHandled: () => void;
  onRefresh?: () => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({ appointments, rooms, onBookAppointment, suggestedSpecialty, onSuggestionHandled, onRefresh }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [activeAppt, setActiveAppt] = useState<Appointment | null>(null);

  useEffect(() => {
    if (suggestedSpecialty) {
      setIsModalOpen(true);
    }
  }, [suggestedSpecialty]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (suggestedSpecialty) {
      onSuggestionHandled();
    }
  };

  const normalizeDate = (value: string) => {
    const parsed = new Date(value);
    parsed.setHours(0, 0, 0, 0);
    return parsed.getTime();
  };
  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();

  const upcomingAppointments = appointments.filter(a => normalizeDate(a.date) >= today && a.status !== 'Completed' && a.status !== 'Cancelled');
  const pastAppointments = appointments.filter(a => normalizeDate(a.date) < today || a.status === 'Completed' || a.status === 'Cancelled');

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-3xl font-bold text-text-primary">My Appointments</h2>
            <p className="text-text-secondary">View your upcoming and past appointments.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>Book New Appointment</Button>
      </div>

      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold text-primary mb-3">Upcoming Appointments</h3>
          <div className="content-card">
            {upcomingAppointments.length > 0 ? (
              <ul className="divide-y divide-border-primary">
                {upcomingAppointments.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(appt => (
                  <li key={appt.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">{appt.specialty} with {appt.doctorName}</p>
                      <p className="text-sm text-text-secondary">{new Date(appt.date).toDateString()} at {appt.time} in <span className="font-medium">{appt.consultingRoomName}</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="link-button" onClick={() => { setActiveAppt(appt); setConfirmOpen(true); }}>Cancel</button>
                      <button className="link-button" onClick={() => { setActiveAppt(appt); setRescheduleOpen(true); }}>Reschedule</button>
                      <span className="status-chip status-chip-cyan">{appt.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarIcon} title="No Upcoming Appointments" message="You can book a new appointment using the button above." />
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-xl font-semibold text-primary mb-3">Past Appointments</h3>
           <div className="content-card">
            {pastAppointments.length > 0 ? (
              <ul className="divide-y divide-border-primary">
                {pastAppointments.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(appt => (
                  <li key={appt.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-text-primary">{appt.specialty} with {appt.doctorName}</p>
                      <p className="text-sm text-text-secondary">{new Date(appt.date).toDateString()} at {appt.time}</p>
                    </div>
                    <span className="status-chip status-chip-slate">{appt.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarIcon} title="No Past Appointments" message="Your completed appointment history will appear here." />
            )}
          </div>
        </div>
      </div>

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal} 
        onBookAppointment={onBookAppointment} 
        suggestedSpecialty={suggestedSpecialty}
        rooms={rooms}
      />
      <ConfirmationModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={async () => {
        if (!activeAppt) return;
        try {
          await api.deleteAppointment(activeAppt.id);
          if (onRefresh) onRefresh(); else window.location.reload();
        } catch (err: any) {
          alert('Failed to cancel: ' + (err.message || err));
        }
      }} title="Cancel Appointment" message={`Are you sure you want to cancel the appointment on ${activeAppt ? new Date(activeAppt.date).toDateString() + ' at ' + activeAppt.time : ''}?`} type="danger" />

      <RescheduleModal isOpen={rescheduleOpen} onClose={() => setRescheduleOpen(false)} initialDate={activeAppt?.date} initialTime={activeAppt?.time} onSave={async (date, time) => {
        if (!activeAppt) return;
        await api.rescheduleAppointment(activeAppt.id, { date, time });
        if (onRefresh) onRefresh(); else window.location.reload();
      }} />
    </>
  );
};