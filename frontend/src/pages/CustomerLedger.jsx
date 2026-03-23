import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { BookOpen, Filter, Loader2 } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CustomerLedger = () => {
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('customerToken');
      const params = {};
      if (dateFrom) params.from_date = dateFrom;
      if (dateTo) params.to_date = dateTo;
      const res = await axios.get(`${API_URL}/api/customer/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setLedger(res.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLedger(); }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4" data-testid="customer-ledger">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Ledger</h1>
        <p className="text-slate-500 mt-1">View your invoices, payments, and outstanding balance</p>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
        <span className="text-sm text-slate-400">to</span>
        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        <Button size="sm" onClick={fetchLedger}><Filter className="w-3 h-3 mr-1" />Filter</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : ledger ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xs text-slate-500">Total Invoiced</p>
              <p className="text-lg font-bold text-slate-900">{ledger.total_debit.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-slate-500">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600">{ledger.total_credit.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-slate-500">Balance</p>
              <p className={`text-lg font-bold ${ledger.closing_balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {ledger.closing_balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
              </p>
            </Card>
          </div>

          {/* Ledger Table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-left border-b font-medium">Date</th>
                  <th className="p-2 text-left border-b font-medium">Description</th>
                  <th className="p-2 text-right border-b font-medium">Debit (₹)</th>
                  <th className="p-2 text-right border-b font-medium">Credit (₹)</th>
                  <th className="p-2 text-right border-b font-medium">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((e, i) => (
                  <tr key={i} className={`border-b ${e.type === 'opening_balance' ? 'bg-amber-50' : e.type === 'payment' ? 'bg-emerald-50' : ''}`}>
                    <td className="p-2 text-xs">{e.date || '-'}</td>
                    <td className="p-2 text-xs">{e.description}</td>
                    <td className="p-2 text-right text-xs">{e.debit ? e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
                    <td className="p-2 text-right text-xs text-emerald-600">{e.credit ? e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : ''}</td>
                    <td className="p-2 text-right text-xs font-medium">{e.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-800 text-white font-bold">
                  <td colSpan={2} className="p-2 text-right">TOTALS</td>
                  <td className="p-2 text-right">{ledger.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right">{ledger.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-2 text-right">{ledger.closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <p className="text-center py-8 text-slate-400">No ledger data available</p>
      )}
    </div>
  );
};

export default CustomerLedger;
