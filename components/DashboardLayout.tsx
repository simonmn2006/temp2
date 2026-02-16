
import React, { useState, useMemo } from 'react';
import { AdminTab, TranslationSet, Language, User, Alert } from '../types';
import { LanguageToggle } from './LanguageToggle';

interface DashboardLayoutProps {
  t: TranslationSet;
  currentUser: User;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  onLogout: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  children: React.ReactNode;
  alerts: Alert[];
  backendOffline?: boolean;
}

const LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  t, currentUser, activeTab, onTabChange, onLogout, language, onLanguageChange, children, alerts, backendOffline
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isDesktopExpanded, setIsDesktopExpanded] = useState(true);

  const menuItems = [
    { id: AdminTab.DASHBOARD, icon: '📊', roles: ['Admin', 'Manager', 'SuperAdmin'] },
    { id: AdminTab.USERS, icon: '👥', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.FACILITIES, icon: '🏢', roles: ['Admin', 'Manager', 'SuperAdmin'] },
    { id: AdminTab.REFRIGERATORS, icon: '❄️', roles: ['Admin', 'Manager', 'SuperAdmin'] },
    { id: AdminTab.MENUS, icon: '🍽️', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.FORM_CREATOR, icon: '📝', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.ASSIGNMENTS, icon: '🔗', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.REPORTS, icon: '📑', roles: ['Admin', 'Manager', 'SuperAdmin'] },
    { id: AdminTab.FACILITY_ANALYTICS, icon: '📈', roles: ['Admin', 'Manager', 'SuperAdmin'] },
    { id: AdminTab.REMINDERS, icon: '⏰', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.SETTINGS, icon: '⚙️', roles: ['Admin', 'SuperAdmin'] },
    { id: AdminTab.BACKUP_SYNC, icon: '🔄', roles: ['SuperAdmin'] },
    { id: AdminTab.AUDIT_LOGS, icon: '🛡️', roles: ['SuperAdmin'] },
  ].filter(item => item.roles.includes(currentUser.role));

  const activeAlertCount = useMemo(() => {
    return alerts.filter(a => !a.resolved).length;
  }, [alerts]);

  const handleTabSelect = (tab: AdminTab) => {
    onTabChange(tab);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300 text-left">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'} ${isDesktopExpanded ? 'lg:w-64' : 'lg:w-20'} bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col no-print`}>
        <div className="p-6 flex items-center space-x-3 mb-4">
          <img src={LOGO_URL} className="w-10 h-10 object-contain flex-shrink-0" alt="Gourmetta" />
          {(isSidebarOpen || isDesktopExpanded) && (
            <div className="flex flex-col min-w-0 pb-2">
              <span className="font-black text-xl text-slate-900 dark:text-slate-100 truncate leading-snug italic">gourmetta</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] -mt-1">{currentUser.role}</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => handleTabSelect(item.id)} className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl transition-all relative group ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'}`}>
                {isActive && <div className="absolute left-0 w-1 h-6 bg-blue-600 dark:bg-blue-400 rounded-r-full animate-in slide-in-from-left-2 duration-300" />}
                <span className={`text-xl flex-shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>{item.icon}</span>
                {(isSidebarOpen || isDesktopExpanded) && (
                  <span className="truncate text-sm font-bold flex-1">{t.tabs[item.id]}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 mt-auto">
          <div className="space-y-4">
            {(isSidebarOpen || isDesktopExpanded) && <LanguageToggle currentLanguage={language} onLanguageChange={onLanguageChange} />}
            <button onClick={onLogout} className={`w-full flex items-center ${isSidebarOpen || isDesktopExpanded ? 'space-x-3 px-3 py-2.5' : 'justify-center py-2.5'} rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors`}>
              <span className="text-lg">🚪</span>
              {(isSidebarOpen || isDesktopExpanded) && <span className="font-black text-[11px] uppercase tracking-widest">{t.logout}</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 no-print">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button onClick={() => setIsDesktopExpanded(!isDesktopExpanded)} className="hidden lg:block p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
              {isDesktopExpanded ? '❮' : '❯'}
            </button>
            <div className="flex items-center space-x-2 px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700">
               <div className={`w-2 h-2 rounded-full ${backendOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                 {backendOffline ? 'Local Data' : 'Sync Active'}
               </span>
            </div>
          </div>

          <div className="flex items-center space-x-3 lg:space-x-6">
            <div className="relative group cursor-pointer" onClick={() => handleTabSelect(AdminTab.DASHBOARD)}>
               <span className="text-xl">🔔</span>
               {activeAlertCount > 0 && (
                 <span className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-slate-900">
                   {activeAlertCount}
                 </span>
               )}
            </div>
            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800 hidden sm:block" />
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-none">{currentUser.name}</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">{currentUser.role}</p>
              </div>
              <img src={`https://picsum.photos/seed/${currentUser.id}/120/120`} className="w-8 h-8 lg:w-10 lg:h-10 rounded-xl border-2 border-white dark:border-slate-800 shadow-sm" alt="Avatar" />
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">{children}</div>
        </section>
      </main>
    </div>
  );
};
