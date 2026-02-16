
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
  const [loginReminder, setLoginReminder] = useState<{ show: boolean, count: number } | null>(null);
  
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
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
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
      id: 'F-SUPERVISOR-AUDIT', 
      title: '🛡️ Supervisor Audit (System)', 
      description: 'Präsenzprüfung durch den zuständigen Supervisor', 
      questions: [
        { id: 'Q-SUPER-VISIT', text: 'Hat der Supervisor heute persönlich am Standort vorbeigeschaut?', type: 'yesno' }
      ], 
      requiresSignature: true, 
      createdAt: '2024-01-01' 
    },
    { 
      id: 'F-HYGIENE-DAILY', 
      title: 'Täglicher Hygiene-Check', 
      description: 'HACCP Standardkontrolle', 
      questions: [
        { id: 'Q-H1', text: 'Sind alle Oberflächen sauber?', type: 'yesno' },
        { id: 'Q-H2', text: 'Personalbekleidung korrekt?', type: 'yesno' }
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
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const endpoints = ['users', 'facilities', 'readings', 'forms'];
        const results = await Promise.all(endpoints.map(ep => fetch(`${API_BASE}/${ep}`, { signal: controller.signal })));
        
        clearTimeout(timeoutId);

        if (results[0].ok) setUsers(await results[0].json());
        if (results[1].ok) setFacilities(await results[1].json());
        if (results[2].ok) setReadings(await results[2].json());
        if (results[3].ok) setFormResponses(await results[3].json());
        setBackendError(false);
      } catch (err) {
        setBackendError(true);
      }
    };
    fetchData();
  }, []);

  const queueData = async (type: 'reading' | 'form' | 'user' | 'facility', data: any, alertContext?: Alert) => {
    const endpoint = type === 'reading' ? 'readings' : type === 'user' ? 'users' : type === 'facility' ? 'facilities' : 'forms';
    
    if (type === 'reading') {
        setReadings(prev => [data, ...prev]);
        if (alertContext) setAlerts(prev => [...prev, alertContext]);
    }
    if (type === 'form') setFormResponses(prev => [data, ...prev]);

    try {
        const smtpStr = localStorage.getItem('gourmetta_smtp');
        const telegramStr = localStorage.getItem('gourmetta_telegram');

        await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                alertData: alertContext,
                smtpConfig: smtpStr ? JSON.parse(smtpStr) : null,
                telegramConfig: telegramStr ? JSON.parse(telegramStr) : null
            })
        });
    } catch (e) {
        console.warn(`Sync failed for ${type}. Local only.`);
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
      const initialTab = isPrivileged ? AdminTab.DASHBOARD : 'user_workspace';
      setActiveTab(initialTab);
      logAction('LOGIN', 'AUTH', "Erfolgreiche Anmeldung", foundUser);

      // Trigger Task Reminder for users
      if (!isPrivileged) {
          const today = new Date().toISOString().split('T')[0];
          const myFac = facilities.find(f => f.id === foundUser.facilityId);
          const activeTasks = assignments.filter(a => {
             const isMatch = (a.targetType === 'user' && a.targetId === foundUser.id) || 
                             (a.targetType === 'facility' && a.targetId === foundUser.facilityId) ||
                             (a.targetType === 'facilityType' && a.targetId === myFac?.typeId);
             const alreadyDone = formResponses.some(fr => fr.formId === a.resourceId && fr.timestamp.startsWith(today) && (fr.userId === foundUser.id || fr.facilityId === foundUser.facilityId));
             return isMatch && a.resourceType === 'form' && !alreadyDone;
          }).length;

          if (activeTasks > 0) {
              setLoginReminder({ show: true, count: activeTasks });
              setTimeout(() => setLoginReminder(null), 3500);
          }
      }
    }
  };

  const logAction = useCallback((action: AuditLog['action'], entity: string, details: string, userOverride?: User) => {
    const user = userOverride || currentUser;
    if (!user) return;
    setAuditLogs(prev => [{
      id: "LOG-" + Date.now(), timestamp: new Date().toISOString(),
      userId: user.id, userName: user.name, action, entity, details
    }, ...prev]);
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
    logAction('UPDATE', 'ALERTS', `Alarm ${id} erledigt`);
  };

  const resolveAllAlerts = () => {
    setAlerts(prev => prev.map(a => ({ ...a, resolved: true })));
    logAction('UPDATE', 'ALERTS', `Alle Alarme erledigt`);
  };

  const globalGreenImpact = useMemo(() => {
    const formPages = formResponses.length;
    const fridgeEntries = readings.filter(r => r.targetType === 'refrigerator').length;
    const totalA4 = formPages + Math.ceil(fridgeEntries / 10);
    return { totalA4, tonerSaved: (totalA4 / 1500).toFixed(4) };
  }, [readings, formResponses]);

  if (!isAuthenticated || !currentUser) {
    return <Login t={translations[language]} currentLanguage={language} onLanguageChange={setLanguage} onLogin={handleLogin} users={users} legalTexts={legalTexts} backendOffline={backendError} />;
  }

  const activeAlerts = alerts.filter(a => !a.resolved);

  return (
    <div className="relative min-h-screen">
      {/* Login Reminder Overlay */}
      {loginReminder?.show && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 pointer-events-none">
           <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500/50 p-10 rounded-[3.5rem] shadow-[0_0_100px_rgba(16,185,129,0.2)] text-center animate-in zoom-in-90 fade-in duration-500 max-w-md">
              <div className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-xl animate-bounce">📋</div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic mb-4">Guten Tag, {currentUser.name}!</h2>
              <p className="text-slate-400 font-bold text-lg leading-relaxed">
                 Sie haben heute noch <span className="text-emerald-400 font-black">{loginReminder.count} Checklisten</span> zu erledigen.
              </p>
              <div className="mt-8 flex justify-center space-x-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-100" />
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-200" />
              </div>
           </div>
        </div>
      )}

      {currentUser.role === 'Admin' || currentUser.role === 'Manager' || currentUser.role === 'SuperAdmin' ? (
        <DashboardLayout t={translations[language]} currentUser={currentUser} activeTab={activeTab as AdminTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} alerts={alerts} backendOffline={backendError}>
          {activeTab === AdminTab.USERS ? <UsersPage t={translations[language]} currentUser={currentUser} users={users} setUsers={setUsers} facilities={facilities} onLog={logAction} onSync={(u) => queueData('user', u)} /> :
           activeTab === AdminTab.FACILITIES ? <FacilitiesPage t={translations[language]} facilities={facilities} setFacilities={setFacilities} facilityTypes={facilityTypes} cookingMethods={cookingMethods} users={users} fridges={fridges} onLog={logAction} onSync={(f) => queueData('facility', f)} onTabChange={(tab) => setActiveTab(tab)} /> :
           activeTab === AdminTab.REFRIGERATORS ? <RefrigeratorsPage t={translations[language]} facilities={facilities} setFacilities={setFacilities} fridges={fridges} setFridges={setFridges} fridgeTypes={fridgeTypes} users={users} setUsers={setUsers} setAssignments={setAssignments} onLog={logAction} setAlerts={setAlerts} /> :
           activeTab === AdminTab.MENUS ? <MenusPage t={translations[language]} menus={menus} setMenus={setMenus} /> :
           activeTab === AdminTab.FORM_CREATOR ? <FormCreatorPage t={translations[language]} forms={forms} setForms={setForms} /> :
           activeTab === AdminTab.ASSIGNMENTS ? <AssignmentsPage t={translations[language]} assignments={assignments} setAssignments={setAssignments} users={users} facilities={facilities} forms={forms} menus={menus} facilityTypes={facilityTypes} onTabChange={setActiveTab as any} /> :
           activeTab === AdminTab.REPORTS ? <ReportsPage t={translations[language]} currentUser={currentUser} readings={readings} formResponses={formResponses} menus={menus} fridges={fridges} users={users} facilities={facilities} excludedFacilities={excludedFacilities} forms={forms} assignments={assignments} /> :
           activeTab === AdminTab.FACILITY_ANALYTICS ? <FacilityAnalyticsPage t={translations[language]} facilities={facilities} alerts={alerts} readings={readings} facilityTypes={facilityTypes} /> :
           activeTab === AdminTab.REMINDERS ? <RemindersPage t={translations[language]} reminders={reminders} setReminders={setReminders} onLog={logAction} /> :
           activeTab === AdminTab.SETTINGS ? <SettingsPage t={translations[language]} facilities={facilities} fridgeTypes={fridgeTypes} setFridgeTypes={setFridgeTypes} cookingMethods={cookingMethods} setCookingMethods={setCookingMethods} facilityTypes={facilityTypes} setFacilityTypes={setFacilityTypes} holidays={holidays} setHolidays={setHolidays} excludedFacilities={excludedFacilities} setExcludedFacilities={setExcludedFacilities} legalTexts={legalTexts} setLegalTexts={setLegalTexts} /> :
           activeTab === AdminTab.BACKUP_SYNC ? <BackupSyncPage t={translations[language]} users={users} setUsers={setUsers} facilities={facilities} setFacilities={setFacilities} currentUser={currentUser} onLog={logAction} facilityTypes={facilityTypes} cookingMethods={cookingMethods} /> :
           activeTab === AdminTab.AUDIT_LOGS ? <AuditLogsPage t={translations[language]} logs={auditLogs} /> :
           <div className="space-y-10 animate-in fade-in duration-700 text-left pb-16">
              <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center md:items-start justify-between gap-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                <div className="flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 z-10">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center p-4 shadow-inner">
                      <img src={LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
                    </div>
                    <div className="text-center md:text-left">
                      <h1 className="text-4xl font-black text-slate-900 dark:text-white italic tracking-tighter uppercase mb-2">gourmetta</h1>
                      <span className="text-2xl font-bold text-slate-400 tracking-tight">Willkommen, {currentUser.name}</span>
                    </div>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 p-8 rounded-[2.5rem] flex flex-col justify-center items-center text-center shadow-inner relative z-10">
                    <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-3xl mb-3 shadow-md">🍃</div>
                    <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Systemweiter Go Green Impact</p>
                    <div className="flex items-baseline justify-center space-x-1">
                        <span className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{globalGreenImpact.totalA4}</span>
                        <span className="text-[10px] font-black text-emerald-600/60 uppercase">Seiten gespart</span>
                    </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <span className="text-3xl block mb-2">🏢</span><span className="text-3xl font-black text-blue-600">{facilities.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Standorte</p>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <span className="text-3xl block mb-2">👥</span><span className="text-3xl font-black text-indigo-600">{users.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Benutzer</p>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <span className="text-3xl block mb-2">📄</span><span className="text-3xl font-black text-emerald-600">{readings.length + formResponses.length}</span><p className="text-[10px] font-black uppercase text-slate-400">Digitale Logs</p>
                  </div>
                  <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <span className="text-3xl block mb-2">🖨️</span><span className="text-3xl font-black text-slate-900">{globalGreenImpact.tonerSaved}</span><p className="text-[10px] font-black uppercase text-slate-400">Toner kg gespart</p>
                  </div>
              </div>
              {activeAlerts.length > 0 && (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex justify-between items-end mb-6">
                    <h2 className="text-2xl font-black text-rose-600 uppercase tracking-tighter italic">⚠️ Kritische Alarme</h2>
                    <button onClick={resolveAllAlerts} className="px-6 py-2.5 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Alle erledigt ✓</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeAlerts.map(alert => (
                      <div key={alert.id} className="bg-white dark:bg-slate-900 border-l-[12px] border-rose-500 rounded-[2.5rem] p-8 shadow-xl shadow-rose-500/10 flex flex-col justify-between group">
                        <div>
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-1 rounded">Limit verletzt</span>
                            <span className="text-[9px] font-mono text-slate-400">{new Date(alert.timestamp).toLocaleTimeString('de-DE')}</span>
                          </div>
                          <h3 className="text-xl font-black text-slate-900 uppercase leading-tight mb-1">{alert.facilityName}</h3>
                          <p className="font-bold text-slate-500 text-sm mb-6">{alert.targetName}</p>
                          <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 mb-8">
                             <div className="flex justify-between items-center">
                                <div><p className="text-[8px] font-black text-rose-400 uppercase mb-1">Gemessen</p><p className="text-3xl font-black text-rose-600 font-mono">{alert.value.toFixed(1)}°C</p></div>
                                <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Limit</p><p className="text-sm font-black text-slate-700 font-mono">{alert.min}° bis {alert.max}°C</p></div>
                             </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{alert.userName}</span>
                           <button onClick={() => resolveAlert(alert.id)} className="px-5 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-500 transition-all">Erledigt</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
           </div>
          }
        </DashboardLayout>
      ) : (
        <UserDashboardLayout t={translations[language]} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} assignments={assignments} currentUser={currentUser!} formResponses={formResponses} readings={readings} holidays={holidays} isOnline={!backendError} offlineQueueCount={0} facilities={facilities} facilityTypes={facilityTypes}>
          {activeTab === 'user_workspace' ? <UserWorkspace t={translations[language]} user={currentUser} fridges={fridges} menus={menus} assignments={assignments} readings={readings} onSave={(d, alert) => { queueData('reading', d, alert); }} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} onViolation={(alert) => setAlerts(prev => [...prev, alert])} formResponses={formResponses} /> :
           activeTab === 'user_forms' ? <UserForms t={translations[language]} user={currentUser} forms={forms} assignments={assignments} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} facilities={facilities} onSave={(d) => queueData('form', d)} formResponses={formResponses} /> :
           <UserReports t={translations[language]} user={currentUser} readings={readings} menus={menus} fridges={fridges} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} assignments={assignments} formResponses={formResponses} excludedFacilities={excludedFacilities} forms={forms} facilityTypes={facilityTypes} />}
        </UserDashboardLayout>
      )}
    </div>
  );
};

export default App;
