import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const LEAD_STATUSES = [
  { value: 'Pipeline', label: 'Pipeline', color: 'status-pipeline' },
  { value: 'Contacted', label: 'Contacted', color: 'status-contacted' },
  { value: 'Interested', label: 'Interested', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'Customer', label: 'Customer', color: 'status-customer' },
  { value: 'Converted', label: 'Converted', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'Not Interested', label: 'Not Interested', color: 'status-not-interested' },
  { value: 'Lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
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
