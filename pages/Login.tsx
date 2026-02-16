
import React, { useState, useEffect } from 'react';
import { Language, TranslationSet, User } from '../types';

interface LoginProps {
  t: TranslationSet;
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  onLogin: (username: string, password?: string) => void;
  users: User[];
  legalTexts: { imprint: string; privacy: string };
  backendOffline?: boolean;
}

const LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

export const Login: React.FC<LoginProps> = ({ t, currentLanguage, onLanguageChange, onLogin, users, legalTexts, backendOffline }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' | 'info' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'default' | 'unsupported'>('default');
  
  const [showImprint, setShowImprint] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
    } else {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showAlert(currentLanguage === 'de' ? 'Browser unterstützt keine Benachrichtigungen.' : 'Browser does not support notifications.', 'error');
      return;
    }

    if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      showAlert(currentLanguage === 'de' 
        ? 'Hinweis: Android & Windows benötigen HTTPS für Benachrichtigungen.' 
        : 'Note: Android & Windows require HTTPS for notifications.', 'info');
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === 'granted') {
        showAlert(currentLanguage === 'de' ? 'Benachrichtigungen aktiviert!' : 'Notifications enabled!', 'success');
      } else if (permission === 'denied') {
        showAlert(currentLanguage === 'de' 
          ? 'Blockiert. Bitte prüfen Sie die Browser-Einstellungen (Schloss-Symbol).' 
          : 'Blocked. Please check browser settings (Lock icon).', 'error');
      }
    } catch (err) {
      showAlert(currentLanguage === 'de' ? 'HTTPS erforderlich für Push-Dienste.' : 'HTTPS required for push services.', 'info');
    }
  };

  const showAlert = (text: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertMsg(null);
    const errors = new Set<string>();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername) errors.add('username');
    if (!cleanPassword) errors.add('password');

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert(currentLanguage === 'de' ? 'Bitte füllen Sie alle Felder aus.' : 'Please fill in all fields.', 'error');
      return;
    }

    const pool = users.some(u => u.username === 'super') ? users : [{id: 'U-SUPER', username: 'super', password: 'super', name: 'SuperAdmin', role: 'SuperAdmin', status: 'Active'} as User, ...users];

    const userMatch = pool.find(u => 
      u.username.toLowerCase() === cleanUsername.toLowerCase() && 
      u.password === cleanPassword
    );

    if (!userMatch) {
      errors.add('username');
      errors.add('password');
      setInvalidFields(errors);
      showAlert(currentLanguage === 'de' ? 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Daten.' : 'Login failed. Please check your credentials.', 'error');
      return;
    }

    onLogin(cleanUsername, cleanPassword);
  };

  const getFieldClass = (fieldName: string) => {
    const base = "w-full px-6 py-4 rounded-2xl bg-slate-50 border font-bold outline-none transition-all duration-200";
    if (invalidFields.has(fieldName)) return base + " border-rose-500 ring-4 ring-rose-500/10 animate-shake";
    return base + " border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 relative overflow-hidden text-left">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />

      {alertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 w-full max-w-sm px-4">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : alertMsg.type === 'info' ? 'bg-blue-600' : 'bg-rose-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 border border-white/20`}>
             <div className="flex-shrink-0 text-xl">{alertMsg.type === 'success' ? '✅' : alertMsg.type === 'info' ? 'ℹ️' : '⚠️'}</div>
             <span className="font-black text-xs uppercase tracking-tight leading-snug">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="w-full max-w-[460px] bg-white rounded-[3.5rem] shadow-2xl p-10 lg:p-14 border border-slate-100 relative z-10 flex flex-col">
        <div className="flex flex-col items-center mb-10">
          <div className="relative">
            <button 
              type="button"
              onClick={requestNotificationPermission}
              className={`relative w-20 h-20 mb-6 transition-all duration-500 hover:scale-110 active:scale-95 group flex items-center justify-center ${notificationStatus === 'granted' ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <img src={LOGO_URL} className={`w-full h-full object-contain ${notificationStatus === 'default' ? 'animate-pulse' : ''}`} alt="Gourmetta Logo" />
              {notificationStatus === 'granted' && (
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-[10px] text-white shadow-lg">✓</div>
              )}
            </button>
          </div>
          <h1 className="text-3xl font-black text-slate-900 italic tracking-tighter uppercase">gourmetta</h1>
          <div className="mt-4 flex items-center space-x-2">
             <div className={`w-2 h-2 rounded-full ${backendOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
               {backendOffline ? 'Lokaler Vault Modus' : 'Cloud Sync Aktiv'}
             </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1">
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.username}</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={getFieldClass('username')} placeholder="Nutzername..." />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t.password}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={getFieldClass('password')} placeholder="••••••••" />
            </div>
          </div>

          <div className="pt-4">
            <button type="submit" className="w-full text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-xs bg-blue-600 shadow-blue-500/20">
              {t.loginButton} &rarr;
            </button>
          </div>
          
          <div className="pt-8 mt-4 border-t border-slate-50 flex flex-col items-center space-y-6">
            <div className="flex items-center space-x-6">
              <button type="button" onClick={() => setShowImprint(true)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Impressum</button>
              <span className="w-1.5 h-1.5 bg-slate-100 rounded-full" />
              <button type="button" onClick={() => setShowPrivacy(true)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">Datenschutz</button>
            </div>
          </div>
        </form>
      </div>

      <p className="mt-8 text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60">
        &copy; {new Date().getFullYear()} Gourmetta Gastronomie GmbH
      </p>

      {(showImprint || showPrivacy) && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={() => { setShowImprint(false); setShowPrivacy(false); }} />
           <div className="relative bg-white w-full max-w-2xl rounded-[3.5rem] shadow-2xl p-10 lg:p-14 overflow-hidden border border-white/10 flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{showImprint ? 'Impressum' : 'Datenschutz'}</h2>
                <button onClick={() => { setShowImprint(false); setShowPrivacy(false); }} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold hover:scale-110 transition-transform">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 whitespace-pre-wrap font-medium text-slate-600 text-sm leading-relaxed pb-6">
                 {showImprint ? legalTexts.imprint : legalTexts.privacy}
              </div>
              <div className="mt-4 pt-8 border-t border-slate-50 shrink-0">
                 <button onClick={() => { setShowImprint(false); setShowPrivacy(false); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Verstanden</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
