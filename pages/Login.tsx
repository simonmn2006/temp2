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

    // Check for Secure Context (Required for Push API)
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (!isSecure) {
      showAlert(currentLanguage === 'de' 
        ? 'Sicherheitsfehler: Benachrichtigungen erfordern HTTPS oder Localhost. Chrome blockiert diesen Aufruf auf ungesicherten IP-Adressen.' 
        : 'Security Error: Notifications require HTTPS or Localhost. Chrome blocks this API on unsecure IP addresses.', 'error');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      
      if (permission === 'granted') {
        showAlert(currentLanguage === 'de' ? 'Benachrichtigungen aktiviert!' : 'Notifications enabled!', 'success');
      } else if (permission === 'denied') {
        showAlert(currentLanguage === 'de' 
          ? 'Blockiert. Bitte klicken Sie auf das Schloss-Symbol (oben links) und setzen Sie "Benachrichtigungen" auf "Zulassen".' 
          : 'Blocked. Please click the Lock icon (top left) and set "Notifications" to "Allow".', 'error');
      }
    } catch (err) {
      showAlert(currentLanguage === 'de' ? 'Anfrage fehlgeschlagen. Prüfen Sie die Browser-Berechtigungen.' : 'Request failed. Check browser permissions.', 'info');
    }
  };

  const showAlert = (text: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 7000); // Extended timeout for reading instructions
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
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 w-full max-w-md px-4">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : alertMsg.type === 'info' ? 'bg-blue-600' : 'bg-rose-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 border border-white/20`}>
             <div className="flex-shrink-0 text-xl">{alertMsg.type === 'success' ? '✅' : alertMsg.type === 'info' ? 'ℹ️' : '⚠️'}</div>
             <span className="font-black text-[11px] uppercase tracking-tight leading-snug">{alertMsg.text}</span>
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
              title={notificationStatus === 'denied' ? 'Benachrichtigungen blockiert' : 'Klicken für Push-Dienste'}
            >
              <img src={LOGO_URL} className={`w-full h-full object-contain ${notificationStatus === 'default' ? 'animate-pulse'