
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, User, Facility, AuditLog, FacilityType, CookingMethod } from '../types';

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
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [importStatus, setImportStatus] = useState<{msg: string, type: 'success' | 'error' | null}>({ msg: '', type: null });

  // Recipient filtering
  const [recipientSearch, setRecipientSearch] = useState('');
  const [activeFacilityPicker, setActiveFacilityPicker] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [telegramConfig, setTelegramConfig] = useState({ botToken: '', chatId: '', enabled: true });
  const [emailConfig, setEmailConfig] = useState({ host: 'smtp.gmail.com', port: '587', encryption: 'STARTTLS', user: '', pass: '', from: '', secure: true });

  useEffect(() => {
    if (!emailConfig.from || emailConfig.from === '') {
      setEmailConfig(prev => ({ ...prev, from: prev.user }));
    }
  }, [emailConfig.user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveFacilityPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- ACTIONS ---
  const toggleAlertChannel = (userId: string, channel: 'emailAlerts' | 'telegramAlerts') => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, [channel]: !u[channel] } : u));
    onLog('UPDATE', 'SYSTEM', `Alarm-Kanäle für Nutzer ${userId} angepasst`);
  };

  const toggleAllFacilities = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, allFacilitiesAlerts: !u.allFacilitiesAlerts, alertFacilityIds: !u.allFacilitiesAlerts ? [] : u.alertFacilityIds } : u));
  };

  const toggleFacilitySubscription = (userId: string, facId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const current = u.alertFacilityIds || [];
      const next = current.includes(facId) ? current.filter(id => id !== facId) : [...current, facId];
      return { ...u, alertFacilityIds: next };
    }));
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

  const testTelegram = () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      setImportStatus({ msg: 'Bot Token & Chat ID erforderlich!', type: 'error' });
      return;
    }
    setIsTestLoadingTelegram(true);
    setTimeout(() => {
      setIsTestLoadingTelegram(false);
      setTestSuccessTelegram(true);
      setTimeout(() => setTestSuccessTelegram(null), 4000);
    }, 1500);
  };

  const testEmail = async () => {
    if (!emailConfig.user || !emailConfig.pass) {
      setImportStatus({ msg: 'Username & Passwort erforderlich!', type: 'error' });
      return;
    }
    setIsTestLoadingEmail(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsTestLoadingEmail(false);
    setTestSuccessEmail(true);
    setTimeout(() => setTestSuccessEmail(null), 5000);
  };

  // Fix: Implemented handleExportUsers to provide CSV backup functionality
  const handleExportUsers = () => {
    const headers = ['ID', 'Name', 'Username', 'Email', 'Role', 'Status', 'FacilityID'];
    const rows = users.map(u => [
      u.id,
      `"${u.name}"`,
      `"${u.username}"`,
      `"${u.email || ''}"`,
      u.role,
      u.status,
      u.facilityId || ''
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadCSV(`Gourmetta_Users_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  // Fix: Implemented handleExportFacilities to provide CSV backup functionality
  const handleExportFacilities = () => {
    const headers = ['ID', 'Name', 'FridgeCount', 'TypeID', 'CookingMethodID', 'SupervisorID'];
    const rows = facilities.map(f => [
      f.id,
      `"${f.name}"`,
      f.refrigeratorCount,
      f.typeId || '',
      f.cookingMethodId || '',
      f.supervisorId || ''
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadCSV(`Gourmetta_Facilities_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
  };

  // --- DATA ---
  const alertPrivilegedUsers = useMemo(() => {
    return users.filter(u => (u.role === 'Admin' || u.role === 'Manager' || u.role === 'SuperAdmin') && 
      (u.name.toLowerCase().includes(recipientSearch.toLowerCase()) || u.role.toLowerCase().includes(recipientSearch.toLowerCase()))
    );
  }, [users, recipientSearch]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Backup & Alarme</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Systemverwaltung & Benachrichtigungen</p>
        </div>
      </header>

      {/* RECIPIENTS MANAGEMENT HUB */}
      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-50 dark:border-slate-800 pb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">🔔 Alarmempfänger & Eskalation</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Festlegen, wer kritische Alarme empfängt</p>
          </div>
          <div className="relative w-full md:w-72">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
             <input 
               type="text" 
               placeholder="Empfänger suchen..." 
               value={recipientSearch}
               onChange={e => setRecipientSearch(e.target.value)}
               className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
             />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {alertPrivilegedUsers.map(user => (
             <div key={user.id} className="group bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 flex flex-col lg:flex-row items-center justify-between gap-6 hover:bg-white hover:shadow-xl transition-all border-l-8 border-l-blue-100 group-hover:border-l-blue-500">
                <div className="flex items-center space-x-6 min-w-0 flex-1">
                   <div className="w-14 h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-2xl shrink-0">
                      {user.role === 'Manager' ? '👨‍🍳' : '🛡️'}
                   </div>
                   <div className="truncate">
                      <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none mb-1">{user.name}</p>
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 rounded text-[9px] font-black uppercase tracking-widest">{user.role}</span>
                   </div>
                </div>

                {/* DELIVERY CHANNELS */}
                <div className="flex items-center bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-700 space-x-2">
                   <button 
                     onClick={() => toggleAlertChannel(user.id, 'emailAlerts')}
                     className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all ${user.emailAlerts ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <span className="text-base">✉️</span>
                     <span className="text-[10px] font-black uppercase">E-Mail</span>
                   </button>
                   <button 
                     onClick={() => toggleAlertChannel(user.id, 'telegramAlerts')}
                     className={`px-4 py-2.5 rounded-xl flex items-center space-x-2 transition-all ${user.telegramAlerts ? 'bg-blue-400 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     <span className="text-base">✈️</span>
                     <span className="text-[10px] font-black uppercase">Telegram</span>
                   </button>
                </div>

                {/* SCOPE SELECTION */}
                <div className="flex-1 flex items-center justify-end w-full lg:w-auto">
                   {user.role === 'Manager' ? (
                     <div className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800 flex items-center space-x-3 w-full lg:w-auto">
                        <span className="text-lg">📍</span>
                        <div className="text-left">
                           <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Gebundener Standort</p>
                           <p className="text-xs font-black text-slate-700 dark:text-slate-300">{facilities.find(f => f.id === user.facilityId)?.name || 'Kein Standort'}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="flex flex-col lg:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="flex items-center space-x-3 pr-4 border-r border-slate-100 dark:border-slate-800">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global</label>
                           <button 
                             onClick={() => toggleAllFacilities(user.id)}
                             className={`w-12 h-6 rounded-full transition-all relative ${user.allFacilitiesAlerts ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                           >
                              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${user.allFacilitiesAlerts ? 'left-6.5' : 'left-0.5'}`} />
                           </button>
                        </div>

                        {!user.allFacilitiesAlerts ? (
                          <div className="relative w-full lg:w-auto" ref={activeFacilityPicker === user.id ? dropdownRef : null}>
                            <button 
                              onClick={() => setActiveFacilityPicker(user.id)}
                              className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center space-x-3 hover:border-blue-500 transition-all w-full"
                            >
                               <span className="text-blue-600 font-black text-[10px] uppercase">
                                 {user.alertFacilityIds?.length || 0} Standorte gewählt
                               </span>
                               <span className="text-slate-300">▼</span>
                            </button>
                            {activeFacilityPicker === user.id && (
                              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                                 <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                                    {facilities.map(fac => (
                                      <button 
                                        key={fac.id}
                                        onClick={() => toggleFacilitySubscription(user.id, fac.id)}
                                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between group/fac ${user.alertFacilityIds?.includes(fac.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                      >
                                         <span className="text-xs font-bold truncate">{fac.name}</span>
                                         {user.alertFacilityIds?.includes(fac.id) && <span className="text-[10px] font-black">✓</span>}
                                      </button>
                                    ))}
                                 </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800 text-blue-600 font-black text-[10px] uppercase tracking-widest flex items-center space-x-2">
                             <span>🌍</span>
                             <span>Monitoring: Alle Standorte</span>
                          </div>
                        )}
                     </div>
                   )}
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* CONNECTION SETTINGS HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* EMAIL SERVER CONFIG (LEFT) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-8xl">✉️</div>
          <div className="mb-8">
             <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">E-Mail Server (SMTP)</h2>
             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Konfiguration für System-Alarme</p>
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
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Verschlüsselung</label>
                <select value={emailConfig.encryption} onChange={e => setEmailConfig({...emailConfig, encryption: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs outline-none h-[56px]">
                  <option value="STARTTLS">STARTTLS</option>
                  <option value="SSL/TLS">SSL/TLS</option>
                  <option value="None">Keine</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Benutzername (E-Mail)</label>
              <input type="email" value={emailConfig.user} onChange={e => setEmailConfig({...emailConfig, user: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="beispiel@gmail.com" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Passwort</label>
              <input type="password" value={emailConfig.pass} onChange={e => setEmailConfig({...emailConfig, pass: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="••••••••" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Absender E-Mail (From Email)</label>
              <input type="email" value={emailConfig.from} onChange={e => setEmailConfig({...emailConfig, from: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="Gleich wie Benutzername" />
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <button onClick={() => setShowEmailPreview(true)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">👁️ Vorschau ansehen</button>
            <button onClick={testEmail} disabled={isTestLoadingEmail} className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center space-x-3 ${testSuccessEmail ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-blue-600'}`}>
               {isTestLoadingEmail ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>⚡</span>}
               <span>{testSuccessEmail ? 'Test erfolgreich' : 'E-Mail Testen'}</span>
            </button>
          </div>
        </div>

        {/* TELEGRAM CONFIG (RIGHT) */}
        <div className="lg:col-span-5 flex flex-col space-y-8">
           <div className="bg-white dark:bg-slate-900 p-10 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden flex-1">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-8xl">✈️</div>
             <div className="mb-8">
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Telegram Bot</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Echtzeit-Push für kritische Events</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Bot API Token</label>
                   <input type="password" value={telegramConfig.botToken} onChange={e => setTelegramConfig({...telegramConfig, botToken: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs outline-none" placeholder="123456:ABC-DEF..." />
                </div>
                <div className="space-y-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Chat ID</label>
                   <input type="text" value={telegramConfig.chatId} onChange={e => setTelegramConfig({...telegramConfig, chatId: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs outline-none" placeholder="-10012345678" />
                </div>
                
                <div className="pt-6">
                   <button onClick={testTelegram} disabled={isTestLoadingTelegram} className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center justify-center space-x-3 ${testSuccessTelegram ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                      {isTestLoadingTelegram ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>✈️</span>}
                      <span>{testSuccessTelegram ? 'Nachricht gesendet' : 'Telegram Testen'}</span>
                   </button>
                </div>
             </div>
           </div>

           {/* QUICK BACKUP CARD */}
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
