import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.tsx';
import { Button } from '../../components/common/Button.tsx';
import * as api from '../../services/apiService.ts';
import { useToasts } from '../../hooks/useToasts.ts';

interface ConnectWearableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const ConnectWearableModal: React.FC<ConnectWearableModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [deviceName, setDeviceName] = useState('My Watch');
  const [deviceType, setDeviceType] = useState('watch');
  const { addToast } = useToasts();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Attempt to call the backend to add a wearable device. If backend route doesn't exist, fall back to simulate call.
      if ((api as any).addWearableDevice) {
        await (api as any).addWearableDevice({ name: deviceName, type: deviceType });
      } else {
        await api.simulateWearableData();
      }
      if (onConnected) onConnected();
      onClose();
      addToast('Wearable connected successfully', 'success');
    } catch (err) {
      console.error('Failed to connect wearable', err);
      // Try to surface a useful error message
      const msg = err && (err as any).message ? (err as any).message : 'Failed to connect wearable device';
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={handleConnect} isLoading={isLoading}>Connect</Button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect a Wearable Device" footer={footer}>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Connect a wearable to stream vitals and activity into your dashboard.</p>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Device name</label>
          <input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Device type</label>
          <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} className="input w-full">
            <option value="watch">Smart Watch</option>
            <option value="ring">Smart Ring</option>
            <option value="patch">Patch</option>
          </select>
        </div>
        <p className="text-xs text-text-tertiary">In this demo the connection will either call the simulator or the backend device registration endpoint if available.</p>
      </div>
    </Modal>
  );
};
