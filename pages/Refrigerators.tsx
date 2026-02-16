
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, Refrigerator, Facility, RefrigeratorType, User, Assignment, AuditLog, Alert } from '../types';

interface RefrigeratorsPageProps {
  t: TranslationSet;
  facilities: Facility[];
  setFacilities: React.Dispatch<React.SetStateAction<Facility[]>>;
  fridges: Refrigerator[];
  setFridges: React.Dispatch<React.SetStateAction<Refrigerator[]>>;
  fridgeTypes: RefrigeratorType[];
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
}

export const RefrigeratorsPage: React.FC<RefrigeratorsPageProps> = ({ 
  t, facilities, setFacilities, fridges, setFridges, fridgeTypes, users, setUsers, setAssignments, onLog, setAlerts
}) => {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' | 'warning' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFridge, setEditingFridge] = useState<Refrigerator | null>(null);
  const [fridgeToDelete, setFridgeToDelete] = useState<Refrigerator | null>(null);
  
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [modalFacilityId, setModalFacilityId] = useState<string>('');
  const [modalFacilitySearch, setModalFacilitySearch] = useState('');
  const [isModalDropdownOpen, setIsModalDropdownOpen] = useState(false);
  const modalDropdownRef = useRef<HTMLDivElement>(null);

  const [newFridgesForm, setNewFridgesForm] = useState<{ id: string; name: string; typeId: string }[]>([
    { id: Math.random().toString(), name: '', typeId: '' }
  ]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [facilities, searchTerm]);

  const modalFilteredFacilities = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(modalFacilitySearch.toLowerCase()));
  }, [facilities, modalFacilitySearch]);

  const currentFridges = useMemo(() => {
    return fridges.filter(r => r.facilityId === selectedFacilityId);
  }, [fridges, selectedFacilityId]);

  const selectedFacility = useMemo(() => {
    return facilities.find(f => f.id === selectedFacilityId);
  }, [facilities, selectedFacilityId]);

  const associatedUsers = useMemo(() => {
    if (!selectedFacilityId) return [];
    return users.filter(u => u.facilityId === selectedFacilityId);
  }, [users, selectedFacilityId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalDropdownRef.current && !modalDropdownRef.current.contains(event.target as Node)) {
        setIsModalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAlert = (text: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const handleOpenCreate = () => {
    setEditingFridge(null);
    setInvalidFields(new Set());
    setModalFacilityId(selectedFacilityId);
    setModalFacilitySearch(selectedFacilityId ? facilities.find(f => f.id === selectedFacilityId)?.name || '' : '');
    setNewFridgesForm([{ id: Math.random().toString(), name: '', typeId: '' }]);
    setIsModalOpen(true);
  };

  const handleAddRow = () => {
    setNewFridgesForm(prev => [...prev, { id: Math.random().toString(), name: '', typeId: '' }]);
  };

  const handleRemoveRow = (idx: number) => {
    if (newFridgesForm.length === 1) return;
    setNewFridgesForm(prev => prev.filter((_, i) => i !== idx));
  };

  const handleOpenEdit = (fridge: Refrigerator) => {
    setEditingFridge(fridge);
    setInvalidFields(new Set());
    setModalFacilityId(fridge.facilityId);
    setModalFacilitySearch(facilities.find(f => f.id === fridge.facilityId)?.name || '');
    const type = fridgeTypes.find(t => t.name === (fridge as any).typeName);
    setNewFridgesForm([{ id: fridge.id, name: fridge.name, typeId: type?.id || '' }]);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const errors = new Set<string>();
    if (!modalFacilityId) errors.add('facilityId');
    
    newFridgesForm.forEach((row, idx) => {
      if (!row.name.trim()) errors.add(`row-${idx}-name`);
      if (!row.typeId) errors.add(`row-${idx}-typeId`);
    });

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Pflichtfelder fehlen.", 'error');
      return;
    }

    if (editingFridge) {
      const row = newFridgesForm[0];
      const typeName = fridgeTypes.find(t => t.id === row.typeId)?.name || 'Standard';
      setFridges(prev => prev.map(f => f.id === editingFridge.id ? { 
        ...f, 
        name: row.name,
        facilityId: modalFacilityId,
        typeName: typeName
      } as any : f));
      onLog('UPDATE', 'REFRIGERATORS', `Gerät "${row.name}" in Standort ${modalFacilitySearch} aktualisiert`);
      showAlert(`Gerät "${row.name}" wurde aktualisiert.`, 'success');
    } else {
      const additions = newFridgesForm.map(f => ({
        id: `R-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        name: f.name.trim(),
        facilityId: modalFacilityId,
        currentTemp: 4.0,
        status: 'Optimal' as const,
        typeName: fridgeTypes.find(t => t.id === f.typeId)?.name || 'Standard'
      }));
      setFridges(prev => [...prev, ...additions]);
      onLog('CREATE', 'REFRIGERATORS', `${additions.length} neue Geräte zu Standort ${modalFacilitySearch} hinzugefügt`);
      showAlert(`${additions.length} Gerät(e) wurden angelegt.`, 'success');
    }
    
    setSelectedFacilityId(modalFacilityId);
    setIsModalOpen(false);
  };

  const confirmDeleteFridge = () => {
    if (fridgeToDelete) {
       setFridges(prev => prev.filter(f => f.id !== fridgeToDelete.id));
       setAlerts(prev => prev.filter(a => a.targetName !== fridgeToDelete.name || a.facilityId !== fridgeToDelete.facilityId));
       onLog('DELETE', 'REFRIGERATORS', `Gerät "${fridgeToDelete.name}" gelöscht`);
       showAlert(`Gerät "${fridgeToDelete.name}" gelöscht.`, 'success');
       setFridgeToDelete(null);
    }
  };

  const confirmDeleteFacility = () => {
    if (facilityToDelete) {
       const facName = facilityToDelete.name;
       const facId = facilityToDelete.id;
       setFridges(prev => prev.filter(f => f.facilityId !== facId));
       setFacilities(prev => prev.filter(f => f.id !== facId));
       setAssignments(prev => prev.filter(a => a.targetType === 'facility' && a.targetId === facId));
       setUsers(prev => prev.map(u => u.facilityId === facId ? { ...u, facilityId: undefined } : u));
       setAlerts(prev => prev.filter(a => a.facilityId !== facId));
       onLog('DELETE', 'FACILITIES', `Standort "${facName}" und alle zugehörigen Geräte vollständig gelöscht`);
       showAlert(`Standort "${facName}" und alle Geräte gelöscht.`, 'success');
       setFacilityToDelete(null);
       if (selectedFacilityId === facId) setSelectedFacilityId('');
    }
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      const userName = userToDelete.name;
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      onLog('DELETE', 'USERS', `Benutzer "${userName}" via Standort-Bereinigung gelöscht`);
      showAlert(`Nutzer "${userName}" wurde gelöscht.`, 'success');
      setUserToDelete(null);
    }
  };

  const getFieldClass = (key: string, base: string = "w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border font-bold text-sm outline-none transition-all") => {
    if (invalidFields.has(key)) {
      return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-100 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && !isModalOpen && !fridgeToDelete && !facilityToDelete && !userToDelete && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 border border-white/20`}>
             <span className="text-xl">{alertMsg.type === 'success' ? '✅' : '⚠️'}</span>
             <span className="font-black text-sm uppercase tracking-tight">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Kühlsysteme & Standorte</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Permanente Geräteverknüpfung und Verwaltung</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] uppercase text-xs tracking-widest"
        >
          + Geräte anlegen
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4 text-left">
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Standort-Suche</label>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Standort suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm transition-all shadow-sm"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          </div>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 pb-10">
            {filteredFacilities.map(f => (
              <div key={f.id} className="relative group">
                <button
                  onClick={() => setSelectedFacilityId(f.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedFacilityId === f.id 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]' 
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <p className="font-black text-sm uppercase tracking-tighter leading-none mb-1 pr-6">{f.name}</p>
                  <p className={`text-[10px] font-bold ${selectedFacilityId === f.id ? 'text-blue-100' : 'text-slate-400'}`}>UID: {f.id}</p>
                </button>
                <button 
                   onClick={(e) => { e.stopPropagation(); setFacilityToDelete(f); }}
                   className={`absolute top-4 right-4 p-1.5 rounded-lg text-rose-500 hover:bg-rose-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 ${selectedFacilityId === f.id ? 'text-white/50 hover:text-white hover:bg-white/20' : ''}`}
                >
                   <span className="text-xs">🗑️</span>
                </button>
              </div>
            ))}
            {filteredFacilities.length === 0 && (
               <p className="text-center py-10 text-slate-400 font-black text-[10px] uppercase tracking-widest italic">Kein Standort gefunden</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-8 text-left">
          {selectedFacility ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                   <span className="text-8xl">❄️</span>
                </div>
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-2 block">Verknüpfte Geräte für:</span>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">{selectedFacility.name}</h2>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">{currentFridges.length} Kühlgeräte aktiv</p>
                  </div>
                </div>

                {currentFridges.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentFridges.map(fridge => (
                      <div key={fridge.id} className="p-8 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] hover:shadow-xl transition-all group relative">
                        <div className="absolute top-8 right-8 flex space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEdit(fridge)} className="p-2.5 bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-xl shadow-md hover:scale-110 transition-transform">✏️</button>
                          <button onClick={() => setFridgeToDelete(fridge)} className="p-2.5 bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 rounded-xl shadow-md hover:scale-110 transition-transform">🗑️</button>
                        </div>
                        <div className="flex items-center space-x-5 mb-6">
                           <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-2xl shadow-inner flex items-center justify-center text-3xl">❄️</div>
                           <div>
                             <h4 className="text-lg font-black text-slate-900 dark:text-white leading-none mb-1">{fridge.name}</h4>
                             <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{(fridge as any).typeName || 'Standard'}</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {fridge.id}</span>
                          <div className="flex items-center space-x-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                             <span className="text-[10px] font-black uppercase text-slate-500">Aktiv</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center opacity-40">
                     <span className="text-5xl">❄️</span>
                     <p className="text-sm font-black uppercase tracking-widest text-slate-400 mt-4">Keine Geräte in diesem Standort</p>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-10 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <div>
                       <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">👤 Zuständiges Personal</h3>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Mitarbeiter mit Log-Berechtigung</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {associatedUsers.length > 0 ? associatedUsers.map(user => (
                       <div key={user.id} className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
                          <div className="flex items-center space-x-4">
                             <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-sm text-lg">👤</div>
                             <div>
                                <p className="font-black text-slate-800 dark:text-slate-100 leading-tight">{user.name}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">@{user.username} • {user.role}</p>
                             </div>
                          </div>
                          <button 
                             onClick={() => setUserToDelete(user)}
                             className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                             🗑️
                          </button>
                       </div>
                    )) : (
                       <div className="col-span-full py-10 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl opacity-40">
                          <p className="text-xs font-black uppercase text-slate-400">Kein Personal für diesen Standort konfiguriert</p>
                       </div>
                    )}
                 </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/50 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-20 text-center min-h-[600px]">
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-3xl shadow-sm flex items-center justify-center text-2xl mb-4 text-slate-300">🏢</div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Standort wählen</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-xs font-medium">Suchen Sie links nach einem Standort, um die permanent verknüpften Geräte zu verwalten.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 text-left relative">
            
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {editingFridge ? 'Gerät bearbeiten' : 'Geräte hinzufügen'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
              {/* --- SEARCHABLE FACILITY DROPDOWN --- */}
              <div className="relative" ref={modalDropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Zielfacilility (Verknüpfung)</label>
                <div 
                  className={`flex items-center px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold text-sm h-[56px] transition-all cursor-text ${invalidFields.has('facilityId') ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200 dark:border-slate-700'}`}
                  onClick={() => setIsModalDropdownOpen(true)}
                >
                  <span className="mr-3 text-slate-400">🏢</span>
                  <input 
                    type="text" 
                    value={modalFacilitySearch} 
                    onChange={e => {
                      setModalFacilitySearch(e.target.value); 
                      setIsModalDropdownOpen(true);
                      if (invalidFields.has('facilityId')) {
                        const n = new Set(invalidFields);
                        n.delete('facilityId');
                        setInvalidFields(n);
                      }
                    }} 
                    onFocus={() => setIsModalDropdownOpen(true)}
                    placeholder="Standort suchen & wählen..." 
                    className="flex-1 bg-transparent font-black text-sm outline-none text-slate-900 dark:text-white uppercase placeholder:text-slate-400" 
                  />
                  <span className="text-slate-400 text-xs ml-2">{isModalDropdownOpen ? '▲' : '▼'}</span>
                </div>
                {isModalDropdownOpen && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {modalFilteredFacilities.map(f => (
                      <button 
                        key={f.id} 
                        onClick={() => { 
                          setModalFacilityId(f.id); 
                          setModalFacilitySearch(f.name); 
                          setIsModalDropdownOpen(false); 
                        }} 
                        className={`w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm border-b last:border-0 border-slate-50 dark:border-slate-800 ${modalFacilityId === f.id ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {f.name}
                      </button>
                    ))}
                    {modalFilteredFacilities.length === 0 && (
                       <div className="px-5 py-3 text-slate-400 text-xs italic font-bold">Kein Standort gefunden</div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Geräte-Konfiguration</h4>
                   {!editingFridge && (
                     <button onClick={handleAddRow} className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">+ Weiteres Gerät</button>
                   )}
                </div>
                {newFridgesForm.map((row, idx) => (
                  <div key={row.id} className="p-6 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] relative group/row animate-in slide-in-from-top-2">
                    {!editingFridge && newFridgesForm.length > 1 && (
                      <button onClick={() => handleRemoveRow(idx)} className="absolute -top-2 -right-2 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover/row:opacity-100 transition-opacity">✕</button>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Bezeichnung</label>
                        <input 
                          type="text"
                          value={row.name}
                          onChange={(e) => {
                             const next = [...newFridgesForm];
                             next[idx].name = e.target.value;
                             setNewFridgesForm(next);
                          }}
                          className={getFieldClass(`row-${idx}-name`)}
                          placeholder="z.B. TK-Schrank Fleisch"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Typ</label>
                        <select 
                          value={row.typeId}
                          onChange={(e) => {
                            const next = [...newFridgesForm];
                            next[idx].typeId = e.target.value;
                            setNewFridgesForm(next);
                          }}
                          className={getFieldClass(`row-${idx}-typeId`)}
                        >
                          <option value="">Wählen...</option>
                          {fridgeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform uppercase text-xs tracking-widest">
                {editingFridge ? 'Aktualisieren' : 'Geräte Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {fridgeToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Gerät löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">"{fridgeToDelete.name}" wird permanent aus der Liste entfernt.</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDeleteFridge} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all">LÖSCHEN</button>
              <button onClick={() => setFridgeToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 font-black py-4 rounded-2xl transition-all">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {facilityToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-12 shadow-2xl border border-rose-500/30 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-rose-600" />
            <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner animate-pulse">☢️</div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter uppercase">STANDORT LÖSCHEN?</h3>
            <p className="text-rose-600 font-black text-xs uppercase tracking-widest mb-10">Dies löscht permanent alle verknüpften Geräte und Zuweisungen.</p>
            <div className="flex flex-col space-y-4">
              <button onClick={confirmDeleteFacility} className="w-full bg-rose-600 text-white font-black py-5 rounded-[1.75rem] shadow-xl transition-all uppercase text-sm tracking-widest">UNWIDERRUFLICH LÖSCHEN</button>
              <button onClick={() => setFacilityToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 font-black py-5 rounded-[1.75rem] transition-all uppercase text-sm tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
