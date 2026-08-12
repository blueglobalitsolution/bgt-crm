import React from 'react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { BarChart3, TrendingUp, Users, Award, PieChart as PieIcon } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { leads, stats } = useCRM();
  const { users } = useAuth();

  // 1. Service Breakdown Data
  const serviceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    l.interestedServices?.forEach((s) => {
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    });
  });

  const serviceChartData = Object.entries(serviceCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // 2. Source Breakdown Data
  const sourceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const src = l.leadSource || 'Other';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  });

  const sourceChartData = Object.entries(sourceCounts)
    .map(([name, count]) => ({ name, value: count }))
    .sort((a, b) => b.value - a.value);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  // 3. Salesperson Performance (registered users + an "Unassigned/Other" bucket)
  const roster = users.filter((u) => u.active === 1).map((u) => u.name);
  const assignedNames = Array.from(new Set(leads.map((l) => l.assignedTo).filter(Boolean) as string[]));
  const rosterSet = new Set(roster);
  const otherNames = assignedNames.filter((n) => !rosterSet.has(n));

  const salespersonStats = [...roster, ...(otherNames.length > 0 ? ['Unassigned / Other'] : [])].map((sp) => {
    const spLeads =
      sp === 'Unassigned / Other' ? leads.filter((l) => l.assignedTo && !rosterSet.has(l.assignedTo)) : leads.filter((l) => l.assignedTo === sp);
    const wonLeads = spLeads.filter((l) => l.status === 'Won');
    const totalValue = wonLeads.reduce((sum, curr) => sum + (curr.expectedValue || 0), 0);

    return {
      name: sp,
      leadsCount: spLeads.length,
      wonCount: wonLeads.length,
      totalValue,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <span>CRM Analytics & Performance Reports</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Track service popularity, marketing channel efficiency, and sales team conversion metrics.
        </p>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Conversion Rate</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {stats.totalLeads > 0 ? `${((stats.wonCount / stats.totalLeads) * 100).toFixed(1)}%` : '0%'}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{stats.wonCount} of {stats.totalLeads} won</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Avg Deal Size</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            ₹{stats.wonCount > 0 ? (stats.wonValue / stats.wonCount / 1000).toFixed(1) : '0'}K
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Per converted client</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Active Pipeline Value</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">
            ₹{(stats.pipelineValue / 100000).toFixed(2)}L
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">In negotiation & proposal</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <div className="text-xs text-slate-500 font-medium">Top Service</div>
          <div className="text-lg font-bold text-blue-600 mt-1 truncate">
            {serviceChartData[0]?.name || 'Website'}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{serviceChartData[0]?.count || 0} inquiries</p>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Popularity Bar Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span>Service Demand Report</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">Inquiries grouped by digital marketing service</p>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceChartData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Source Distribution Chart */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-600" />
            <span>Lead Source Performance</span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">Which marketing channel generates inquiries</p>

          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sourceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    borderColor: '#334155',
                    color: '#fff',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Salesperson Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Salesperson Performance Leaderboard</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200/80 dark:border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 pl-5">Salesperson</th>
                <th className="p-3.5">Assigned Leads</th>
                <th className="p-3.5">Won Clients</th>
                <th className="p-3.5">Conversion</th>
                <th className="p-3.5 pr-5 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {salespersonStats.map((sp) => {
                const convRate = sp.leadsCount > 0 ? ((sp.wonCount / sp.leadsCount) * 100).toFixed(0) : '0';
                return (
                  <tr key={sp.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 pl-5 font-bold text-slate-900 dark:text-slate-100">
                      {sp.name}
                    </td>
                    <td className="p-3.5">{sp.leadsCount}</td>
                    <td className="p-3.5 font-semibold text-emerald-600">{sp.wonCount}</td>
                    <td className="p-3.5">{convRate}%</td>
                    <td className="p-3.5 pr-5 text-right font-bold text-slate-900 dark:text-slate-100">
                      ₹{sp.totalValue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
