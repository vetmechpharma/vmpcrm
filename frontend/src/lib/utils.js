import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const LEAD_STATUSES = [
  { value: 'Customer', label: 'Customer', color: 'status-customer' },
  { value: 'Contacted', label: 'Contacted', color: 'status-contacted' },
  { value: 'Pipeline', label: 'Pipeline', color: 'status-pipeline' },
  { value: 'Not Interested', label: 'Not Interested', color: 'status-not-interested' },
  { value: 'Closed', label: 'Closed', color: 'status-closed' },
];

export const getStatusColor = (status) => {
  const found = LEAD_STATUSES.find(s => s.value === status);
  return found ? found.color : 'bg-slate-100 text-slate-600';
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
