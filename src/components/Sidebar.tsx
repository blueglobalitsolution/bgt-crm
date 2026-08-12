import React, { useEffect, useState } from 'react';
import {
  Home,
  Users,
  Calendar,
  Building2,
  Kanban,
  FileSpreadsheet,
  BarChart3,
  Settings,
  Sparkles,
  ChevronRight,
  Zap,
  Globe,
  Archive,
  ShieldCheck,
} from 'lucide-react';
import { useCRM } from '../context/CRMContext';
import { useAuth } from '../context/AuthContext';
import { auditApi } from '../utils/auditApi';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
  onOpenAddLead: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen = false,
  setMobileOpen,
  onOpenAddLead,
}) => {
  const { activeTab, setActiveTab, stats } = useCRM();
  const { can, isAdmin } = useAuth();
  const [archivedCount, setArchivedCount] = useState<number | null>(null);

  useEffect(() => {
    auditApi
      .getArchivedLeads()
      .then((res) => setArchivedCount(res.archivedLeads.length))
      .catch(() => setArchivedCount(null));
  }, [activeTab]);

  const handleClose = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, badge: null, perm: null },
    {
      id: 'leads',
      label: 'Leads',
      icon: Users,
      badge: stats.newLeads > 0 ? `${stats.newLeads} new` : null,
      badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      perm: 'leads.view',
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: Calendar,
      badge: stats.followupsToday > 0 ? `${stats.followupsToday}` : null,
      badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      perm: 'followups.view',
    },
    {
      id: 'customers',
      label: 'Customers',
      icon: Building2,
      badge: stats.wonCount > 0 ? `${stats.wonCount}` : null,
      badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      perm: 'customers.view',
    },
    { id: 'pipeline', label: 'Pipeline', icon: Kanban, badge: null, perm: 'pipeline.view' },
    {
      id: 'datacenter',
      label: 'Datacenter',
      icon: Archive,
      badge: archivedCount != null && archivedCount > 0 ? `${archivedCount}` : null,
      badgeColor: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
      perm: 'datacenter.view',
    },
    { id: 'website-audit', label: 'Website Audit', icon: Globe, badge: null, perm: 'audit.run' },
    { id: 'import', label: 'Import Excel', icon: FileSpreadsheet, badge: null, perm: 'import.excel' },
    { id: 'reports', label: 'Reports', icon: BarChart3, badge: null, perm: 'reports.view' },
    { id: 'users', label: 'Users & Roles', icon: ShieldCheck, badge: null, perm: 'users.manage' },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null, perm: 'settings.manage' },
  ];

  const navItems = allNavItems.filter((item) => (item.perm ? can(item.perm) : true));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">
              BGT
            </div>
            <div>
              <h1 className="font-bold text-lg leading-snug tracking-tight text-white flex items-center gap-1.5">
                BGT CRM
                <span className="text-[10px] uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-semibold">
                  V1.0
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Digital Marketing Agency</p>
            </div>
          </div>
        </div>

        {/* Quick Add Button */}
        <div className="p-4 border-b border-slate-800/60">
          <button
            onClick={() => {
              onOpenAddLead();
              handleClose();
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer text-sm"
          >
            <span className="text-lg leading-none font-bold">+</span>
            Add Lead
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
            Main Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  handleClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="w-4 h-4 text-white/70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* AI Capabilities Callout Card */}
        <div className="p-3.5 m-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-200 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>AI Sales Assistant</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed mb-2">
            Auto-generate instant lead insights & WhatsApp message scripts.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
            <Zap className="w-3 h-3" />
            <span>Gemini 3.6 Flash Active</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-800/80 text-[11px] text-slate-500 text-center">
          BGT CRM • Digital Marketing System
        </div>
      </aside>
    </>
  );
};
