import React, { useState } from 'react';
import { CRMProvider, useCRM } from './context/CRMContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { LeadsList } from './components/LeadsList';
import { LeadFormModal } from './components/LeadFormModal';
import { LeadDetailDrawer } from './components/LeadDetailDrawer';
import { CommunicationModal } from './components/CommunicationModal';
import { FollowupsView } from './components/FollowupsView';
import { CustomersView } from './components/CustomersView';
import { PipelineKanban } from './components/PipelineKanban';
import { ExcelImportView } from './components/ExcelImportView';
import { ReportsView } from './components/ReportsView';
import { WebsiteAuditView } from './components/WebsiteAuditView';
import { SettingsView } from './components/SettingsView';
import { DatacenterView } from './components/DatacenterView';
import { UsersView } from './components/UsersView';
import { useAuditMonitor } from './hooks/useAuditMonitor';
import { Lead } from './types';
import { Menu, Plus, FileSpreadsheet, Loader2, LogOut, ShieldCheck } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { activeTab, setActiveTab, stats } = useCRM();
  const { user, logout, can } = useAuth();

  // Live count of website audits running in the backend (visible from any menu)
  const { runningCount } = useAuditMonitor();

  // Mobile Sidebar Toggle
  const [mobileOpen, setMobileOpen] = useState(false);

  // Selected Lead for Detail Drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Add/Edit Lead Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);

  // Communication Modal
  const [commLead, setCommLead] = useState<Lead | null>(null);
  const [commMode, setCommMode] = useState<'Call' | 'WhatsApp' | null>(null);

  // Website Audit navigation target (from lead drawer / customers)
  const [auditTargetUrl, setAuditTargetUrl] = useState<string | null>(null);

  const handleOpenWebsiteAudit = (websiteUrl: string) => {
    setSelectedLead(null);
    setAuditTargetUrl(websiteUrl);
    setActiveTab('website-audit');
  };

  const handleOpenAddLead = () => {
    setLeadToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenEditLead = (lead: Lead) => {
    setLeadToEdit(lead);
    setIsFormOpen(true);
  };

  const handleOpenComm = (lead: Lead, mode: 'Call' | 'WhatsApp') => {
    setCommLead(lead);
    setCommMode(mode);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Executive Overview';
      case 'leads':
        return 'Leads Database';
      case 'followups':
        return 'Follow-up Schedule';
      case 'customers':
        return 'Customer Accounts';
      case 'pipeline':
        return 'Sales Pipeline';
      case 'import':
        return 'Excel / CSV Import';
      case 'website-audit':
        return 'Website Audit Engine';
      case 'datacenter':
        return 'Datacenter — Lead Archive';
      case 'users':
        return 'Users & Roles';
      case 'settings':
        return 'Settings & Data Management';
      case 'reports':
        return 'CRM Analytics & Reports';
      default:
        return 'Digital Marketing CRM';
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* High Density Navigation Sidebar */}
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenAddLead={handleOpenAddLead}
      />

      {/* Main Content View Container with Sticky High Density Header */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  {getPageTitle()}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                BGT Digital Marketing • High Density CRM View
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Stats Micro Strip */}
              <div className="hidden md:flex items-center gap-2 border-r border-slate-200 dark:border-slate-800 pr-3">
                <div className="text-[11px] px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  Leads: <strong className="text-slate-900 dark:text-slate-100">{stats.totalLeads}</strong>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-medium">
                  Today: <strong>{stats.followupsToday}</strong>
                </div>
                <div className="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-medium">
                  Won: <strong>{stats.wonCount}</strong>
                </div>
              </div>

              {/* Background audit running indicator */}
              {runningCount > 0 && (
                <button
                  onClick={() => setActiveTab('website-audit')}
                  title="Website audits running in the background"
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    {runningCount} audit{runningCount > 1 ? 's' : ''} running
                  </span>
                </button>
              )}

            {/* Quick Actions */}
            {user && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] pl-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-900/60 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {user.name}
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/60 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300">
                    {user.designation}
                  </span>
                </span>
                <button
                  onClick={() => {
                    if (confirm('Log out of the CRM?')) logout();
                  }}
                  title="Log out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {can('import.excel') && (
              <button
                onClick={() => setActiveTab('import')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Import Excel</span>
              </button>
            )}

            <button
              onClick={handleOpenAddLead}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-xs shadow-blue-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Lead</span>
            </button>
          </div>
        </header>

        {/* Main Workspace Body */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto overflow-y-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              onSelectLead={setSelectedLead}
              onOpenComm={handleOpenComm}
              onOpenAddLead={handleOpenAddLead}
            />
          )}

          {activeTab === 'leads' && (
            <LeadsList
              onSelectLead={setSelectedLead}
              onOpenComm={handleOpenComm}
              onOpenAddLead={handleOpenAddLead}
            />
          )}

          {activeTab === 'followups' && (
            <FollowupsView
              onSelectLead={setSelectedLead}
              onOpenComm={handleOpenComm}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              onSelectLead={setSelectedLead}
              onOpenComm={handleOpenComm}
              onOpenWebsiteAudit={handleOpenWebsiteAudit}
            />
          )}

          {activeTab === 'pipeline' && (
            <PipelineKanban
              onSelectLead={setSelectedLead}
              onOpenComm={handleOpenComm}
              onOpenAddLead={handleOpenAddLead}
            />
          )}

          {activeTab === 'import' && <ExcelImportView />}

          {activeTab === 'website-audit' && (
            <WebsiteAuditView
              autoOpenDomain={auditTargetUrl}
              onConsumedAutoOpen={() => setAuditTargetUrl(null)}
            />
          )}

          {activeTab === 'datacenter' && <DatacenterView />}

          {activeTab === 'users' && <UsersView />}

          {activeTab === 'settings' && <SettingsView />}

          {activeTab === 'reports' && <ReportsView />}
        </main>
      </div>

      {/* Customer / Lead Timeline Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onOpenComm={handleOpenComm}
        onEditLead={(lead) => {
          setSelectedLead(null);
          handleOpenEditLead(lead);
        }}
        onOpenWebsiteAudit={handleOpenWebsiteAudit}
      />

      {/* Manual Add / Edit Lead Form Modal */}
      <LeadFormModal
        isOpen={isFormOpen}
        leadToEdit={leadToEdit}
        onClose={() => setIsFormOpen(false)}
      />

      {/* Communication Modal (Call Log & WhatsApp Script Generator) */}
      <CommunicationModal
        lead={commLead}
        mode={commMode}
        onClose={() => {
          setCommLead(null);
          setCommMode(null);
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

const AppGate: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <LoginView />;
  }
  return (
    <CRMProvider>
      <MainAppContent />
    </CRMProvider>
  );
};
