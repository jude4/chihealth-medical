import React from 'react';
import { Button } from '../../components/common/Button.tsx';
import { CheckIcon, LockIcon } from '../../components/icons/index.tsx';

const planDetails = {
    name: 'Professional Hospital',
    price: '250,000',
    period: 'monthly',
    status: 'Active',
    nextBillingDate: 'August 15, 2024',
    features: [
        'Up to 50 staff accounts',
        'Full Role Suite (Lab, Pharmacy, etc.)',
        'Inpatient & Triage Management',
        'Full AI Assistant Suite',
    ]
};

export const SubscriptionView: React.FC = () => {
  return (
    <>
      <h2 className="text-3xl font-bold text-text-primary mb-6">Subscription & Billing</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <div className="content-card">
                <div className="p-6 border-b border-border-primary">
                    <h3 className="text-xl font-semibold text-text-primary">Current Plan</h3>
                </div>
                <div className="p-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="text-2xl font-bold text-primary">{planDetails.name}</h4>
                            <p className="text-text-secondary">
                                ₦{planDetails.price} <span className="capitalize">/{planDetails.period}</span>
                            </p>
                        </div>
                        <span className="status-chip status-chip-green">{planDetails.status}</span>
                    </div>
                    <div className="mt-6 border-t border-border-primary pt-6">
                        <h5 className="font-semibold text-text-primary mb-3">Plan Features</h5>
                        <ul className="space-y-2 text-sm">
                            {planDetails.features.map(feature => (
                                <li key={feature} className="flex items-center gap-3">
                                    <CheckIcon className="w-5 h-5 text-green-500" />
                                    <span className="text-text-secondary">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="p-6 bg-background-tertiary rounded-b-lg flex justify-end gap-4">
                    <Button className="btn-secondary">Change Plan</Button>
                    <Button className="btn-danger">Cancel Subscription</Button>
                </div>
            </div>
        </div>

        <div className="content-card p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Billing Details</h3>
            <div className="space-y-4">
                <div>
                    <p className="text-sm font-medium text-text-secondary">Next Billing Date</p>
                    <p className="font-semibold text-text-primary">{planDetails.nextBillingDate}</p>
                </div>
                <div>
                    <p className="text-sm font-medium text-text-secondary">Payment Method</p>
                    <p className="font-semibold text-text-primary flex items-center gap-2">
                        Mastercard ending in **** 1234
                    </p>
                </div>
                 <Button fullWidth>Update Payment Method</Button>
            </div>
        </div>
      </div>
    </>
  );
};
