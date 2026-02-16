
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  TranslationSet, 
  Assignment, 
  User, 
  Facility, 
  FormTemplate, 
  Menu, 
  AssignmentFrequency,
  AssignmentTargetType,
  AssignmentResourceType,
  AdminTab,
  FacilityType
} from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

const DAYS_OF_WEEK = [
  { id: 1, label: 'Mo' }, { id: 2, label: 'Di' }, { id: 3, label: 'Mi' },
  { id: 4, label: 'Do' }, { id: 5, label: 'Fr' }, { id: 6, label: 'Sa' }, { id: 7, label: 'So' }
];

interface ResourceConfig {
  type: AssignmentResourceType;
  frequency: AssignmentFrequency;
  day?: number; // 1-7 for weekly, 1-31 for monthly
}

interface AssignmentsPageProps {
  t: TranslationSet;
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  users: User[];
  facilities: Facility[];
  forms: FormTemplate[];
  menus: Menu[];
  facilityTypes: FacilityType[];
  onTabChange: (tab: AdminTab) => void;
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({ t, assignments, setAssignments, users, facilities, forms, menus, facilityTypes, onTabChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' | 'warning' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [bulkDeleteGroup, setBulkDeleteGroup] = useState<{ type: string, id: string, name: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Modal states for multi-selection
  const [modalTargetType, setModalTargetType] = useState<AssignmentTargetType>('user');
  const [modalTargetIds, setModalTargetIds] = useState<Set<string>>(new Set());
  const [modalResourceConfigs, setModalResourceConfigs] = useState<Record<string, ResourceConfig>>({});
  
  const [modalStartDate, setModalStartDate] = useState(getTodayStr());
  const [modalEndDate, setModalEndDate] = useState('2030-12-31');
  const [modalSkipWeekend, setModalSkipWeekend] = useState(true);
  const [modalSkipHolidays, setModalSkipHolidays] = useState(true);

  // Search states for modal
  const [targetSearch, setTargetSearch] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [menuSearch, setMenuSearch] = useState('');

  const showAlert = (text: string, type: 'error' | 'success' | 'warning' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const groupedAssignments = useMemo(() => {
    const filtered = assignments.filter(a => {
      let targetName = 'Unbekannt';
      if (a.targetType === 'user') targetName = users.find(u => u.id === a.targetId)?.name || 'Unbekannt';
      else if (a.targetType === 'facility') targetName = facilities.find(f => f.id === a.targetId)?.name || 'Unbekannt';
      else if (a.targetType === 'facilityType') targetName = facilityTypes.find(ft => ft.id === a.targetId)?.name || 'Unbekannt';
      
      const resourceName = a.resourceType === 'form' ? forms.find(f => f.id === a.resourceId)?.title : menus.find(m => m.id === a.resourceId)?.name;
      const search = searchTerm.toLowerCase();
      return (targetName.toLowerCase().includes(search) || resourceName?.toLowerCase().includes(search));
    });

    const groups: Record<string, Assignment[]> = {};
    filtered.forEach(a => {
      const key = `${a.targetType}:::${a.targetId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });

    return Object.entries(groups).map(([key, items]) => {
      const first = items[0];
      let targetObj: any = null;
      if (first.targetType === 'user') targetObj = users.find(u => u.id === first.targetId);
      else if (first.targetType === 'facility') targetObj = facilities.find(f => f.id === first.targetId);
      else if (first.targetType === 'facilityType') targetObj = facilityTypes.find(ft => ft.id === first.targetId);
      
      return { 
        key, 
        target: targetObj, 
        type: first.targetType, 
        targetId: first.targetId,
        items 
      };
    }).sort((a, b) => (a.target?.name || '').localeCompare(b.target?.name || ''));
  }, [assignments, searchTerm, users, facilities, forms, menus, facilityTypes]);

  const filteredTargets = useMemo(() => {
    let list: any[] = [];
    if (modalTargetType === 'user') list = users;
    else if (modalTargetType === 'facility') list = facilities;
    else list = facilityTypes;
    
    return list.filter(t => (t.name || '').toLowerCase().includes(targetSearch.toLowerCase()));
  }, [modalTargetType, targetSearch, users, facilities, facilityTypes]);

  const filteredForms = useMemo(() => forms.filter(f => f.title.toLowerCase().includes(formSearch.toLowerCase())), [forms, formSearch]);
  const filteredMenus = useMemo(() => menus.filter(m => m.name.toLowerCase().includes(menuSearch.toLowerCase())), [menus, menuSearch]);

  const toggleTarget = (id: string) => {
    const next = new Set(modalTargetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setModalTargetIds(next);
    if (invalidFields.has('targetIds')) {
      const n = new Set(invalidFields);
      n.delete('targetIds');
      setInvalidFields(n);
    }
  };

  const toggleResource = (id: string, type: AssignmentResourceType) => {
    const next = { ...modalResourceConfigs };
    if (next[id]) {
      delete next[id];
    } else {
      next[id] = { 
        type, 
        frequency: 'daily',
        day: 1
      };
    }
    setModalResourceConfigs(next);
    if (invalidFields.has('resources')) {
      const n = new Set(invalidFields);
      n.delete('resources');
      setInvalidFields(n);
    }
  };

  const updateResourceConfig = (id: string, updates: Partial<ResourceConfig>) => {
    setModalResourceConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const openEditModal = (a: Assignment) => {
    setEditingAssignment(a);
    setModalTargetType(a.targetType);
    setModalStartDate(a.startDate);
    setModalEndDate(a.endDate);
    setModalSkipWeekend(a.skipWeekend);
    setModalSkipHolidays(a.skipHolidays);
    
    setModalResourceConfigs({
      [a.resourceId]: {
        type: a.resourceType,
        frequency: a.frequency,
        day: a.frequencyDay
      }
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const errors = new Set<string>();
    if (!editingAssignment && modalTargetIds.size === 0) errors.add('targetIds');
    if (Object.keys(modalResourceConfigs).length === 0) errors.add('resources');

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", 'error');
      return;
    }

    if (editingAssignment) {
      const config = modalResourceConfigs[editingAssignment.resourceId];
      setAssignments(prev => prev.map(a => a.id === editingAssignment.id ? {
        ...a,
        frequency: config.frequency,
        frequencyDay: config.day,
        startDate: modalStartDate,
        endDate: modalEndDate,
        skipWeekend: modalSkipWeekend,
        skipHolidays: modalSkipHolidays
      } : a));
      showAlert("Zuweisung aktualisiert.", 'success');
      setEditingAssignment(null);
    } else {
      const newAssignments: Assignment[] = [];
      let skipCount = 0;

      modalTargetIds.forEach(targetId => {
        Object.keys(modalResourceConfigs).forEach(resourceId => {
          const config = modalResourceConfigs[resourceId];
          
          const alreadyExists = assignments.some(existing => 
            existing.targetId === targetId && 
            existing.targetType === modalTargetType &&
            existing.resourceId === resourceId &&
            existing.resourceType === config.type
          );

          if (alreadyExists) {
            skipCount++;
            return;
          }

          newAssignments.push({
            id: `A-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
            targetType: modalTargetType,
            targetId,
            resourceType: config.type,
            resourceId,
            frequency: config.frequency,
            frequencyDay: config.day,
            startDate: modalStartDate,
            endDate: modalEndDate,
            skipWeekend: modalSkipWeekend,
            skipHolidays: modalSkipHolidays
          } as Assignment);
        });
      });

      if (newAssignments.length > 0) {
        setAssignments(prev => [...prev, ...newAssignments]);
        showAlert(
          skipCount > 0 
            ? `${newAssignments.length} neue Zuweisung(en) erstellt, ${skipCount} Duplikate übersprungen.` 
            : `${newAssignments.length} Zuweisung(en) erstellt.`, 
          'success'
        );
      } else if (skipCount > 0) {
        showAlert(`Keine Änderungen vorgenommen. Alle gewählten Kombinationen existieren bereits.`, 'warning');
      }
    }

    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (assignmentToDelete) {
      setAssignments(prev => prev.filter(a => a.id !== assignmentToDelete.id));
      showAlert("Zuweisung wurde entfernt.", 'success');
      setAssignmentToDelete(null);
    }
  };

  const confirmBulkDelete = () => {
    if (bulkDeleteGroup) {
      setAssignments(prev => prev.filter(a => !(a.targetType === bulkDeleteGroup.type && a.targetId === bulkDeleteGroup.id)));
      showAlert(`Alle Zuweisungen für ${bulkDeleteGroup.name} wurden entfernt.`, 'success');
      setBulkDeleteGroup(null);
    }
  };

  const navigateToResource = (a: Assignment) => {
    if (a.resourceType === 'form') onTabChange(AdminTab.FORM_CREATOR);
    else onTabChange(AdminTab.MENUS);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative text-left pb-16">
      {alertMsg && !isModalOpen && !assignmentToDelete && !bulkDeleteGroup && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : alertMsg.type === 'warning' ? 'bg-amber-500' : 'bg-rose-500'} text-white px-10 py-5 rounded-[2rem] shadow-2xl flex items-center space-x-4 border border-white/20`}>
             <span className="text-2xl">{alertMsg.type === 'success' ? '✅' : alertMsg.type === 'warning' ? '⚠️' : '❌'}</span>
             <span className="font-black text-sm uppercase tracking-tight">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none mb-2">{t.tabs.assignments}</h1>
          <p className="text-base text-slate-500 font-medium tracking-tight">Aufgabenzuweisung & Terminierung</p>
        </div>
        <button 
          onClick={() => { 
            setEditingAssignment(null);
            setModalResourceConfigs({}); 
            setModalTargetIds(new Set()); 
            setTargetSearch(''); 
            setFormSearch('');
            setMenuSearch('');
            setInvalidFields(new Set()); 
            setModalStartDate(getTodayStr());
            setModalEndDate('2030-12-31');
            setIsModalOpen(true); 
          }} 
          className="bg-blue-600 text-white px-10 py-4 rounded-[1.75rem] font-black shadow-xl uppercase text-sm tracking-widest"
        >
          + Neue Zuweisung
        </button>
      </div>

      <div className="relative w-full max-w-3xl text-left">
        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
        <input 
          type="text" 
          placeholder="Nach Standort, Typ oder Ressource suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 font-bold transition-all shadow-sm text-base h-[64px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {groupedAssignments.map(group => (
          <div key={group.key} className="bg-white dark:bg-slate-900 rounded-[3.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col group/card hover:shadow-2xl transition-all">
             <div className={`p-10 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ${group.type === 'facilityType' ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                <div className="flex items-center space-x-6">
                   <div className={`w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-4xl shadow-inner ${group.type === 'facilityType' ? 'border-2 border-indigo-200' : ''}`}>
                      {group.type === 'user' ? '👤' : group.type === 'facility' ? '🏢' : '🏷️'}
                   </div>
                   <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-2xl tracking-tight leading-none mb-1.5">{group.target?.name || 'Unbekannt'}</h3>
                      <span className={`text-[12px] font-black uppercase tracking-[0.15em] mt-1 inline-block ${group.type === 'facilityType' ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {group.type === 'user' ? 'Direkte Nutzerzuweisung' : group.type === 'facility' ? 'Standortweite Zuweisung' : 'Kategorie-Zuweisung (Alle)'}
                      </span>
                   </div>
                </div>
                <button 
                   onClick={() => setBulkDeleteGroup({ type: group.type, id: group.targetId, name: group.target?.name || 'Unbekannt' })}
                   className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-2xl hover:bg-rose-500 hover:text-white transition-all text-sm font-black uppercase tracking-widest opacity-0 group-hover/card:opacity-100 flex items-center space-x-2"
                >
                   <span>🗑️</span> <span className="hidden lg:inline">Alle entfernen</span>
                </button>
             </div>
             <div className="p-10 space-y-5">
                {group.items.map(a => (
                   <div key={a.id} className={`flex items-center justify-between p-6 rounded-[2.5rem] border group/item transition-colors ${group.type === 'facilityType' ? 'bg-indigo-50/20 border-indigo-100 hover:border-indigo-300' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 hover:border-blue-200'}`}>
                      <div>
                        <p className="font-black text-base text-slate-800 dark:text-slate-200 mb-1">{(a.resourceType === 'form' ? forms.find(f => f.id === a.resourceId)?.title : menus.find(m => m.id === a.resourceId)?.name)}</p>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                          {a.frequency === 'weekly' ? `Wöchentlich (Tag ${a.frequencyDay})` : a.frequency === 'monthly' ? `Monatlich (Tag ${a.frequencyDay})` : a.frequency} • bis {a.endDate.split('-').reverse().join('.')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                         <button onClick={() => navigateToResource(a)} className="p-2.5 text-slate-400 hover:text-blue-600 transition-all text-xl" title="Ressource bearbeiten">⚙️</button>
                         <button onClick={() => openEditModal(a)} className="p-2.5 text-blue-500 hover:scale-110 transition-all text-xl" title="Zuweisung anpassen">✏️</button>
                         <button onClick={() => setAssignmentToDelete(a)} className="p-2.5 text-rose-500 hover:scale-110 transition-all text-xl" title="Entfernen">🗑️</button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        ))}
        {groupedAssignments.length === 0 && (
          <div className="col-span-full py-28 text-center text-slate-400 font-black uppercase tracking-widest text-base italic bg-white/40 rounded-[3rem] border-4 border-dashed border-slate-200">Keine Zuweisungen gefunden</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[95vh] rounded-[4rem] shadow-2xl flex flex-col border border-white/10 overflow-hidden">
            <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {editingAssignment ? 'Zuweisung bearbeiten' : 'Massen-Zuweisung erstellen'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center rounded-[1.25rem] bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold hover:scale-110 transition-all">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 lg:p-14 space-y-14 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-14">
                
                <div className={`space-y-8 ${editingAssignment ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest">1. Empfänger Wählen</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-[1rem] scale-95">
                       <button onClick={() => { setModalTargetType('user'); setModalTargetIds(new Set()); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${modalTargetType === 'user' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Nutzer</button>
                       <button onClick={() => { setModalTargetType('facility'); setModalTargetIds(new Set()); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${modalTargetType === 'facility' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}>Standort</button>
                       <button onClick={() => { setModalTargetType('facilityType'); setModalTargetIds(new Set()); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${modalTargetType === 'facilityType' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Typ</button>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
                    <input 
                      type="text" 
                      placeholder="Suchen..." 
                      value={targetSearch}
                      onChange={(e) => setTargetSearch(e.target.value)}
                      className="w-full pl-12 pr-5 py-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 h-[56px]"
                    />
                  </div>

                  <div className={`space-y-2 h-[420px] overflow-y-auto custom-scrollbar pr-3 p-1 rounded-[2rem] border-2 ${invalidFields.has('targetIds') ? 'border-rose-500 ring-4 ring-rose-500/10 animate-shake' : 'border-slate-100 dark:border-slate-800'}`}>
                    {filteredTargets.map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => toggleTarget(t.id)}
                        className={`w-full flex items-center justify-between p-5 rounded-[1.5rem] transition-all border-2 ${modalTargetIds.has(t.id) ? (modalTargetType === 'facilityType' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-blue-600 border-blue-600 text-white') : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50'}`}
                      >
                        <span className="text-base font-bold">{t.name}</span>
                        {modalTargetIds.has(t.id) && <span className="font-black">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <label className="block text-[12px] font-black text-slate-400 uppercase tracking-widest px-1">2. Checklisten (HACCP)</label>
                    <div className={`relative ${editingAssignment && editingAssignment.resourceType !== 'form' ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Checklisten suchen..." 
                        value={formSearch}
                        onChange={(e) => setFormSearch(e.target.value)}
                        className="w-full pl-12 pr-5 py-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 h-[56px]"
                      />
                    </div>
                    <div className={`space-y-3 h-[420px] overflow-y-auto custom-scrollbar pr-3 p-1 rounded-[2rem] border-2 ${invalidFields.has('resources') ? 'border-rose-500 ring-4 ring-rose-500/10 animate-shake' : 'border-slate-100 dark:border-slate-800'}`}>
                      {filteredForms.map(f => {
                        const isVisible = !editingAssignment || editingAssignment.resourceId === f.id;
                        if (!isVisible) return null;
                        return (
                          <div key={f.id} className={`p-6 rounded-[2rem] border-2 transition-all ${modalResourceConfigs[f.id] ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800'}`}>
                            <div className="flex items-center justify-between mb-5">
                              <span className="text-base font-black text-slate-800 dark:text-slate-100 truncate pr-3">{f.title}</span>
                              {!editingAssignment && (
                                <button 
                                  onClick={() => toggleResource(f.id, 'form')}
                                  className={`w-10 h-10 rounded-[1.25rem] flex items-center justify-center transition-all text-xl ${modalResourceConfigs[f.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                                >
                                  {modalResourceConfigs[f.id] ? '✓' : '+'}
                                </button>
                              )}
                            </div>
                            
                            {modalResourceConfigs[f.id] && (
                              <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Frequenz</label>
                                    <select 
                                      value={modalResourceConfigs[f.id].frequency} 
                                      onChange={(e) => updateResourceConfig(f.id, { frequency: e.target.value as any })}
                                      className="w-full px-4 py-2.5 rounded-[1rem] bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800 text-[12px] font-black outline-none h-[48px]"
                                    >
                                      <option value="once">Einmalig</option>
                                      <option value="daily">Täglich</option>
                                      <option value="weekly">Wöchentlich</option>
                                      <option value="monthly">Monatlich</option>
                                    </select>
                                </div>

                                {modalResourceConfigs[f.id].frequency === 'weekly' && (
                                  <div className="space-y-2">
                                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Wochentag</label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {DAYS_OF_WEEK.map(d => (
                                          <button 
                                            key={d.id} 
                                            onClick={() => updateResourceConfig(f.id, { day: d.id })}
                                            className={`w-9 h-9 rounded-[0.75rem] text-[11px] font-black border-2 transition-all ${modalResourceConfigs[f.id].day === d.id ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 text-slate-400'}`}
                                          >
                                            {d.label}
                                          </button>
                                        ))}
                                      </div>
                                  </div>
                                )}

                                {modalResourceConfigs[f.id].frequency === 'monthly' && (
                                  <div className="space-y-2">
                                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Monatstag (1-31)</label>
                                      <input 
                                        type="number" 
                                        min="1" max="31" 
                                        value={modalResourceConfigs[f.id].day || 1}
                                        onChange={(e) => updateResourceConfig(f.id, { day: parseInt(e.target.value) })}
                                        className="w-full px-4 py-2.5 rounded-[1rem] bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800 text-[12px] font-black outline-none h-[48px]" 
                                      />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <label className="block text-[12px] font-black text-slate-400 uppercase tracking-widest px-1">3. Menü-Pläne (HACCP)</label>
                    <div className={`relative ${editingAssignment && editingAssignment.resourceType !== 'menu' ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Menüs suchen..." 
                        value={menuSearch}
                        onChange={(e) => setMenuSearch(e.target.value)}
                        className="w-full pl-12 pr-5 py-4 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/10 h-[56px]"
                      />
                    </div>
                    <div className={`space-y-3 h-[420px] overflow-y-auto custom-scrollbar pr-3 p-1 rounded-[2rem] border-2 ${invalidFields.has('resources') ? 'border-rose-500 ring-4 ring-rose-500/10 animate-shake' : 'border-slate-100 dark:border-slate-800'}`}>
                      {filteredMenus.map(m => {
                        const isVisible = !editingAssignment || editingAssignment.resourceId === m.id;
                        if (!isVisible) return null;
                        return (
                          <div key={m.id} className={`p-6 rounded-[2rem] border-2 transition-all ${modalResourceConfigs[m.id] ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-500 text-indigo-700' : 'bg-white dark:bg-slate-900 border-slate-50 dark:border-slate-800 hover:bg-slate-50'}`}>
                            <div className="flex items-center justify-between mb-5">
                              <div className="flex items-center space-x-4">
                                <span className="text-3xl">🍽️</span>
                                <span className="text-base font-black">{m.name}</span>
                              </div>
                              {!editingAssignment && (
                                <button 
                                  onClick={() => toggleResource(m.id, 'menu')}
                                  className={`w-10 h-10 rounded-[1.25rem] flex items-center justify-center transition-all text-xl ${modalResourceConfigs[m.id] ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                                >
                                  {modalResourceConfigs[m.id] ? '✓' : '+'}
                                </button>
                              )}
                            </div>
                            {modalResourceConfigs[m.id] && (
                              <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Frequenz</label>
                                    <select 
                                      value={modalResourceConfigs[m.id].frequency} 
                                      onChange={(e) => updateResourceConfig(m.id, { frequency: e.target.value as any })}
                                      className="w-full px-4 py-2.5 rounded-[1rem] bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800 text-[12px] font-black outline-none h-[48px]"
                                    >
                                      <option value="once">Einmalig</option>
                                      <option value="daily">Täglich</option>
                                      <option value="weekly">Wöchentlich</option>
                                      <option value="monthly">Monatlich</option>
                                    </select>
                                </div>
                                {modalResourceConfigs[m.id].frequency === 'weekly' && (
                                  <div className="space-y-2">
                                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Wochentag</label>
                                      <div className="flex flex-wrap gap-1.5">
                                        {DAYS_OF_WEEK.map(d => (
                                          <button 
                                            key={d.id} 
                                            onClick={() => updateResourceConfig(m.id, { day: d.id })}
                                            className={`w-9 h-9 rounded-[0.75rem] text-[11px] font-black border-2 transition-all ${modalResourceConfigs[m.id].day === d.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}
                                          >
                                            {d.label}
                                          </button>
                                        ))}
                                      </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-14 border-t border-slate-100 dark:border-slate-800 space-y-12">
                 <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">4. Zeitraum & Regeln (Gilt für alle gewählten)</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                    <GermanCalendarPicker label="Beginn" value={modalStartDate} onChange={setModalStartDate} />
                    <GermanCalendarPicker label="Ende" value={modalEndDate} onChange={setModalEndDate} />
                    
                    <div className="space-y-6">
                       <label className="block text-[12px] font-black text-slate-400 uppercase tracking-widest px-1">Auslassen</label>
                       <div className="space-y-4">
                          <button onClick={() => setModalSkipWeekend(!modalSkipWeekend)} className="flex items-center space-x-4 group">
                             <div className={`w-12 h-7 rounded-full transition-all relative ${modalSkipWeekend ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${modalSkipWeekend ? 'left-6' : 'left-1'}`} />
                             </div>
                             <span className="text-[12px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Wochenenden</span>
                          </button>
                          <button onClick={() => setModalSkipHolidays(!modalSkipHolidays)} className="flex items-center space-x-4 group">
                             <div className={`w-12 h-7 rounded-full transition-all relative ${modalSkipHolidays ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${modalSkipHolidays ? 'left-6' : 'left-1'}`} />
                             </div>
                             <span className="text-[12px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Feiertage</span>
                          </button>
                       </div>
                    </div>

                    <div className="flex items-end">
                       <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[2rem] w-full border-2 border-slate-100 dark:border-slate-700 shadow-inner">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Zusammenfassung</p>
                          <p className={`text-sm font-black uppercase leading-snug ${modalTargetType === 'facilityType' ? 'text-indigo-600' : 'text-blue-600'}`}>
                             {editingAssignment ? 'Zuweisung wird aktualisiert' : `${modalTargetIds.size} Empfänger x ${Object.keys(modalResourceConfigs).length} Aufgaben`}
                          </p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-8 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-500 font-black uppercase text-[12px] tracking-[0.2em]">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-14 py-5 rounded-[1.75rem] font-black shadow-2xl hover:scale-105 active:scale-95 transition-transform uppercase text-sm tracking-widest">Konfiguration Übernehmen</button>
            </div>
          </div>
        </div>
      )}

      {assignmentToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-12 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-rose-500" />
            <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">⚠️</div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter uppercase">Zuweisung löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-10 font-bold text-base leading-relaxed">Diese Aufgabe wird für den gewählten Empfänger dauerhaft aus dem Dienstplan entfernt.</p>
            <div className="flex flex-col space-y-4">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-5 rounded-[1.75rem] shadow-xl shadow-rose-500/20 transition-all uppercase text-sm tracking-widest">JA, LÖSCHEN</button>
              <button onClick={() => setAssignmentToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-5 rounded-[1.75rem] transition-all uppercase text-sm tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {bulkDeleteGroup && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] p-12 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-rose-500" />
            <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner">🗑️</div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter uppercase">Alle löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-10 font-bold text-base leading-relaxed">Möchten Sie wirklich ALLE Zuweisungen für <strong>{bulkDeleteGroup.name}</strong> entfernen?</p>
            <div className="flex flex-col space-y-4">
              <button onClick={confirmBulkDelete} className="w-full bg-rose-600 text-white font-black py-5 rounded-[1.75rem] shadow-xl shadow-rose-500/20 transition-all uppercase text-sm tracking-widest">JA, ALLE ENTFERNEN</button>
              <button onClick={() => setBulkDeleteGroup(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-5 rounded-[1.75rem] transition-all uppercase text-sm tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
