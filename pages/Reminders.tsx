
import React, { useState } from 'react';
import { TranslationSet, ReminderConfig, AuditLog } from '../types';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mo' }, { id: 2, label: 'Di' }, { id: 3, label: 'Mi' },
  { id: 4, label: 'Do' }, { id: 5, label: 'Fr' }, { id: 6, label: 'Sa' }, { id: 7, label: 'So' }
];

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

interface RemindersPageProps {
  t: TranslationSet;
  reminders: ReminderConfig[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderConfig[]>>;
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  onSync: (reminder: ReminderConfig, del?: boolean) => void;
}

export const RemindersPage: React.FC<RemindersPageProps> = ({ t, reminders, setReminders, onLog, onSync }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderConfig | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<ReminderConfig | null>(null);
  const [formData, setFormData] = useState<Partial<ReminderConfig>>({
    label: '',
    time: '08:00',
    active: true,
    days: [1, 2, 3, 4, 5],
    targetRoles: ['User']
  });

  const openModal = (reminder?: ReminderConfig) => {
    if (reminder) {
      setEditingReminder(reminder);
      setFormData({ ...reminder });
    } else {
      setEditingReminder(null);
      setFormData({
        label: '',
        time: '08:00',
        active: true,
        days: [1, 2, 3, 4, 5],
        targetRoles: ['User']
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.label?.trim() || !formData.time) return;

    let finalRem: ReminderConfig;
    if (editingReminder) {
      finalRem = { ...editingReminder, ...formData } as ReminderConfig;
      setReminders((prev) => prev.map(r => r.id === editingReminder.id ? finalRem : r));
      onLog('UPDATE', 'REMINDERS', `Erinnerung "${formData.label}" aktualisiert`);
    } else {
      finalRem = {
        id: `rem-${Date.now()}`,
        label: formData.label,
        time: formData.time,
        active: formData.active ?? true,
        days: formData.days ?? [],
        targetRoles: formData.targetRoles ?? ['User']
      };
      setReminders((prev) => [...prev, finalRem]);
      onLog('CREATE', 'REMINDERS', `Neue Erinnerung "${formData.label}" erstellt`);
    }
    onSync(finalRem);
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (reminderToDelete) {
      setReminders((prev) => prev.filter(r => r.id !== reminderToDelete.id));
      onSync(reminderToDelete, true);
      onLog('DELETE', 'REMINDERS', `Erinnerung "${reminderToDelete.label}" gelöscht`);
      setReminderToDelete(null);
    }
  };

  const toggleDay = (day: number) => {
    const current = formData.days || [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setFormData({ ...formData, days: next });
  };

  const toggleRole = (role: 'User' | 'Manager' | 'Admin') => {
    const current = formData.targetRoles || [];
    const next = current.includes(role) ? current.filter(r => r !== role) : [...current, role];
    setFormData({ ...formData, targetRoles: next });
  };

  const [h, m] = (formData.time || '08:00').split(':');

  const updateHour = (val: string) => {
    setFormData({ ...formData, time: `${val}:${m}` });
  };

  const updateMinute = (val: string) => {
    setFormData({ ...formData, time: `${h}:${val}` });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-2">Push-Erinnerungen</h1>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl uppercase text-xs tracking-widest hover:bg-blue-700 transition-colors"
        >
          + Neuer Zeitplan
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reminders.map(rem => (
          <div key={rem.id} className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all relative group overflow-hidden">
             <div className={`absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-8xl`}>⏰</div>
             <div className="flex justify-between items-start mb-6">
                <div className="pr-4">
                   <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-tight mb-2 pr-6">{rem.label}</h3>
                   <div className="flex items-center space-x-2">
                      <span className="text-4xl font-black text-blue-600 font-mono italic tracking-tighter">{rem.time}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">24h</span>
                   </div>
                </div>
                <div className="flex flex-col space-y-2 relative z-10">
                   <button 
                    onClick={() => openModal(rem)} 
                    className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl hover:scale-110 transition-transform shadow-sm"
                    title="Bearbeiten"
                   >
                    ✏️
                   </button>
                   <button 
                    onClick={() => setReminderToDelete(rem)} 
                    className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl hover:scale-110 transition-transform shadow-sm"
                    title="Löschen"
                   >
                    🗑️
                   </button>
                </div>
             </div>
             
             <div className="flex flex-wrap gap-1 mb-8">
                {DAYS_OF_WEEK.map(d => (
                   <span key={d.id} className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${rem.days.includes(d.id) ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600'}`}>
                      {d.label}
                   </span>
                ))}
             </div>

             <div className="pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                <div className="flex -space-x-2">
                   {rem.targetRoles.map(role => (
                      <div key={role} className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-700 flex items-center justify-center text-xs shadow-sm" title={role}>
                         {role === 'User' ? '👤' : role === 'Manager' ? '👨‍🍳' : '🛡️'}
                      </div>
                   ))}
                </div>
                <div className="flex items-center space-x-2">
                   <div className={`w-2 h-2 rounded-full ${rem.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                   <span className="text-[9px] font-black uppercase text-slate-400">{rem.active ? 'Aktiv' : 'Inaktiv'}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/10 text-left flex flex-col relative">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                 <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{editingReminder ? 'Erinnerung bearbeiten' : 'Neue Erinnerung'}</h3>
                 <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500">✕</button>
              </div>
              
              <div className="p-10 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                 <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Beschreibung / Name</label>
                    <input 
                       type="text" 
                       value={formData.label} 
                       onChange={e => setFormData({...formData, label: e.target.value})}
                       className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none text-base" 
                       placeholder="z.B. Mittagsschicht HACCP"
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Zeitpunkt (24h)</label>
                       <div className="flex items-center space-x-2">
                          <select 
                            value={h}
                            onChange={(e) => updateHour(e.target.value)}
                            className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black font-mono text-xl outline-none"
                          >
                            {HOURS.map(val => <option key={val} value={val}>{val}</option>)}
                          </select>
                          <span className="font-black text-slate-400">:</span>
                          <select 
                            value={m}
                            onChange={(e) => updateMinute(e.target.value)}
                            className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black font-mono text-xl outline-none"
                          >
                            {MINUTES.map(val => <option key={val} value={val}>{val}</option>)}
                          </select>
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status</label>
                       <button 
                         onClick={() => setFormData({...formData, active: !formData.active})}
                         className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${formData.active ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                       >
                          {formData.active ? 'Aktiv' : 'Pausiert'}
                       </button>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Wochentage</label>
                    <div className="flex justify-between">
                       {DAYS_OF_WEEK.map(d => (
                          <button 
                             key={d.id} 
                             onClick={() => toggleDay(d.id)}
                             className={`w-11 h-11 rounded-xl text-xs font-black transition-all border-2 ${formData.days?.includes(d.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                          >
                             {d.label}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Empfänger-Rollen</label>
                    <div className="grid grid-cols-3 gap-3">
                       {(['User', 'Manager', 'Admin'] as const).map(role => (
                          <button 
                             key={role} 
                             onClick={() => toggleRole(role)}
                             className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${formData.targetRoles?.includes(role) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'}`}
                          >
                             {role}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 bg-slate-50/50 dark:bg-slate-800/50">
                 <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
                 <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-transform uppercase tracking-widest text-xs">Speichern</button>
              </div>
           </div>
        </div>
      )}

      {reminderToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🚨</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter uppercase">Erinnerung löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold text-sm">Möchten Sie den Zeitplan "{reminderToDelete.label}" wirklich dauerhaft entfernen?</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest">JA, LÖSCHEN</button>
              <button onClick={() => setReminderToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
