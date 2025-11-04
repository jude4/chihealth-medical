import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { Button } from '../../components/common/Button.tsx';
import { Input } from '../../components/common/Input.tsx';
import { Select } from '../../components/common/Select.tsx';
import { Appointment, Room } from '../../types.ts';
import { useToasts } from '../../hooks/useToasts.ts';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookAppointment: (newAppointment: Omit<Appointment, 'id' | 'status' | 'patientId'>) => void;
  suggestedSpecialty?: string | null;
  rooms: Room[];
}

const allDoctors = [
    { id: 'user-hcw-01', name: 'Dr. Adebayo', specialty: 'Cardiology' },
    { id: 'user-hcw-02', name: 'Dr. Okoro', specialty: 'Dermatology' },
    { id: 'user-hcw-03', name: 'Dr. Chike', specialty: 'General Practice' },
    { id: 'user-hcw-04', name: 'Dr. Nwosu', specialty: 'Neurology' },
    { id: 'user-hcw-05', name: 'Dr. Ibrahim', specialty: 'Cardiology' },
];

const allDepartments = [...new Set(allDoctors.map(d => d.specialty))];

export const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, onBookAppointment, suggestedSpecialty, rooms }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToasts();
  const [department, setDepartment] = useState(suggestedSpecialty || '');
  const [filteredDoctors, setFilteredDoctors] = useState(allDoctors);
  
  const consultingRooms = rooms.filter(r => r.type === 'Consulting Room');

  useEffect(() => {
    if (department) {
      setFilteredDoctors(allDoctors.filter(d => d.specialty === department));
    } else {
      setFilteredDoctors(allDoctors);
    }
  }, [department]);

  useEffect(() => {
    if (suggestedSpecialty) {
        setDepartment(suggestedSpecialty);
    }
  }, [suggestedSpecialty]);


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const doctorInfo = (formData.get('doctor') as string).split('|');
    const roomInfo = (formData.get('consultingRoomId') as string).split('|');
    
    const newAppointment = {
        doctorId: doctorInfo[0],
        doctorName: doctorInfo[1],
        specialty: doctorInfo[2],
        date: formData.get('date') as string,
        time: formData.get('time') as string,
        consultingRoomId: roomInfo[0],
        consultingRoomName: roomInfo[1],
    };

    setIsLoading(true);
    setTimeout(() => {
        setIsLoading(false);
        onBookAppointment(newAppointment);
        addToast('Appointment booked successfully!', 'success');
        onClose();
    }, 1000);
  }

  const footerContent = (
    <>
      <button
        onClick={onClose}
        type="button"
        className="btn"
        style={{backgroundColor: 'var(--background-light)', color: 'var(--text-primary)', border: '1px solid var(--border-secondary)'}}
      >
        Cancel
      </button>
      <Button type="submit" form="bookingForm" isLoading={isLoading}>
        Confirm Booking
      </Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book a New Appointment" footer={footerContent}>
      <form id="bookingForm" onSubmit={handleSubmit} className="space-y-4">
        <Select label="Select Department" name="department" value={department} onChange={(e) => setDepartment(e.target.value)} required>
            <option value="">Select a department...</option>
            {allDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
            ))}
        </Select>
        <Select label="Select Doctor" name="doctor" required disabled={!department}>
            <option value="">Select a doctor...</option>
            {filteredDoctors.map(doc => (
                 <option key={doc.id} value={`${doc.id}|${doc.name}|${doc.specialty}`}>{doc.name} ({doc.specialty})</option>
            ))}
        </Select>
        <Select label="Select Consulting Room" name="consultingRoomId" required>
            <option value="">Select a room...</option>
            {consultingRooms.map(room => (
                 <option key={room.id} value={`${room.id}|${room.name}`}>{room.name}</option>
            ))}
        </Select>
        <Input label="Preferred Date" name="date" type="date" required min={new Date().toISOString().split("T")[0]} />
        <Input label="Preferred Time" name="time" type="time" required />
        <Input name="reason" label="Reason for Visit (optional)" placeholder="e.g. Annual Checkup" />
      </form>
    </Modal>
  );
};
