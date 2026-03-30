import { useState, useEffect } from 'react';
import { analyticsAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  Loader2, TrendingUp, TrendingDown, ShoppingCart, Users, Package,
  IndianRupee, BarChart3, Calendar, AlertTriangle, Clock, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
const STATUS_COLORS = { pending: '#f59e0b', confirmed: '#3b82f6', ready_to_despatch: '#8b5cf6', shipped: '#06b6d4', delivered: '#10b981', cancelled: '#ef4444', transferred: '#6b7280' };
const PERIODS = [
  { value: '1month', label: '1 Month' },
  { value: '3months', label: '3 Months' },
  { value: '6months', label: '6 Months' },
  { value: '1year', label: '1 Year' },
];

const fmt = (n) => {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n?.toLocaleString('en-IN') ?? '0';
};

const StatCard = ({ title, value, icon: Icon, sub, color = 'blue' }) => (
  <Card className="hover:shadow-md transition-shadow" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <CardContent className="p-4 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-${color}-50 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{title}</p>
        <p className="text-xl font-bold text-slate-800">{value}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <div className="flex items-center gap-2 mb-3 mt-6">
    {Icon && <Icon className="w-5 h-5 text-slate-600" />}
    <h2 className="text-lg font-bold text-slate-800">{children}</h2>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="flex items-center justify-center h-32 text-slate-400 text-sm">{text}</div>
);

const Reports = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6months');
  const [dormantTab, setDormantTab] = useState('30_days');
  const [activeSection, setActiveSection] = useState('overview');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getReports(period);
      setData(res.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, [period]);

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'products', label: 'Products' },
    { id: 'customers', label: 'Customers' },
    { id: 'orders', label: 'Orders' },
    { id: 'activity', label: 'Activity' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );

  if (!data) return <EmptyState text="No data available" />;

  const s = data.summary || {};
  const ordersTime = data.orders_over_time || [];
  const orderStatus = data.order_status_distribution || [];
  const ordersDow = data.orders_by_day_of_week || [];
  const topProducts = data.top_products || [];
  const slowMovers = data.slow_movers || [];
  const topDoctors = data.top_doctors || [];
  const topMedicals = data.top_medicals || [];
  const topAgencies = data.top_agencies || [];
  const freqOrderers = data.frequent_orderers || [];
  const dormant = data.dormant_customers || {};
  const paymentModes = data.payment_modes || [];

  return (
    <div className="animate-fade-in max-w-7xl mx-auto" data-testid="reports-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Comprehensive business performance insights</p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg" data-testid="period-selector">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period === p.value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section navigation */}
      <div className="flex gap-1 p-1 bg-slate-50 rounded-lg mb-5 overflow-x-auto" data-testid="section-nav">
        {sections.map(sec => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${activeSection === sec.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white'}`}
            data-testid={`section-${sec.id}`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Total Revenue" value={`Rs.${fmt(s.total_revenue)}`} icon={IndianRupee} color="green" sub={`${ordersTime.length} months`} />
            <StatCard title="Total Orders" value={fmt(s.total_orders)} icon={ShoppingCart} color="blue" />
            <StatCard title="Total Payments" value={`Rs.${fmt(s.total_payments)}`} icon={TrendingUp} color="purple" />
            <StatCard title="Total Customers" value={fmt(s.total_customers)} icon={Users} color="amber"
              sub={`${s.entity_counts?.doctors || 0}D / ${s.entity_counts?.medicals || 0}M / ${s.entity_counts?.agencies || 0}A`} />
          </div>

          {/* Revenue & Orders Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Revenue & Orders Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersTime.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={ordersTime}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [n === 'revenue' ? `Rs.${v.toLocaleString()}` : v, n === 'revenue' ? 'Revenue' : 'Orders']} />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revGrad)" name="Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb' }} name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No order data for this period" />}
            </CardContent>
          </Card>

          {/* Order Status + Payment Mode */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Order Status Distribution</CardTitle></CardHeader>
              <CardContent>
                {orderStatus.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={orderStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, count }) => `${status}: ${count}`} labelLine={false}>
                        {orderStatus.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.status] || COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No data" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payment Modes</CardTitle></CardHeader>
              <CardContent>
                {paymentModes.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={paymentModes} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="mode" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip formatter={(v) => [`Rs.${v.toLocaleString()}`, 'Amount']} />
                      <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No payment data" />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* PRODUCTS SECTION */}
      {activeSection === 'products' && (
        <div className="space-y-4">
          <SectionTitle icon={Package}>Product Performance</SectionTitle>

          {/* Top Products Chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Products by Order Quantity (Confirmed Orders)</CardTitle></CardHeader>
            <CardContent>
              {topProducts.length ? (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip formatter={(v, n) => [n === 'value' ? `Rs.${v.toLocaleString()}` : v, n === 'value' ? 'Value (Rate x Qty)' : n === 'qty' ? 'Total Qty' : 'Orders']} />
                    <Legend />
                    <Bar dataKey="qty" fill="#2563eb" name="Total Qty" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No product data" />}
            </CardContent>
          </Card>

          {/* Top Products Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Product Performance — Details</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="top-products-table">
                    <thead><tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2">#</th><th className="pb-2 pr-2">Product</th><th className="pb-2 pr-2">Code</th><th className="pb-2 pr-2 text-right">Qty</th><th className="pb-2 pr-2 text-right">Avg Rate</th><th className="pb-2 pr-2 text-right">Value</th><th className="pb-2 text-right">Orders</th>
                    </tr></thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-2 text-xs text-slate-400">{i + 1}</td>
                          <td className="py-1.5 pr-2 font-medium text-xs">{p.name}</td>
                          <td className="py-1.5 pr-2 text-xs text-slate-400">{p.code}</td>
                          <td className="py-1.5 pr-2 text-right text-xs font-bold text-blue-600">{p.qty}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-slate-600">Rs.{p.avg_rate}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-green-600 font-medium">Rs.{p.value?.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-xs">{p.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-slate-400 mt-2">* Value = Rate x Qty (confirmed orders only, excl. tax)</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Slow Moving Products</CardTitle></CardHeader>
              <CardContent>
                {slowMovers.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="slow-movers-table">
                      <thead><tr className="border-b text-left text-xs text-slate-500">
                        <th className="pb-2 pr-2">Product</th><th className="pb-2 pr-2">Code</th><th className="pb-2 pr-2 text-right">Qty Sold</th><th className="pb-2 text-right">Orders</th>
                      </tr></thead>
                      <tbody>
                        {slowMovers.map((p, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-1.5 pr-2 font-medium text-xs">{p.name}</td>
                            <td className="py-1.5 pr-2 text-xs text-slate-400">{p.code}</td>
                            <td className="py-1.5 pr-2 text-right text-xs">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.qty === 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                {p.qty === 0 ? '0 pcs' : `${p.qty} pcs`}
                              </span>
                            </td>
                            <td className="py-1.5 text-right text-xs text-slate-500">{p.orders}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-slate-400 mt-2">* Confirmed orders only</p>
                  </div>
                ) : <EmptyState text="All products are selling well!" />}
              </CardContent>
            </Card>
          </div>

          {/* Products Value Chart (Rate x Qty) */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Product Value (Rate x Qty) — Confirmed Orders</CardTitle></CardHeader>
            <CardContent>
              {topProducts.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, angle: -35, textAnchor: 'end' }} height={80} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [n === 'value' ? `Rs.${v.toLocaleString()}` : `${v} pcs`, n === 'value' ? 'Value' : 'Qty']} />
                    <Legend />
                    <Bar dataKey="value" fill="#10b981" name="Value (Rs.)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="qty" fill="#2563eb" name="Qty (pcs)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No data" />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* CUSTOMERS SECTION */}
      {activeSection === 'customers' && (
        <div className="space-y-4">
          <SectionTitle icon={Users}>Customer Analytics</SectionTitle>

          {/* Top Doctors / Medicals / Agencies */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { title: 'Top Doctors', data: topDoctors, color: '#2563eb' },
              { title: 'Top Medicals', data: topMedicals, color: '#10b981' },
              { title: 'Top Agencies', data: topAgencies, color: '#f59e0b' },
            ].map(({ title, data: list, color }) => (
              <Card key={title}>
                <CardHeader className="pb-2"><CardTitle className="text-sm">{title} by Revenue</CardTitle></CardHeader>
                <CardContent>
                  {list.length ? (
                    <div className="space-y-2">
                      {list.slice(0, 8).map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0" style={{ background: color }}>
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-700 truncate">{item.name || 'Unknown'}</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${Math.min((item.revenue / (list[0]?.revenue || 1)) * 100, 100)}%`, background: color }} />
                              </div>
                              <span className="text-[10px] text-slate-500 flex-shrink-0">Rs.{fmt(item.revenue)}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{item.orders} ord</span>
                        </div>
                      ))}
                      {list.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No data</p>}
                    </div>
                  ) : <EmptyState text={`No ${title.toLowerCase()} data`} />}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Frequent Orderers */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" />Frequent Orderers (3+ orders)</CardTitle></CardHeader>
            <CardContent>
              {freqOrderers.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="frequent-orderers-table">
                    <thead><tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2">#</th><th className="pb-2 pr-2">Name</th><th className="pb-2 pr-2">Type</th>
                      <th className="pb-2 pr-2 text-right">Orders</th><th className="pb-2 pr-2 text-right">Revenue</th><th className="pb-2 text-right">Last Order</th>
                    </tr></thead>
                    <tbody>
                      {freqOrderers.map((f, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-2 text-xs text-slate-400">{i + 1}</td>
                          <td className="py-1.5 pr-2 font-medium text-xs">{f.name}</td>
                          <td className="py-1.5 pr-2 text-xs"><span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px]">{f.type || 'doctor'}</span></td>
                          <td className="py-1.5 pr-2 text-right text-xs font-bold text-blue-600">{f.orders}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-green-600">Rs.{f.revenue.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-xs text-slate-400">{f.last_order?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState text="No frequent orderers in this period" />}
            </CardContent>
          </Card>

          {/* Dormant Customers */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" />Dormant Customers (No Recent Orders)</CardTitle>
                <div className="flex gap-1">
                  {['30_days', '60_days', '90_days'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDormantTab(tab)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${dormantTab === tab ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}
                      data-testid={`dormant-${tab}`}
                    >
                      {tab.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(dormant[dormantTab] || []).length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="dormant-table">
                    <thead><tr className="border-b text-left text-xs text-slate-500">
                      <th className="pb-2 pr-2">Name</th><th className="pb-2 pr-2">Type</th>
                      <th className="pb-2 pr-2 text-right">Past Orders</th><th className="pb-2 pr-2 text-right">Revenue</th><th className="pb-2 text-right">Last Order</th>
                    </tr></thead>
                    <tbody>
                      {(dormant[dormantTab] || []).map((d, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-1.5 pr-2 font-medium text-xs">{d.name}</td>
                          <td className="py-1.5 pr-2 text-xs"><span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px]">{d.type || 'doctor'}</span></td>
                          <td className="py-1.5 pr-2 text-right text-xs">{d.total_orders}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-slate-600">Rs.{d.revenue.toLocaleString()}</td>
                          <td className="py-1.5 text-right text-xs text-red-500 font-medium">{d.last_order?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState text={`No dormant customers (${dormantTab.replace('_', ' ')})`} />}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ORDERS SECTION */}
      {activeSection === 'orders' && (
        <div className="space-y-4">
          <SectionTitle icon={ShoppingCart}>Order Analytics</SectionTitle>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Avg Order Value" value={`Rs.${fmt(ordersTime.length ? ordersTime.reduce((a, m) => a + m.avg_value, 0) / ordersTime.length : 0)}`} icon={IndianRupee} color="blue" />
            <StatCard title="This Period Orders" value={fmt(s.total_orders)} icon={ShoppingCart} color="green" />
            <StatCard title="Revenue" value={`Rs.${fmt(s.total_revenue)}`} icon={TrendingUp} color="purple" />
            <StatCard title="Payments Collected" value={`Rs.${fmt(s.total_payments)}`} icon={IndianRupee} color="amber" />
          </div>

          {/* Monthly Orders Line Chart */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Order Count & Avg Value</CardTitle></CardHeader>
            <CardContent>
              {ordersTime.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ordersTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [n === 'avg_value' ? `Rs.${v.toLocaleString()}` : v, n === 'avg_value' ? 'Avg Value' : 'Orders']} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="orders" stroke="#2563eb" strokeWidth={2} dot={{ fill: '#2563eb', r: 4 }} name="Orders" />
                    <Line yAxisId="right" type="monotone" dataKey="avg_value" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Avg Value" />
                  </LineChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No data" />}
            </CardContent>
          </Card>

          {/* Orders by Day of Week + Status Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-500" />Orders by Day of Week</CardTitle></CardHeader>
              <CardContent>
                {ordersDow.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={ordersDow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No data" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Order Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                {orderStatus.length ? (
                  <div className="space-y-2">
                    {orderStatus.sort((a, b) => b.count - a.count).map((s, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.status] || COLORS[i] }} />
                        <span className="text-xs font-medium text-slate-700 flex-1 capitalize">{s.status?.replace(/_/g, ' ')}</span>
                        <div className="w-32 bg-slate-100 rounded-full h-2">
                          <div className="h-2 rounded-full" style={{ width: `${(s.count / Math.max(...orderStatus.map(x => x.count))) * 100}%`, background: STATUS_COLORS[s.status] || COLORS[i] }} />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{s.count}</span>
                      </div>
                    ))}
                  </div>
                ) : <EmptyState text="No data" />}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ACTIVITY SECTION */}
      {activeSection === 'activity' && (
        <div className="space-y-4">
          <SectionTitle icon={BarChart3}>Business Activity</SectionTitle>

          {/* Revenue per Month Bar */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Revenue</CardTitle></CardHeader>
            <CardContent>
              {ordersTime.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ordersTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`Rs.${v.toLocaleString()}`, 'Revenue']} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState text="No data" />}
            </CardContent>
          </Card>

          {/* Customer Entity Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Customer Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Doctors', value: s.entity_counts?.doctors || 0 },
                        { name: 'Medicals', value: s.entity_counts?.medicals || 0 },
                        { name: 'Agencies', value: s.entity_counts?.agencies || 0 },
                      ]}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      <Cell fill="#2563eb" />
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Dormant Customer Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4 py-2">
                  {[
                    { label: 'No orders in 30 days', count: (dormant['30_days'] || []).length, color: '#f59e0b' },
                    { label: 'No orders in 60 days', count: (dormant['60_days'] || []).length, color: '#f97316' },
                    { label: 'No orders in 90 days', count: (dormant['90_days'] || []).length, color: '#ef4444' },
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-sm flex-1">{d.label}</span>
                      <span className="text-lg font-bold" style={{ color: d.color }}>{d.count}</span>
                      <span className="text-xs text-slate-400">customers</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
