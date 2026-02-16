import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, User, Facility, AuditLog, FacilityType, CookingMethod } from '../types';

interface SmtpConfig {
  host: string;
  port: string;
  encryption: string;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

interface BackupSyncPageProps {
  t: TranslationSet;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  currentUser: User;
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  facilityTypes: FacilityType[];
  cookingMethods: CookingMethod[];
}

export const BackupSyncPage: React.FC<BackupSyncPageProps> = ({ 
  t, users, setUsers, facilities, setFacilities, currentUser, onLog, facilityTypes, cookingMethods 
}) => {
  const [isTestLoadingTelegram, setIsTestLoadingTelegram] = useState(false);
  const [testSuccessTelegram, setTestSuccessTelegram] = useState<boolean | null>(null);
  const [isTestLoadingEmail, setIsTestLoadingEmail] = useState(false);
  const [testSuccessEmail, setTestSuccessEmail] = useState<boolean | null>(null);
  const [importStatus, setImportStatus] = useState<{msg: string, type: 'success' | 'error' | null}>({ msg: '', type: null });

  const [recipientSearch, setRecipientSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Persistent SMTP Config with explicit interface typing
  const [emailConfig, setEmailConfig] = useState<SmtpConfig>(() => {
    const saved = localStorage.getItem('gourmetta_smtp');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved SMTP config", e);
      }
    }
    return { 
      host: 'smtp.gmail.com', 
      port: '587', 
      encryption: 'STARTTLS', 
      user: '', 
      pass: '', 
      from: '', 
      secure: false 
    };
  });

  useEffect(() => {
    localStorage.setItem('gourmetta_smtp', JSON.stringify(emailConfig));
  }, [emailConfig]);

