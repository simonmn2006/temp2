
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Language, AdminTab, User, Facility, Refrigerator, Assignment, Menu, FormTemplate, Reading, FormResponse, RefrigeratorType, CookingMethod, FacilityType, Holiday, FacilityException, Alert, AuditLog, ReminderConfig } from './types';
import { translations } from './translations';
import { Login } from './pages/Login';
import { DashboardLayout } from './components/DashboardLayout';
import { UserDashboardLayout } from './components/UserDashboardLayout';
import { UsersPage } from './pages/Users';
import { FacilitiesPage } from './pages/Facilities';
import { RefrigeratorsPage } from './pages/Refrigerators';
import { MenusPage } from './pages/Menus';
import { FormCreatorPage } from './pages/FormCreator';
import { AssignmentsPage } from './pages/Assignments';
import { ReportsPage } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { BackupSyncPage } from './pages/BackupSync';
import { AuditLogsPage } from './pages/AuditLogs';
import { UserWorkspace } from './pages/UserWorkspace';
import { UserForms } from './pages/UserForms';
import { UserReports } from './pages/UserReports';
import { FacilityAnalyticsPage } from './pages/FacilityAnalytics';
import { RemindersPage } from './pages/Reminders';

const LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

const getHostname = () => {
  const host = window.location.hostname;
  return (host && host !== '' && host !== '0.0.0.0') ? host : 'localhost';
};

