
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

const getHostname = () => {
  const host = window.location.hostname;
  return (host && host !== '' && host !== '0.0.0.0') ? host : 'localhost';
};

const API_BASE = `http://${getHostname()}:3001/api`;

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>('de');
  const [backendError, setBackendError] = useState<boolean>(false);
  const [loginReminder, setLoginReminder] = useState<{ show: boolean, count: number } | null>(null);
  
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('gourmetta_auth') === 'true');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('gourmetta_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<string>(AdminTab.DASHBOARD);

  // --- PERSISTENT STATE ---
  const [users, setUsers] = useState<User[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [fridges, setFridges] = useState<Refrigerator[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [fridgeTypes, setFridgeTypes] = useState<RefrigeratorType[]>([]);
  const [cookingMethods, setCookingMethods] = useState<CookingMethod[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<FacilityType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [excludedFacilities, setExcludedFacilities] = useState<FacilityException[]>([]);
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [formResponses, setFormResponses] = useState<FormResponse[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const [legalTexts, setLegalTexts] = useState({
    imprint: "Gourmetta Gastronomie GmbH\nAn der Priessnitzaue 28\n01328 Dresden",
    privacy: "Wir nehmen Datenschutz ernst."
  });

  // --- SYNC ENGINE ---
  const syncEntity = async (type: string, data: any, method: 'POST' | 'DELETE' = 'POST') => {
    try {
        const url = method === 'DELETE' ? `${API_BASE}/${type}/${data.id}` : `${API_BASE}/${type}`;
        await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: method === 'POST' ? JSON.stringify(data) : undefined
        });
        setBackendError(false);
    } catch (e) {
        console.error(`Sync failed for ${type}:`, e);
        setBackendError(true);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const endpoints = [
          'users', 'facilities', 'refrigerators', 'menus', 'facility_types', 
          'cooking_methods', 'fridge_types', 'holidays', 'facility_exceptions', 
          'form_templates', 'assignments', 'reminders', 'readings', 'form_responses', 'audit_logs'
        ];
        const res = await Promise.all(endpoints.map(e => fetch(`${API_BASE}/${e}`)));
        const data = await Promise.all(res.map(r => r.ok ? r.json() : []));
        
        setUsers(data[0]); setFacilities(data[1]); setFridges(data[2]); setMenus(data[3]);
        setFacilityTypes(data[4]); setCookingMethods(data[5]); setFridgeTypes(data[6]);
        setHolidays(data[7]); setExcludedFacilities(data[8]); setForms(data[9]);
        setAssignments(data[10]); setReminders(data[11]); setReadings(data[12]);
        setFormResponses(data[13]); setAuditLogs(data[14]);
        setBackendError(false);
      } catch (e) { setBackendError(true); }
    };
    fetchAll();
  }, []);

  const queueData = async (type: 'reading' | 'form' | 'user' | 'facility', data: any, alertContext?: Alert) => {
    const endpoint = type === 'reading' ? 'readings' : type === 'user' ? 'users' : type === 'facility' ? 'facilities' : 'form_responses';
    if (type === 'reading') { setReadings(prev => [data, ...prev]); if (alertContext) setAlerts(prev => [...prev, alertContext]); }
    if (type === 'form') setFormResponses(prev => [data, ...prev]);

    const smtpStr = localStorage.getItem('gourmetta_smtp');
    const telegramStr = localStorage.getItem('gourmetta_telegram');

    await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, alertData: alertContext, smtpConfig: smtpStr ? JSON.parse(smtpStr) : null, telegramConfig: telegramStr ? JSON.parse(telegramStr) : null })
    });
  };

  const logAction = useCallback((action: AuditLog['action'], entity: string, details: string, userOverride?: User) => {
    const user = userOverride || currentUser;
    if (!user) return;
    const log: AuditLog = { id: `LOG-${Date.now()}`, timestamp: new Date().toISOString(), userId: user.id, userName: user.name, action, entity, details };
    setAuditLogs(prev => [log, ...prev]);
    syncEntity('audit_logs', log);
  }, [currentUser]);

  const handleLogin = (username: string, password?: string, stayLoggedIn?: boolean) => {
    const pool = users.length > 0 ? users : [{id: 'U-SUPER', username: 'super', password: 'super', role: 'SuperAdmin', status: 'Active', name: 'SuperAdmin'} as User];
    const found = pool.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    if (found) {
      setCurrentUser(found); setIsAuthenticated(true);
      localStorage.setItem('gourmetta_auth', 'true'); localStorage.setItem('gourmetta_user', JSON.stringify(found));
      const isPrivileged = found.role !== 'User';
      setActiveTab(isPrivileged ? AdminTab.DASHBOARD : 'user_workspace');
      logAction('LOGIN', 'AUTH', "Angemeldet", found);
    }
  };

  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(null); localStorage.clear(); };

  if (!isAuthenticated || !currentUser) {
    return <Login t={translations[language]} currentLanguage={language} onLanguageChange={setLanguage} onLogin={handleLogin} users={users} legalTexts={legalTexts} backendOffline={backendError} />;
  }

  return (
    <div className="relative min-h-screen">
      {currentUser.role !== 'User' ? (
        <DashboardLayout t={translations[language]} currentUser={currentUser} activeTab={activeTab as AdminTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} alerts={alerts} backendOffline={backendError}>
          {activeTab === AdminTab.USERS ? <UsersPage t={translations[language]} currentUser={currentUser} users={users} setUsers={setUsers} facilities={facilities} onLog={logAction} onSync={(user) => syncEntity('users', user)} /> :
           activeTab === AdminTab.FACILITIES ? <FacilitiesPage t={translations[language]} facilities={facilities} setFacilities={setFacilities} facilityTypes={facilityTypes} cookingMethods={cookingMethods} users={users} fridges={fridges} onLog={logAction} onSync={(fac) => syncEntity('facilities', fac)} onTabChange={(tab) => setActiveTab(tab)} /> :
           activeTab === AdminTab.REFRIGERATORS ? <RefrigeratorsPage t={translations[language]} facilities={facilities} setFacilities={setFacilities} fridges={fridges} setFridges={setFridges} fridgeTypes={fridgeTypes} users={users} setUsers={setUsers} setAssignments={setAssignments} onLog={logAction} setAlerts={setAlerts} /> :
           activeTab === AdminTab.MENUS ? <MenusPage t={translations[language]} menus={menus} setMenus={setMenus} onSync={(m, del) => syncEntity('menus', m, del ? 'DELETE' : 'POST')} /> :
           activeTab === AdminTab.FORM_CREATOR ? <FormCreatorPage t={translations[language]} forms={forms} setForms={setForms} onSync={(f, del) => syncEntity('form_templates', f, del ? 'DELETE' : 'POST')} /> :
           activeTab === AdminTab.ASSIGNMENTS ? <AssignmentsPage t={translations[language]} assignments={assignments} setAssignments={setAssignments} users={users} facilities={facilities} forms={forms} menus={menus} facilityTypes={facilityTypes} onTabChange={setActiveTab as any} onSync={(a, del) => syncEntity('assignments', a, del ? 'DELETE' : 'POST')} /> :
           activeTab === AdminTab.REPORTS ? <ReportsPage t={translations[language]} currentUser={currentUser} readings={readings} formResponses={formResponses} menus={menus} fridges={fridges} users={users} facilities={facilities} excludedFacilities={excludedFacilities} forms={forms} assignments={assignments} /> :
           activeTab === AdminTab.SETTINGS ? <SettingsPage t={translations[language]} facilities={facilities} fridgeTypes={fridgeTypes} setFridgeTypes={setFridgeTypes} cookingMethods={cookingMethods} setCookingMethods={setCookingMethods} facilityTypes={facilityTypes} setFacilityTypes={setFacilityTypes} holidays={holidays} setHolidays={setHolidays} excludedFacilities={excludedFacilities} setExcludedFacilities={setExcludedFacilities} legalTexts={legalTexts} setLegalTexts={setLegalTexts} onSync={(type, data, del) => syncEntity(type, data, del ? 'DELETE' : 'POST')} /> :
           activeTab === AdminTab.REMINDERS ? <RemindersPage t={translations[language]} reminders={reminders} setReminders={setReminders} onLog={logAction} onSync={(rem, del) => syncEntity('reminders', rem, del ? 'DELETE' : 'POST')} /> :
           <AuditLogsPage t={translations[language]} logs={auditLogs} />
          }
        </DashboardLayout>
      ) : (
        <UserDashboardLayout t={translations[language]} activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} language={language} onLanguageChange={setLanguage} assignments={assignments} currentUser={currentUser!} formResponses={formResponses} readings={readings} holidays={holidays} isOnline={!backendError} offlineQueueCount={0} facilities={facilities} facilityTypes={facilityTypes}>
           {activeTab === 'user_workspace' ? <UserWorkspace t={translations[language]} user={currentUser} fridges={fridges} menus={menus} assignments={assignments} readings={readings} onSave={(d, alert) => queueData('reading', d, alert)} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} onViolation={(alert) => setAlerts(prev => [...prev, alert])} formResponses={formResponses} /> :
            activeTab === 'user_forms' ? <UserForms t={translations[language]} user={currentUser} forms={forms} assignments={assignments} excludedFacilities={excludedFacilities} facilityTypes={facilityTypes} facilities={facilities} onSave={(d) => queueData('form', d)} formResponses={formResponses} /> :
            <UserReports t={translations[language]} user={currentUser} readings={readings} menus={menus} fridges={fridges} fridgeTypes={fridgeTypes} cookingMethods={cookingMethods} facilities={facilities} assignments={assignments} formResponses={formResponses} excludedFacilities={excludedFacilities} forms={forms} facilityTypes={facilityTypes} />}
        </UserDashboardLayout>
      )}
    </div>
  );
};

export default App;