  useEffect(() => {
    if (!emailConfig.from || emailConfig.from === '') {
      setEmailConfig((prev: SmtpConfig) => ({ ...prev, from: prev.user }));
    }
  }, [emailConfig.user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Handle logic if needed
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAlertChannel = async (userId: string, channel: 'emailAlerts' | 'telegramAlerts') => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const updatedUser = { ...user, [channel]: !user[channel] };
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    
    try {
      await fetch(`http://${window.location.hostname}:3001/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
      onLog('UPDATE', 'SYSTEM', `Alarm-Kanal ${channel} für ${user.name} aktualisiert`);
    } catch (e) { console.error(e); }
  };

  const toggleAllFacilities = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const updatedUser = { ...user, allFacilitiesAlerts: !user.allFacilitiesAlerts };
    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    
    try {
      await fetch(`http://${window.location.hostname}:3001/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
    } catch (e) { console.error(e); }
  };

  const downloadCSV = (filename: string, csv: string) => {
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const testEmail = async () => {
    if (!emailConfig.user || !emailConfig.pass) {
        setImportStatus({ msg: 'Email & Passwort benötigt!', type: 'error' });
        setTimeout(() => setImportStatus({msg: '', type: null}), 3000);
        return;
    }
    setIsTestLoadingEmail(true);
    setTestSuccessEmail(null);
    try {
        const res = await fetch(`http://${window.location.hostname}:3001/api/test-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...emailConfig,
                secure: emailConfig.port === '465'
            })
        });
        const data = await res.json();
        if (data.success) {
            setTestSuccessEmail(true);
        } else {
            throw new Error(data.error);
        }
    } catch (err: any) {
        console.error(err);
        setTestSuccessEmail(false);
    } finally {
        setIsTestLoadingEmail(false);
        setTimeout(() => setTestSuccessEmail(null), 5000);
    }
  };

  const handleExportUsers = () => {
    const headers = ['ID', 'Name', 'Username', 'Email', 'Role', 'Status', 'FacilityID'];
    const rows = users.map(u => [u.id, `"${u.name}"`, `"${u.username}"`, `"${u.email || ''}"`, u.role, u.status, u.facilityId || '']);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadCSV(`Gourmetta_Users_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const handleExportFacilities = () => {
    const headers = ['ID', 'Name', 'FridgeCount', 'TypeID', 'CookingMethodID', 'SupervisorID'];
    const rows = facilities.map(f => [f.id, `"${f.name}"`, f.refrigeratorCount, f.typeId || '', f.cookingMethodId || '', f.supervisorId || '']);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadCSV(`Gourmetta_Facilities_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  const alertPrivilegedUsers = useMemo(() => {
    return users.filter(u => (u.role === 'Admin' || u.role === 'Manager' || u.role === 'SuperAdmin') && 
      (u.name.toLowerCase().includes(recipientSearch.toLowerCase()) || u.role.toLowerCase().includes(recipientSearch.toLowerCase()))
    );
  }, [users, recipientSearch]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      {importStatus.type && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4">
              <div className={`px-8 py-4 rounded-2xl shadow-2xl text-white font-black uppercase text-xs ${importStatus.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {importStatus.msg}
              </div>
          </div>
      )}

      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Backup & Alarme</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Systemverwaltung & Benachrichtigungen</p>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 dark:border-slate-800 pb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">🔔 Alarmempfänger</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Wer soll im Fehlerfall benachrichtigt werden?</p>
          </div>
          <div className="relative w-full md:w-72">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
             <input type="text" placeholder="Empfänger suchen..." value={recipientSearch} onChange={e => setRecipientSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {alertPrivilegedUsers.map(user => (
             <div key={user.id} className="group bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 flex flex-col lg:flex-row items-center justify-between gap-6 hover:bg-white hover:shadow-xl transition-all border-l-8 border-l-blue-100 group-hover:border-l-blue-500">
                <div className="flex items-center space-x-6 min-w-0 flex-1">
                   <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-2xl shrink-0">{user.role === 'Manager' ? '👨‍🍳' : '🛡️'}</div>
                   <div className="truncate">
                      <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none mb-1">{user.name}</p>
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{user.role}</span>
                      {user.email && <p className="text-[10px] text-slate-400 font-bold mt-1">{user.email}</p>}
                   </div>
                </div>

                <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 space-x-2">
                   <button onClick={() => toggleAlertChannel(user.id, 'emailAlerts')} className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all ${user.emailAlerts ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                     <span className="text-base">✉️</span>
                     <span className="text-[10px] font-black uppercase">E-Mail</span>
                   </button>
                </div>

                <div className="flex-1 flex items-center justify-end w-full lg:w-auto">
                   <div className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="flex items-center space-x-3 pr-4 border-r border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alle Standorte</label>
                           <button onClick={() => toggleAllFacilities(user.id)} className={`w-12 h-6 rounded-full transition-all relative ${user.allFacilitiesAlerts ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${user.allFacilitiesAlerts ? 'left-6.5' : 'left-0.5'}`} />
                           </button>
                        </div>
                        {user.allFacilitiesAlerts ? (
                          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800 text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center space-x-2">
                             <span>🌍</span><span>Globales Monitoring</span>
                          </div>
                        ) : (
                          <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-emerald-600 font-black text-[10px] uppercase tracking-widest">
                             Nur eigener Standort
                          </div>
                        )}
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-8xl">✉️</div>
          <div className="mb-8">
             <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">E-Mail Server (SMTP)</h2>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Zentraler Postausgangsserver für Alarme</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">SMTP Host</label>
              <input type="text" value={emailConfig.host} onChange={e => setEmailConfig({...emailConfig, host: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="smtp.gmail.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Port</label>
                <input type="text" value={emailConfig.port} onChange={e => setEmailConfig({...emailConfig, port: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none text-center" placeholder="587" />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Art</label>
                <select value={emailConfig.encryption} onChange={e => setEmailConfig({...emailConfig, encryption: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none h-[56px]">
                  <option value="STARTTLS">STARTTLS (Port 587)</option>
                  <option value="SSL/TLS">SSL/TLS (Port 465)</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Benutzer (Login)</label>
              <input type="email" value={emailConfig.user} onChange={e => setEmailConfig({...emailConfig, user: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="beispiel@gmail.com" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Passwort / App-Key</label>
              <input type="password" value={emailConfig.pass} onChange={e => setEmailConfig({...emailConfig, pass: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="••••••••" />
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-300 uppercase italic">Konfiguration wird lokal im Browser gesichert</span>
            <button onClick={testEmail} disabled={isTestLoadingEmail} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center space-x-3 ${testSuccessEmail === true ? 'bg-emerald-500 text-white' : testSuccessEmail === false ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
               {isTestLoadingEmail ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>⚡</span>}
               <span>{testSuccessEmail === true ? 'Erfolgreich' : testSuccessEmail === false ? 'Fehlgeschlagen' : 'Verbindung Testen'}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col space-y-8">
           <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-10 rounded-[3.5rem] shadow-2xl text-white">
              <h3 className="text-lg font-black uppercase tracking-tight mb-2">Schnell-Backup</h3>
              <p className="text-xs text-white/70 font-bold uppercase tracking-widest mb-8">Exportieren Sie alle Systemdaten</p>
              <div className="flex flex-col space-y-3">
                 <button onClick={handleExportUsers} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 font-black text-[10px] uppercase tracking-widest transition-all">Nutzer Export (CSV)</button>
                 <button onClick={handleExportFacilities} className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl border border-white/20 font-black text-[10px] uppercase tracking-widest transition-all">Standorte Export (CSV)</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};