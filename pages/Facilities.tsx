
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, Facility, FacilityType, CookingMethod, User, AuditLog } from '../types';

interface FacilitiesPageProps {
  t: TranslationSet;
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  facilityTypes: FacilityType[];
  cookingMethods: CookingMethod[];
  users: User[];
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  onSync: (facility: Facility) => void;
}

export const FacilitiesPage: React.FC<FacilitiesPageProps> = ({ t, facilities, setFacilities, facilityTypes, cookingMethods, users, onLog, onSync }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    typeId: '',
    cookingMethodId: '',
    supervisorId: ''
  });

  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [isSupDropdownOpen, setIsSupDropdownOpen] = useState(false);
  const supDropdownRef = useRef<HTMLDivElement>(null);

  const supervisors = useMemo(() => users.filter(u => u.role === 'Admin' || u.role === 'Manager'), [users]);
  const filteredSupervisors = useMemo(() => supervisors.filter(s => s.name.toLowerCase().includes(supervisorSearch.toLowerCase())), [supervisors, supervisorSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supDropdownRef.current && !supDropdownRef.current.contains(event.target as Node)) {
        setIsSupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, facilities]);

  const showAlert = (text: string, type: 'error' | 'success' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const openModal = (facility?: Facility) => {
    setAlertMsg(null);
    setInvalidFields(new Set());
    if (facility) {
      setEditingFacility(facility);
      setFormData({
        name: facility.name,
        typeId: facility.typeId || '',
        cookingMethodId: facility.cookingMethodId || '',
        supervisorId: facility.supervisorId || ''
      });
      setSupervisorSearch(supervisors.find(s => s.id === facility.supervisorId)?.name || '');
    } else {
      setEditingFacility(null);
      setFormData({ name: '', typeId: '', cookingMethodId: '', supervisorId: '' });
      setSupervisorSearch('');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const errors = new Set<string>();
    if (!formData.name.trim()) errors.add('name');
    if (!formData.supervisorId) errors.add('supervisorId');

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", 'error');
      return;
    }

    const trimmedName = formData.name.trim();
    let finalFac: Facility;

    if (editingFacility) {
      finalFac = { ...editingFacility, ...formData, name: trimmedName };
      setFacilities(prev => prev.map(f => f.id === editingFacility.id ? finalFac : f));
      onLog('UPDATE', 'FACILITIES', `Standort '${trimmedName}' aktualisiert`);
      showAlert(`Standort "${trimmedName}" aktualisiert.`, 'success');
    } else {
      finalFac = {
        ...formData,
        id: `F-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        name: trimmedName,
        refrigeratorCount: 0
      };
      setFacilities(prev => [...prev, finalFac]);
      onLog('CREATE', 'FACILITIES', `Neuen Standort '${trimmedName}' erstellt`);
      showAlert(`Standort "${trimmedName}" erstellt.`, 'success');
    }

    // SYNC TO BACKEND
    onSync(finalFac);
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (facilityToDelete) {
      const name = facilityToDelete.name;
      setFacilities(prev => prev.filter(f => f.id !== facilityToDelete.id));
      onLog('DELETE', 'FACILITIES', `Standort '${name}' gelöscht`);
      showAlert(`Standort "${name}" gelöscht.`, 'success');
      setFacilityToDelete(null);
    }
  };

  const getFieldClass = (fieldName: string) => {
    const base = "w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none transition-all";
    if (invalidFields.has(fieldName)) {
        return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3 border border-white/20`}>
             <span className="text-xl">{alertMsg.type === 'success' ? '✅' : '⚠️'}</span>
             <span className="font-black text-xs uppercase tracking-tight">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.tabs.facilities}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Verwaltung der Gourmetta Standorte</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/20 hover:scale-[1.02] transition-all uppercase text-xs tracking-widest">+ Standort hinzufügen</button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
        <input type="text" placeholder="Nach Standortname oder ID suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold shadow-sm text-sm h-[52px]" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFacilities.map((f) => {
          const supervisor = supervisors.find(s => s.id === f.supervisorId);
          return (
            <div key={f.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all group text-left relative overflow-hidden">
              <div className="absolute top-6 right-6 flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(f)} className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:scale-110 transition-transform">✏️</button>
                <button onClick={() => setFacilityToDelete(f)} className="p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl hover:scale-110 transition-transform">🗑️</button>
              </div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5 inline-block">ID: {f.id}</span>
                  <h3 className="font-black text-slate-900 dark:text-slate-100 text-xl leading-tight">{f.name}</h3>
                </div>
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-2xl shadow-inner">🏢</div>
              </div>
              <div className="space-y-4 mb-8">
                 <div className="flex items-center space-x-3 text-slate-500">
                    <span className="text-xl">🛡️</span>
                    <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Supervisor</p>
                       <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{supervisor?.name || 'N/A'}</p>
                    </div>
                 </div>
              </div>
              <div className="pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>{f.refrigeratorCount} Kühlschränke</span>
                <span className="text-blue-600 font-black">Details ➞</span>
              </div>
            </div>
          );
        })}
      </div>

      {facilityToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🚨</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter uppercase">Löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold text-sm">Standort "{facilityToDelete.name}" wirklich entfernen?</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest">JA, LÖSCHEN</button>
              <button onClick={() => setFacilityToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-150 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] p-10 shadow-2xl border border-white/10 dark:border-slate-800 text-left relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingFacility ? 'Standort bearbeiten' : 'Neuer Standort'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:scale-110 transition-all font-bold">✕</button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Name der Einrichtung</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={getFieldClass('name')} />
              </div>

              <div className="relative" ref={supDropdownRef}>
                <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Supervisor</label>
                <div className="flex items-center px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-[56px]" onClick={() => setIsSupDropdownOpen(true)}>
                  <input type="text" value={supervisorSearch} onChange={e => {setSupervisorSearch(e.target.value); setIsSupDropdownOpen(true);}} placeholder="Supervisor suchen..." className="flex-1 bg-transparent font-bold text-sm outline-none" />
                  <span className="text-slate-400 text-xs ml-2">▼</span>
                </div>
                {isSupDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredSupervisors.map(s => (
                      <button key={s.id} onClick={() => { setFormData({...formData, supervisorId: s.id}); setSupervisorSearch(s.name); setIsSupDropdownOpen(false); }} className={`w-full text-left px-5 py-3 hover:bg-slate-50 font-bold text-sm border-b last:border-0 border-slate-50 ${formData.supervisorId === s.id ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}>{s.name}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Typ</label>
                  <select value={formData.typeId} onChange={e => setFormData({...formData, typeId: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm h-[56px]">
                    <option value="">Wählen...</option>
                    {facilityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Garmethode</label>
                  <select value={formData.cookingMethodId} onChange={e => setFormData({...formData, cookingMethodId: e.target.value})} className="w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm h-[56px]">
                    <option value="">Wählen...</option>
                    {cookingMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-10 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase tracking-widest text-[11px]">Abbrechen</button>
              <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white rounded-[1.25rem] font-black shadow-xl uppercase text-xs tracking-widest">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
