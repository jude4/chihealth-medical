import React, { useState } from 'react';
import { User, UserRole, Organization, Department } from '../../types.ts';
import { Button } from '../../components/common/Button.tsx';
import { EditStaffModal } from './EditStaffModal.tsx';
import { EmptyState } from '../../components/common/EmptyState.tsx';
import { UsersIcon } from '../../components/icons/index.tsx';

interface StaffManagementViewProps {
  staff: User[];
  organizations: Organization[];
  departments: Department[];
  onUpdateUser: (user: User) => void;
  currentUser: User;
}

const roleDisplay: Record<UserRole, string> = {
    admin: 'Administrator',
    hcw: 'Healthcare Worker',
    nurse: 'Nurse',
    patient: 'Patient',
    pharmacist: 'Pharmacist',
    lab_technician: 'Lab Technician',
    receptionist: 'Receptionist',
    logistics: 'Logistics',
    command_center: 'Command Center',
};

export const StaffManagementView: React.FC<StaffManagementViewProps> = ({ staff, organizations, departments, onUpdateUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);

  const handleEdit = (user: User) => {
    setSelectedStaff(user);
    setIsModalOpen(true);
  };

  const handleSave = (updatedUser: User) => {
    onUpdateUser(updatedUser);
    setIsModalOpen(false);
    setSelectedStaff(null);
  };
  
  const getDepartmentNames = (departmentIds?: string[]) => {
    if (!departmentIds || departmentIds.length === 0) return 'Unassigned';
    return departmentIds
      .map(id => departments.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }
  
  const getOrganizationNames = (orgs: Organization[]) => {
    if (!orgs || orgs.length === 0) return 'Unassigned';
    return orgs.map(o => o.name).join(', ');
  }

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-text-primary">Staff Management</h2>
        <Button onClick={() => alert("Add Staff feature coming soon!")}>Add New Staff Member</Button>
      </div>
      <div className="content-card">
        {staff.length > 0 ? (
          <table className="styled-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Departments</th>
                <th>Assigned Organizations</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(user => (
                <tr key={user.id}>
                  <td className="font-medium">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleDisplay[user.role]}</td>
                  <td className="text-sm">{getDepartmentNames(user.departmentIds)}</td>
                  <td className="text-sm">{getOrganizationNames(user.organizations)}</td>
                  <td>
                    <Button onClick={() => handleEdit(user)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={UsersIcon} title="No Staff Members Found" message="You can add new staff members using the button above." />
        )}
      </div>

      {selectedStaff && (
        <EditStaffModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            user={selectedStaff}
            organizations={organizations}
            departments={departments}
            onSave={handleSave}
            currentUser={currentUser}
        />
      )}
    </>
  );
};