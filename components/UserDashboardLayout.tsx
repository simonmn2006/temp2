
import React, { useState, useEffect, useMemo } from 'react';
import { TranslationSet, Language, User, Assignment, FormResponse, Reading, Holiday, Facility, FacilityType } from '../types';

interface UserDashboardLayoutProps {
  t: TranslationSet;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  children: React.ReactNode;
  assignments: Assignment[];
  currentUser: User;
  formResponses: FormResponse[];
  readings: Reading[];
  holidays: Holiday[];
  isOnline?: boolean;
  isSyncing?: boolean;
  offlineQueueCount?: number;
  facilities: Facility[];
  facilityTypes: FacilityType[];
}

const LOGO_URL = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.256 1.181-3.103.493.969.819 2.087.819 3.103z'/%3E%3C/svg%3E";

export const UserDashboardLayout: React.FC<UserDashboardLayoutProps> = ({
  t, activeTab, onTabChange, onLogout, language, onLanguageChange, children, assignments, currentUser, formResponses, readings, holidays,
  isOnline = true, isSyncing = false, offlineQueueCount = 0, facilities, facilityTypes
}) => {
  const [now, setNow] = useState(new Date());
  const [isAcademyOpen, setIsAcademyOpen] = useState(false);
  const [academyTopic, setAcademyTopic] = useState<'welcome' | 'temps' | 'forms' | 'reports'>('welcome');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const formCount = useMemo(() => {
    const myFac = facilities.find(f => f.id === currentUser.facilityId);
    
    return assignments.filter(a => {
      const isTarget = (a.targetType === 'user' && a.targetId === currentUser.id) || 
                       (a.targetType === 'facility' && a.targetId === currentUser.facilityId) ||
                       (a.targetType === 'facilityType' && a.targetId === myFac?.typeId);
                       
      const isActive = todayStr >= a.startDate && todayStr <= a.endDate;
      const alreadyDone = (formResponses || []).some(fr => 
        fr.formId === a.resourceId && 
        fr.timestamp.startsWith(todayStr) && 
        (a.targetType === 'user' ? fr.userId === currentUser.id : fr.facilityId === currentUser.facilityId)
      );
      
      return a.resourceType === 'form' && isTarget && isActive && !alreadyDone;
    }).length;
  }, [assignments, currentUser, todayStr, formResponses, facilities]);

  const menuItems = [
    { id: 'user_workspace', icon: '🌡️', label: t.tabs.user_workspace },
    { id: 'user_forms', icon: '📝', label: t.tabs.user_forms, badge: formCount },
    { id: 'user_reports', icon: '📊', label: t.tabs.user_reports },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <style>{`
        @keyframes pulse-green {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes pulse-amber {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        .animate-blink-green {
          animation: pulse-green 2s infinite;
        }
        .animate-blink-amber {
          animation: pulse-amber 2s infinite;
        }
      `}</style>
      
      {isAcademyOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsAcademyOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 text-left">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center space-x-4">
                 <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">🎓</div>
                 <div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-1">Gourmetta Academy</h2>
                   <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Die Schritt-für-Schritt Anleitung für Nutzer</p>
                 </div>
              </div>
              <button onClick={() => setIsAcademyOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold hover:scale-110 transition-all">✕</button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-64 border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 p-6 space-y-2 hidden md:block">
                 {[
                   { id: 'welcome', label: 'Einführung', icon: '🏠' },
                   { id: 'temps', label: 'Temperaturen', icon: '🌡️' },
                   { id: 'forms', label: 'Checklisten', icon: '📝' },
                   { id: 'reports', label: 'Berichte', icon: '📊' },
                 ].map(nav => (
                   <button 
                     key={nav.id} 
                     onClick={() => setAcademyTopic(nav.id as any)}
                     className={`w-full text-left px-5 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center space-x-3 transition-all ${academyTopic === nav.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                   >
                     <span>{nav.icon}</span>
                     <span>{nav.label}</span>
                   </button>
                 ))}
              </div>

              <div className="flex-1 overflow-y-auto p-10 lg:p-14 custom-scrollbar bg-white dark:bg-slate-900">
                {academyTopic === 'welcome' && (
                  <div className="space-y-10 animate-in slide-in-from-bottom-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-10 rounded-[3rem] border border-blue-100 dark:border-blue-800 text-center">
                       <h3 className="text-3xl font-black text-blue-900 dark:text-blue-100 uppercase tracking-tighter mb-4">Willkommen bei Gourmetta Digital!</h3>
                       <p className="text-blue-700 dark:text-blue-400 font-bold text-lg leading-relaxed max-w-2xl mx-auto">
                         Ab heute werden alle HACCP-Dokumente digital erfasst. Kein Papierkram mehr, keine verlorenen Listen. Diese Anleitung zeigt Ihnen in 2 Minuten, wie es geht.
                       </p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                       <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] text-center space-y-4">
                          <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">📱</div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Ideal für mobile Geräte</h4>
                          <p className="text-xs text-slate-500 font-bold leading-relaxed">Perfekt für Tablets oder Smartphones in der Küche.</p>
                       </div>
                       <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] text-center space-y-4">
                          <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">🔒</div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Rechtlich abgesichert</h4>
                          <p className="text-xs text-slate-500 font-bold leading-relaxed">Digitale Signaturen ersetzen den Kugelschreiber.</p>
                       </div>
                       <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] text-center space-y-4">
                          <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">☁️</div>
                          <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest">Auch ohne Internet nutzbar</h4>
                          <p className="text-xs text-slate-500 font-bold leading-relaxed">An allen Orten nutzbar auch ohne Internet.</p>
                       </div>
                    </div>
                    <button onClick={() => setAcademyTopic('temps')} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-sm tracking-widest hover:bg-blue-600 transition-all shadow-xl">Weiter zu Temperaturen &rarr;</button>
                  </div>
                )}

                {academyTopic === 'temps' && (
                  <div className="space-y-12 animate-in slide-in-from-bottom-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">1. Temperaturen erfassen</h3>
                      <div className="space-y-8">
                        <div className="flex items-start space-x-6">
                           <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shrink-0">1</div>
                           <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Gerät oder Menü wählen</p>
                              <p className="text-sm text-slate-500 font-medium">In der "Temperaturerfassung" finden Sie blaue Karten für Menüs und graue für Kühlgeräte. Alle Aufgaben für heute stehen dort bereit.</p>
                           </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-700 space-y-6">
                           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Ansicht im Portal:</p>
                           <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 shadow-sm max-w-md mx-auto">
                              <div className="flex items-center space-x-3">
                                 <button className="w-12 h-12 bg-slate-100 rounded-xl font-black text-blue-600 text-2xl shadow-sm border border-slate-200">−</button>
                                 <span className="text-4xl font-black font-mono">4.0°</span>
                                 <button className="w-12 h-12 bg-slate-100 rounded-xl font-black text-blue-600 text-2xl shadow-sm border border-slate-200">+</button>
                              </div>
                              <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow-lg">🔒</div>
                           </div>
                           <p className="text-xs text-slate-400 font-medium text-center">Drücken Sie <b>+</b> oder <b>−</b> um den Wert einzustellen.</p>
                        </div>
                        <div className="flex items-start space-x-6">
                           <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shrink-0">2</div>
                           <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Abweichungen begründen (Rot-Phase)</p>
                              <p className="text-sm text-slate-500 font-medium">Wenn der Wert rot leuchtet, ist er außerhalb des Limits. In diesem Fall erscheint automatisch ein Textfeld. Geben Sie kurz an, warum (z.B. "Tür stand offen").</p>
                           </div>
                        </div>
                        <div className="flex items-start space-x-6">
                           <div className="w-10 h-10 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black shrink-0">3</div>
                           <div>
                              <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Eintrag Sperren 🔒</p>
                              <p className="text-sm text-slate-500 font-medium">Klicken Sie auf das <b>Schloss-Symbol</b>. Der Eintrag wird nun dauerhaft gespeichert und kann nicht mehr geändert werden.</p>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                       <button onClick={() => setAcademyTopic('welcome')} className="flex-1 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-slate-500 font-black uppercase text-xs tracking-widest transition-all">Zurück</button>
                       <button onClick={() => setAcademyTopic('forms')} className="flex-[2] py-5 rounded-[2rem] bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl">Weiter zu Checklisten &rarr;</button>
                    </div>
                  </div>
                )}

                {academyTopic === 'forms' && (
                   <div className="space-y-12 animate-in slide-in-from-bottom-4">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">2. Checklisten & Signatur</h3>
                        <div className="space-y-10">
                           <div className="flex items-start space-x-6">
                              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shrink-0">1</div>
                              <div>
                                 <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Offene Listen wählen</p>
                                 <p className="text-sm text-slate-500 font-medium">Unter "Checklisten" sehen Sie Karten mit Aufgaben wie "Hygiene-Rundgang". Die Zahl im grünen Kreis am Menü zeigt an, wie viele Listen heute noch offen sind.</p>
                              </div>
                           </div>
                           <div className="flex items-start space-x-6">
                              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shrink-0">2</div>
                              <div>
                                 <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Fragen beantworten</p>
                                 <p className="text-sm text-slate-500 font-medium">Tippen Sie auf <b>JA/NEIN</b> oder wählen Sie eine Option aus der Liste aus. Sie müssen jede Frage beantworten, bevor Sie speichern können.</p>
                              </div>
                           </div>
                           <div className="bg-slate-50 dark:bg-slate-800/50 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 space-y-6">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4">Das Signaturfeld:</p>
                              <div className="h-40 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 rounded-2xl relative overflow-hidden flex items-center justify-center">
                                 <div className="text-slate-200 font-black text-4xl transform -rotate-12 select-none opacity-20">SIGNATUR HIER</div>
                                 <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-48 h-0.5 bg-slate-100" />
                              </div>
                              <p className="text-xs text-slate-500 font-bold leading-relaxed">Nutzen Sie Ihren <b>Finger</b>, um direkt auf dem Display zu unterschreiben. Das ersetzt Ihre händische Unterschrift auf Papier.</p>
                           </div>
                        </div>
                      </div>
                      <div className="flex gap-4">
                         <button onClick={() => setAcademyTopic('temps')} className="flex-1 py-5 rounded-[2rem] bg-slate-100 dark:bg-slate-800 text-slate-500 font-black uppercase text-xs tracking-widest transition-all">Zurück</button>
                         <button onClick={() => setAcademyTopic('reports')} className="flex-[2] py-5 rounded-[2rem] bg-slate-900 text-white font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-xl">Weiter zu Berichten &rarr;</button>
                      </div>
                   </div>
                )}

                {academyTopic === 'reports' && (
                   <div className="space-y-12 animate-in slide-in-from-bottom-4">
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">3. Berichte & Kontrolle</h3>
                        <div className="space-y-10">
                           <div className="flex items-start space-x-6">
                              <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black shrink-0">1</div>
                              <div>
                                 <p className="font-black text-slate-800 dark:text-slate-100 text-lg">Eigene Daten einsehen</p>
                                 <p className="text-sm text-slate-500 font-medium">Unter "Meine Berichte" können Sie rückwirkend sehen, welche Werte Sie eingetragen haben. Wählen Sie dazu einfach das gewünschte Datum aus.</p>
                              </div>
                           </div>
                           <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-[2.5rem] flex items-center space-x-6">
                              <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-3xl shadow-sm">🏆</div>
                              <div>
                                 <p className="font-black text-emerald-900 dark:text-emerald-100 text-lg uppercase tracking-tight">Gourmetta Go Green</p>
                                 <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">Ganz oben rechts sehen Sie Ihren persönlichen "Go Green" Impact. Das System rechnet aus, wie viele Seiten Papier und wie viel Tinte Sie durch die digitale Nutzung bereits gespart haben.</p>
                              </div>
                           </div>
                           <div className="p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl">
                              <div className="flex items-center space-x-4 mb-4">
                                 <span className="text-2xl">✅</span>
                                 <h4 className="font-black text-lg uppercase tracking-widest">Alles verstanden?</h4>
                              </div>
                              <p className="text-slate-400 text-xs font-bold leading-relaxed mb-6">Sie können diese Akademie jederzeit über das Hut-Symbol wieder aufrufen, falls Sie etwas vergessen haben.</p>
                              <button onClick={() => setIsAcademyOpen(false)} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-500 active:scale-95 transition-all shadow-xl shadow-blue-500/20">Akademie Schließen & Starten</button>
                           </div>
                        </div>
                      </div>
                      <button onClick={() => setAcademyTopic('forms')} className="w-full py-4 text-slate-500 font-black uppercase text-xs tracking-widest">Zurück</button>
                   </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status Toast */}
      {isSyncing && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1100] animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-4 border border-white/10">
             <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
             <span className="text-[10px] font-black uppercase tracking-widest">Daten werden synchronisiert...</span>
          </div>
        </div>
      )}

      <header className="h-24 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-50 no-print shadow-md">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <img src={LOGO_URL} className="w-11 h-11 object-contain" alt="Logo" />
            <div className="hidden sm:flex flex-col pb-1.5 min-w-0">
               <span className="font-black text-slate-900 dark:text-slate-100 text-xl leading-snug block italic">gourmetta</span>
               <div className="flex items-center space-x-2">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">Safe-Sync User</span>
                 {isOnline ? (
                   <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest border border-emerald-100">
                     <span className="w-1 h-1 rounded-full bg-emerald-500 animate-blink-green" />
                     <span>Online</span>
                   </span>
                 ) : (
                   <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-600 rounded text-[8px] font-black uppercase tracking-widest border border-amber-100">
                     <span className="w-1 h-1 rounded-full bg-amber-500 animate-blink-amber" />
                     <span>Offline Vault {offlineQueueCount > 0 ? `(${offlineQueueCount})` : ''}</span>
                   </span>
                 )}
               </div>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-100 dark:bg-slate-800 hidden lg:block" />
          <div className="hidden lg:flex flex-col text-left">
             <div className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter leading-none">
                {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
             </div>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
             </div>
          </div>
        </div>
        
        <nav className="flex space-x-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center space-x-3 px-5 py-3 rounded-xl transition-all relative ${
                activeTab === item.id 
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-lg font-black' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[11px] font-black uppercase tracking-widest hidden md:block">{item.label}</span>
              {item.badge && item.badge > 0 && item.id === 'user_forms' && (
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow-lg border-2 border-white dark:border-slate-800 animate-blink-green">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center space-x-6">
          <button 
             onClick={() => { setIsAcademyOpen(true); setAcademyTopic('welcome'); }}
             className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl hover:scale-110 transition-all shadow-sm group"
             title="Gourmetta Academy - Hilfe"
          >
             <span className="group-hover:animate-bounce">🎓</span>
          </button>
          <div className="hidden lg:block text-right">
             <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-0.5">{currentUser.name}</p>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {currentUser.id}</p>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center space-x-2.5 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all font-black text-[11px] uppercase tracking-widest shadow-sm"
          >
            <span className="text-lg">🚪</span>
            <span className="hidden sm:inline">{t.logout}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar">
        <div className="max-w-5xl mx-auto pb-24">
          {children}
        </div>
      </main>
    </div>
  );
};