const API_BASE = `http://${getHostname()}:3001/api`;

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('de');
  const [backendError, setBackendError] = useState<boolean>(false);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('gourmetta_auth') === 'true' || sessionStorage.getItem('gourmetta_auth') === 'true';
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('gourmetta_user') || sessionStorage.getItem('gourmetta_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  const [activeTab, setActiveTab] = useState<string>(AdminTab.DASHBOARD);

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('gourmetta_cache_users');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [facilities, setFacilities] = useState<Facility[]>(() => {
    try {
      const saved = localStorage.getItem('gourmetta_cache_facilities');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [fridges, setFridges] = useState<Refrigerator[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  const [fridgeTypes, setFridgeTypes] = useState<RefrigeratorType[]>([
    { id: 'RT1', name: 'Kühlschrank (+2 bis +7°C)', checkpoints: [{ name: 'Luft', minTemp: 2, maxTemp: 7 }] },
    { id: 'RT2', name: 'Tiefkühler (-18 bis -22°C)', checkpoints: [{ name: 'Luft', minTemp: -22, maxTemp: -18 }] }
  ]);
  const [cookingMethods, setCookingMethods] = useState<CookingMethod[]>([
    { id: 'CM1', name: 'Standard Cook & Serve', checkpoints: [{ name: 'Kern', minTemp: 72, maxTemp: 95 }] }
  ]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([
    { id: 'FT1', name: 'Kantine' }, { id: 'FT2', name: 'Kita/Schule' }
  ]);
  
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [excludedFacilities, setExcludedFacilities] = useState<FacilityException[]>([]);
  const [menus, setMenus] = useState<Menu[]>([{ id: 'M1', name: 'Menü A (Tagesgericht)' }]);
  const [forms, setForms] = useState<FormTemplate[]>([
    { 
      id: 'F-SUP-CHECK', 
      title: 'Täglicher Hygiene-Check', 
      description: 'Standardabfrage der HACCP Richtlinien', 
      questions: [
        { id: 'Q-CLEAN', text: 'Sind alle Arbeitsflächen desinfiziert?', type: 'yesno' },
        { id: 'Q-PERS', text: 'Ist die persönliche Schutzkleidung vollständig?', type: 'yesno' }
      ], 
      requiresSignature: true, 
      createdAt: '2024-01-01' 
    }
  ]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [legalTexts, setLegalTexts] = useState({
    imprint: "Gourmetta Gastronomie GmbH\nAn der Priessnitzaue 28\n01328 Dresden",
    privacy: "Wir nehmen Datenschutz ernst. Diese App speichert Messdaten in Ihrer MariaDB."
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        
        const [uRes, fRes, rRes] = await Promise.all([
          fetch(`${API_BASE}/users`, { signal: controller.signal }),
          fetch(`${API_BASE}/facilities`, { signal: controller.signal }),
          fetch(`${API_BASE}/readings`, { signal: controller.signal })
        ]);
        
        clearTimeout(timeoutId);

        if (uRes.ok) {
            const data = await uRes.json();
            if (data && Array.isArray(data)) {
              setUsers(data);
              localStorage.setItem('gourmetta_cache_users', JSON.stringify(data));
            }
        }
        if (fRes.ok) {
            const data = await fRes.json();
            if (data && Array.isArray(data)) {
              setFacilities(data);
              localStorage.setItem('gourmetta_cache_facilities', JSON.stringify(data));
            }
        }
        if (rRes.ok) setReadings(await rRes.json());
        setBackendError(false);
      } catch (err) {
        setBackendError(true);
      }
    };
    fetchData();
  }, []);

  const queueData = async (type: 'reading' | 'form' | 'user' | 'facility', data: any, alertContext?: Alert) => {
    const endpoint = type === 'reading' ? 'readings' : type === 'user' ? 'users' : type === 'facility' ? 'facilities' : 'forms';
    
    // Immediate local state updates for responsiveness
    if (type === 'user') {
      const nextUsers = [...users.filter(u => u.id !== data.id), data];
      setUsers(nextUsers);
      localStorage.setItem('gourmetta_cache_users', JSON.stringify(nextUsers));
    }
    if (type === 'facility') {
      const nextFacs = [...facilities.filter(f => f.id !== data.id), data];
      setFacilities(nextFacs);
      localStorage.setItem('gourmetta_cache_facilities', JSON.stringify(nextFacs));
    }
    if (type === 'reading') setReadings(prev => [data, ...prev]);
    if (type === 'form') setFormResponses(prev => [data, ...prev]);

    try {
        const smtpStr = localStorage.getItem('gourmetta_smtp');
        const smtpConfig = smtpStr ? JSON.parse(smtpStr) : null;
        
        const telegramStr = localStorage.getItem('gourmetta_telegram');
        const telegramConfig = telegramStr ? JSON.parse(telegramStr) : null;

        await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                alertData: alertContext,
                smtpConfig: smtpConfig ? { ...smtpConfig, secure: smtpConfig.port === '465' } : null,
                telegramConfig: telegramConfig
            })
        });
    } catch (e) {
        console.warn(`Sync failed for ${type}. Local only for now.`);
    }
  };

  const handleLogin = (username: string, password?: string, stayLoggedIn?: boolean) => {
    const pool = users.length > 0 ? users : [{id: 'U-SUPER', name: 'System SuperAdmin', username: 'super', password: 'super', role: 'SuperAdmin', status: 'Active'} as User];
    const foundUser = pool.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (foundUser) {
      setCurrentUser(foundUser);
      setIsAuthenticated(true);
      
      const storage = stayLoggedIn ? localStorage : sessionStorage;
      storage.setItem('gourmetta_auth', 'true');
      storage.setItem('gourmetta_user', JSON.stringify(foundUser));

      const isPrivileged = foundUser.role === 'Admin' || foundUser.role === 'Manager' || foundUser.role === 'SuperAdmin';
      setActiveTab(isPrivileged ? AdminTab.DASHBOARD : 'user_workspace');
      logAction('LOGIN', 'AUTH', "Erfolgreiche Anmeldung", foundUser);
    }
  };

  const logAction = useCallback((action: AuditLog['action'], entity: string, details: string, userOverride?: User) => {
    const user = userOverride || currentUser;
    if (!user) return;
    const newLog: AuditLog = {
      id: "LOG-" + Date.now(), timestamp: new Date().toISOString(),
      userId: user.id, userName: user.name, action, entity, details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  }, [currentUser]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('gourmetta_auth');
    localStorage.removeItem('gourmetta_user');
    sessionStorage.removeItem('gourmetta_auth');
    sessionStorage.removeItem('gourmetta_user');
  };

  const resolveAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));
    logAction('UPDATE', 'ALERTS', `Alarm ${id} als erledigt markiert`);
  };

  const resolveAllAlerts = () => {
    setAlerts(prev => prev.map(a => ({ ...a, resolved: true })));
    logAction('UPDATE', 'ALERTS', `Alle Alarme als erledigt markiert`);
  };

  const globalGreenImpact = useMemo(() => {
    const formPages = formResponses.length;
    const menuDays = new Set(readings.filter(r => r.targetType === 'menu').map(r => r.timestamp.split('T')[0] + r.facilityId)).size;
    const fridgeEntries = readings.filter(r => r.targetType === 'refrigerator').length;
    const totalA4 = formPages + menuDays + Math.ceil(fridgeEntries / 10);
    return { totalA4, tonerSaved: (totalA4 / 1500).toFixed(4) };
  }, [readings, formResponses]);

  if (!isAuthenticated || !currentUser) {
    return <Login t={translations[language]} currentLanguage={language} onLanguageChange={setLanguage} onLogin={handleLogin} users={users} legalTexts={legalTexts} backendOffline={backendError} />;
  }

  const renderAdminContent = () => {
    const t = translations[language];
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    switch (activeTab) {
      case AdminTab.USERS: return <UsersPage t={t} currentUser={currentUser} users={users} setUsers={setUsers} facilities={facilities} onLog={logAction} onSync={(u) => queueData('user', u)} />;
      case AdminTab.FACILITIES: return <FacilitiesPage t={t} facilities={facilities} setFacilities={setFacilities} facilityTypes={facilityTypes} cookingMethods={cookingMethods} users={users} fridges={fridges} onLog={logAction} onSync={(f) => queueData('facility', f)} onTabChange={(tab) => setActiveTab(tab)} />;
      case AdminTab.REFRIGERATORS: return <RefrigeratorsPage t={t} facilities={facilities} setFacilities={setFacilities} fridges={fridges} setFridges={setFridges} fridgeTypes={fridgeTypes} users={users} setUsers={setUsers} setAssignments={setAssignments} onLog={logAction} setAlerts={setAlerts} />;
      case AdminTab.MENUS: return <MenusPage t={t} menus={menus} setMenus={setMenus} />;
      case AdminTab.FORM_CREATOR: return <FormCreatorPage t={t} forms={forms} setForms={setForms} />;
      case AdminTab.ASSIGNMENTS: return <AssignmentsPage t={t} assignments={assignments} setAssignments={setAssignments} users={users} facilities={facilities} forms={forms} menus={menus} facilityTypes={facilityTypes} onTabChange={setActiveTab as any} />;
      case AdminTab.REPORTS: return <ReportsPage t={t} currentUser={currentUser} readings={readings} formResponses={formResponses} menus={menus} fridges={fridges} users={users} facilities={facilities} excludedFacilities={excludedFacilities} forms={forms} assignments={assignments} />;
      case AdminTab.FACILITY_ANALYTICS: return <FacilityAnalyticsPage t={t} facilities={facilities} alerts={alerts} readings={readings} facilityTypes={facilityTypes} />;
      case AdminTab.REMINDERS: return <RemindersPage t={t} reminders={reminders} setReminders={setReminders} onLog={logAction} />;
      case AdminTab.SETTINGS: return <SettingsPage t={t} facilities={facilities} fridgeTypes={fridgeTypes} setFridgeTypes={setFridgeTypes} cookingMethods={cookingMethods} setCookingMethods={setCookingMethods} facilityTypes={facilityTypes} setFacilityTypes={setFacilityTypes} holidays={holidays} setHolidays={setHolidays} excludedFacilities={excludedFacilities} setExcludedFacilities={setExcludedFacilities} legalTexts={legalTexts} setLegalTexts={setLegalTexts} />;
      case AdminTab.BACKUP_SYNC: return <BackupSyncPage t={t} users={users} setUsers={setUsers} facilities={facilities} setFacilities={setFacilities} currentUser={currentUser} onLog={logAction} facilityTypes={facilityTypes} cookingMethods={cookingMethods} />;
      case AdminTab.AUDIT_LOGS: return <AuditLogsPage t={t} logs={auditLogs} />;
      default: return (
          <div className="space-y-10 animate-in fade-in duration-700 text-left pb-16">
            {activeAlerts.length > 0 && (
              <div className="animate-in slide-in-from-top-4 duration-500">
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tighter italic">⚠️ Kritische Alarme</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Eingreifen erforderlich: Abweichungen festgestellt</p>
                  </div>
                  <button 
                    onClick={resolveAllAlerts}
                    className="px-6 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-rose-700 transition-all active:scale-95"
                  >
                    Alle erledigt ✓
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {activeAlerts.map(alert => (
                     <div key={alert.id} className="bg-white dark:bg-slate-900 border-l-[12px] border-rose-500 rounded-[2.5rem] p-8 shadow-xl shadow-rose-500/10 flex flex-col justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                           <span className="text-6xl">🚨</span>
                        </div>
                        <div>
                           <div className="flex justify-between items-start mb-4">
                              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded">Grenzwert verletzt</span>
                              <span className="text-[9px] font-mono text-slate-400">{new Date(alert.timestamp).toLocaleTimeString('de-DE')}</span>
                           </div>
                           <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-tight mb-1">{alert.facilityName}</h3>
                           <p className="font-bold text-slate-500 text-sm mb-6">{alert.targetName} &bull; {alert.checkpointName}</p>
                           
                           <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border border-rose-100 dark:border-rose-800 mb-8">
                              <div className="flex justify-between items-center">
                                 <div>
                                    <p className="text-[8px] font-black text-rose-400 uppercase mb-1">Gemessen</p>
                                    <p className="text-3xl font-black text-rose-600 font-mono italic tracking-tighter">{alert.value.toFixed(1)}°C</p>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Limit</p>
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-300 font-mono">{alert.min}° bis {alert.max}°C</p>
                                 </div>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-2">
                              <img src={`https://picsum.photos/seed/${alert.userId}/40/40`} className="w-6 h-6 rounded-full grayscale" alt="User" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{alert.userName}</span>
                           </div>
                           <button 
                             onClick={() => resolveAlert(alert.id)}
                             className="px-5 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg"
                           >
                             Erledigt
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
               <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 z-10">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center p-4 shadow-inner">
                     <img src={LOGO_URL} className="w-full h-full object-contain" alt="Gourmetta Logo" />
                  </div>
                  <div className="text-center md:text-left">
                     <h1 className="text-4xl font-black text-slate-900 dark:text-white italic tracking-tighter leading-none mb-2 uppercase">gourmetta</h1>
                     <span className="text-2xl font-bold text-slate-400 tracking-tight">Willkommen, {currentUser.name}</span>
                  </div>
               </div>
               <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center shadow-inner relative group min-w-[240px] z-10">
                  <div className="absolute top-2 right-4 text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Gourmetta Go Green</div>
                  <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-3xl mb-3 shadow-md group-hover:scale-110 transition-transform duration-500">🍃</div>
                  <div className="space-y-1">
                     <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Systemweiter Beitrag</p>
                     <div className="flex items-baseline justify-center space-x-1">
                        <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{globalGreenImpact.totalA4}</span>
                        <span className="text-[10px] font-black text-emerald-600/60 uppercase">Seiten gespart</span>
                     </div>
                  </div>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100"><span className="text-3xl block mb-2">🏢</span><span className="text-3xl font-black text-blue-600">{facilities.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Standorte</p></div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100"><span className="text-3xl block mb-2">👥</span><span className="text-3xl font-black text-indigo-600">{users.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Benutzer</p></div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100"><span className="text-3xl block mb-2">📄</span><span className="text-3xl font-black text-emerald-600">{readings.length + formResponses.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Digitale Einträge</p></div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100"><span className="text-3xl block mb-2">🖨️</span><span className="text-3xl font-black text-slate-900">{globalGreenImpact.tonerSaved}</span><p className="text-[10px] font-black uppercase text-slate-400">Toner gespart</p></div>
            </div>
            {backendError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center space-x-3 text-amber-700 font-bold text-xs uppercase tracking-widest animate-pulse">
                <span>⚠️</span><span>LOKALER VAULT AKTIV (Server Offline). Daten werden im Browser gesichert.</span>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="relative">
      {currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || currentUser?.role === 'SuperAdmin' ? (
        <DashboardLayout t={translations[language]} currentUser={currentUser} activeTab={activeTab as AdminTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} alerts={alerts} backendOffline={backendError}>
          {renderAdminContent()}
        </DashboardLayout>
      ) : (
        <UserDashboardLayout t={translations[language]} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} assignments={assignments} currentUser={currentUser!} formResponses={formResponses} readings={readings} holidays={holidays} isOnline={!backendError} isSyncing={false} offlineQueueCount={0} facilities={facilities} facilityTypes={facilityTypes}>
          {activeTab === 'user_workspace' ? <UserWorkspace t={translations[language]} user={currentUser} fridges={fridges} menus={menus} assignments={assignments} readings={readings} onSave={(d, alert) => { queueData('reading', d, alert); if(alert) setAlerts(prev => [...prev, alert]); }} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} onViolation={(alert) => setAlerts(prev => [...prev, alert])} formResponses={formResponses} /> :
           activeTab === 'user_forms' ? <UserForms t={translations[language]} user={currentUser} forms={forms} assignments={assignments} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} facilities={facilities} onSave={(d) => queueData('form', d)} formResponses={formResponses} /> :
           <UserReports t={translations[language]} user={currentUser} readings={readings} menus={menus} fridges={fridges} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} assignments={assignments} formResponses={formResponses} excludedFacilities={excludedFacilities} forms={forms} facilityTypes={facilityTypes} />}
        </UserDashboardLayout>
      )}
    </div>
  );
};

export default App;
