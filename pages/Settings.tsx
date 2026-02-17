
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  TranslationSet, 
  Holiday, 
  CookingMethod, 
  RefrigeratorType, 
  FacilityType, 
  Checkpoint,
  FacilityException,
  Facility
} from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

type SettingsSection = 'holidays' | 'cookingMethods' | 'fridgeTypes' | 'facilityTypes' | 'excludedFacilities' | 'legal';

export const SettingsPage: React.FC<{ 
  t: TranslationSet; 
  facilities: Facility[];
  fridgeTypes: RefrigeratorType[];
  setFridgeTypes: React.Dispatch<React.SetStateAction<RefrigeratorType[]>>;
  cookingMethods: CookingMethod[];
  setCookingMethods: React.Dispatch<React.SetStateAction<CookingMethod[]>>;
  facilityTypes: FacilityType[];
  setFacilityTypes: React.Dispatch<React.SetStateAction<FacilityType[]>>;
  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  excludedFacilities: FacilityException[];
  setExcludedFacilities: React.Dispatch<React.SetStateAction<FacilityException[]>>;
  legalTexts: { imprint: string; privacy: string };
  setLegalTexts: React.Dispatch<React.SetStateAction<{ imprint: string; privacy: string }>>;
  onSync: (type: string, data: any, del?: boolean) => void;
}> = ({ t, facilities, fridgeTypes, setFridgeTypes, cookingMethods, setCookingMethods, facilityTypes, setFacilityTypes, holidays, setHolidays, excludedFacilities, setExcludedFacilities, legalTexts, setLegalTexts, onSync }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('holidays');
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [searchTerms, setSearchTerms] = useState<Record<SettingsSection, string>>({
    holidays: '',
    cookingMethods: '',
    fridgeTypes: '',
    facilityTypes: '',
    excludedFacilities: '',
    legal: ''
  });

  const [editingHoliday, setEditingHoliday] = useState<Partial<Holiday> | null>(null);
  const [editingCooking, setEditingCooking] = useState<Partial<CookingMethod> | null>(null);
  const [editingFridge, setEditingFridge] = useState<Partial<RefrigeratorType> | null>(null);
  const [editingFacilityType, setEditingFacilityType] = useState<Partial<FacilityType> | null>(null);
  const [editingExcluded, setEditingExcluded] = useState<Partial<FacilityException> | null>(null);

  const [pendingDelete, setPendingDelete] = useState<{ item: any, type: SettingsSection } | null>(null);
  
  const [modalFacilitySearch, setModalFacilitySearch] = useState('');
  const [isFacilityDropdownOpen, setIsFacilityDropdownOpen] = useState(false);
  const facilityDropdownRef = useRef<HTMLDivElement>(null);

  const filteredHolidays = useMemo(() => holidays.filter(h => h.name.toLowerCase().includes(searchTerms.holidays.toLowerCase())), [holidays, searchTerms.holidays]);
  const filteredCooking = useMemo(() => cookingMethods.filter(m => m.name.toLowerCase().includes(searchTerms.cookingMethods.toLowerCase())), [cookingMethods, searchTerms.cookingMethods]);
  const filteredFridges = useMemo(() => fridgeTypes.filter(f => f.name.toLowerCase().includes(searchTerms.fridgeTypes.toLowerCase())), [fridgeTypes, searchTerms.fridgeTypes]);
  const filteredFacilityTypesList = useMemo(() => facilityTypes.filter(t => t.name.toLowerCase().includes(searchTerms.facilityTypes.toLowerCase())), [facilityTypes, searchTerms.facilityTypes]);
  const filteredExcluded = useMemo(() => excludedFacilities.filter(e => e.name.toLowerCase().includes(searchTerms.excludedFacilities.toLowerCase())), [excludedFacilities, searchTerms.excludedFacilities]);

  const modalFilteredFacilities = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(modalFacilitySearch.toLowerCase()));
  }, [facilities, modalFacilitySearch]);

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const formatDateForDisplay = (dateStr: string) => {
    if (!dateStr) return '--.--.----';
    const parts = dateStr.split('-');
    return parts.length !== 3 ? dateStr : `${parts[2]}.${parts[1]}.${parts[0]}`;
  };

  const showAlert = (msg: string, type: 'error' | 'success' = 'error') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const checkUniqueness = (list: any[], name: string, currentId?: string) => {
    const exists = list.some(item => 
      item.name.toLowerCase().trim() === name.toLowerCase().trim() && item.id !== currentId
    );
    if (exists) {
      setInvalidFields(new Set(['name']));
      showAlert(`Fehler: Der Name "${name}" existiert bereits.`, 'error');
      return false;
    }
    return true;
  };

  const handleCheckpointChange = (idx: number, field: keyof Checkpoint, val: string, setter: any, current: any) => {
    const nextCps = [...current.checkpoints];
    if (field === 'name') {
      nextCps[idx] = { ...nextCps[idx], [field]: val };
      setter({ ...current, checkpoints: nextCps });
      if (val.trim() && invalidFields.has(`cp-${idx}-name`)) {
        const n = new Set(invalidFields);
        n.delete(`cp-${idx}-name`);
        setInvalidFields(n);
      }
    } else {
      if (/^-?\d*[.,]?\d*$/.test(val) || val === '') {
        nextCps[idx] = { ...nextCps[idx], [field]: val.replace(',', '.') };
        setter({ ...current, checkpoints: nextCps });
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (facilityDropdownRef.current && !facilityDropdownRef.current.contains(event.target as Node)) {
        setIsFacilityDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeDelete = () => {
    if (!pendingDelete) return;
    const { item, type } = pendingDelete;
    if (type === 'holidays') { setHolidays(prev => prev.filter(x => x.id !== item.id)); onSync('holidays', item, true); }
    else if (type === 'cookingMethods') { setCookingMethods(prev => prev.filter(x => x.id !== item.id)); onSync('cooking_methods', item, true); }
    else if (type === 'fridgeTypes') { setFridgeTypes(prev => prev.filter(x => x.id !== item.id)); onSync('fridge_types', item, true); }
    else if (type === 'facilityTypes') { setFacilityTypes(prev => prev.filter(x => x.id !== item.id)); onSync('facility_types', item, true); }
    else if (type === 'excludedFacilities') { setExcludedFacilities(prev => prev.filter(x => x.id !== item.id)); onSync('facility_exceptions', item, true); }
    showAlert(`"${item.name}" gelöscht.`, 'success');
    setPendingDelete(null);
  };

  const getFieldClass = (key: string, base: string = "w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold outline-none transition-all") => {
    if (invalidFields.has(key)) {
        return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  const sections: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'holidays', label: t.settings.holidays, icon: '📅' },
    { id: 'cookingMethods', label: t.settings.cookingMethods, icon: '🍳' },
    { id: 'fridgeTypes', label: t.settings.fridgeTypes, icon: '❄️' },
    { id: 'facilityTypes', label: t.settings.facilityTypes, icon: '🏢' },
    { id: 'excludedFacilities', label: t.settings.excludedFacilities, icon: '🚫' },
    { id: 'legal', label: 'Rechtliches', icon: '🛡️' }
  ];

  const handleGlobalSave = () => {
    const errors = new Set<string>();
    let currentEditing: any = editingHoliday || editingCooking || editingFridge || editingFacilityType || editingExcluded;
    if (!currentEditing) return;

    if (!currentEditing.name?.trim()) errors.add('name');
    if (currentEditing.checkpoints) {
        currentEditing.checkpoints.forEach((cp: any, idx: number) => {
            if (!cp.name.trim()) errors.add(`cp-${idx}-name`);
        });
    }

    if (errors.size > 0) {
        setInvalidFields(errors);
        showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", "error");
        return;
    }

    if (editingHoliday) {
        if (!checkUniqueness(holidays, editingHoliday.name!, editingHoliday.id)) return;
        const item = { ...editingHoliday, id: editingHoliday.id || `H-${Date.now()}` } as Holiday;
        setHolidays(prev => editingHoliday.id ? prev.map(h => h.id === item.id ? item : h) : [...prev, item]);
        onSync('holidays', item);
        setEditingHoliday(null);
    } else if (editingCooking) {
        if (!checkUniqueness(cookingMethods, editingCooking.name!, editingCooking.id)) return;
        const item = { ...editingCooking, id: editingCooking.id || `CM-${Date.now()}` } as CookingMethod;
        setCookingMethods(prev => editingCooking.id ? prev.map(m => m.id === item.id ? item : m) : [...prev, item]);
        onSync('cooking_methods', item);
        setEditingCooking(null);
    } else if (editingFridge) {
        if (!checkUniqueness(fridgeTypes, editingFridge.name!, editingFridge.id)) return;
        const item = { ...editingFridge, id: editingFridge.id || `RT-${Date.now()}` } as RefrigeratorType;
        setFridgeTypes(prev => editingFridge.id ? prev.map(m => m.id === item.id ? item : m) : [...prev, item]);
        onSync('fridge_types', item);
        setEditingFridge(null);
    } else if (editingFacilityType) {
        if (!checkUniqueness(facilityTypes, editingFacilityType.name!, editingFacilityType.id)) return;
        const item = { ...editingFacilityType, id: editingFacilityType.id || `FT-${Date.now()}` } as FacilityType;
        setFacilityTypes(prev => editingFacilityType.id ? prev.map(m => m.id === item.id ? item : m) : [...prev, item]);
        onSync('facility_types', item);
        setEditingFacilityType(null);
    } else if (editingExcluded) {
        const item = { ...editingExcluded, id: editingExcluded.id || `EX-${Date.now()}` } as FacilityException;
        setExcludedFacilities(prev => editingExcluded.id ? prev.map(m => m.id === item.id ? item : m) : [...prev, item]);
        onSync('facility_exceptions', item);
        setEditingExcluded(null);
    }
    
    showAlert("Erfolgreich gespeichert.", "success");
    setInvalidFields(new Set());
  };

  const saveLegalTexts = () => {
    showAlert("Rechtliche Texte wurden aktualisiert.", "success");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative text-left">
      {alert && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
           <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center space-x-3 ${alert.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' : 'bg-emerald-500 border-emerald-400 text-white'}`}>
             <span className="text-xl">{alert.type === 'error' ? '⚠️' : '✅'}</span>
             <span className="text-sm font-black uppercase tracking-tight">{alert.msg}</span>
           </div>
        </div>
      )}

      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.tabs.settings}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Systemkonfiguration & Master-Daten</p>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl w-fit">
        {sections.map((s) => (
          <button key={s.id} onClick={() => { setActiveSection(s.id); setInvalidFields(new Set()); }} className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all ${activeSection === s.id ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{s.icon} <span>{s.label}</span></button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 min-h-[600px] flex flex-col">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{sections.find(s => s.id === activeSection)?.label}</h2>
            {activeSection !== 'legal' && (
              <div className="flex items-center space-x-4">
                  <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                      <input 
                        type="text" 
                        placeholder="Suchen..." 
                        value={searchTerms[activeSection]} 
                        onChange={e => setSearchTerms({...searchTerms, [activeSection]: e.target.value})}
                        className="pl-8 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs font-bold outline-none w-48 focus:w-64 transition-all"
                      />
                  </div>
                  <button onClick={() => {
                    setInvalidFields(new Set());
                    if (activeSection === 'holidays') setEditingHoliday({ name: '', startDate: getTodayStr(), endDate: getTodayStr() });
                    if (activeSection === 'cookingMethods') setEditingCooking({ name: '', checkpoints: [{ name: 'Kern', minTemp: '72', maxTemp: '95' }] });
                    if (activeSection === 'fridgeTypes') setEditingFridge({ name: '', checkpoints: [{ name: 'Luft', minTemp: '2', maxTemp: '7' }] });
                    if (activeSection === 'facilityTypes') setEditingFacilityType({ name: '' });
                    if (activeSection === 'excludedFacilities') {
                      setEditingExcluded({ name: '', facilityIds: [], reason: '', startDate: getTodayStr(), endDate: getTodayStr() });
                      setModalFacilitySearch('');
                    }
                  }} className="bg-blue-600 text-white px-8 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">+ {t.settings.add}</button>
              </div>
            )}
            {activeSection === 'legal' && (
              <button 
                onClick={saveLegalTexts}
                className="bg-slate-900 text-white px-8 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all"
              >
                Änderungen Speichern
              </button>
            )}
        </div>

        <div className="p-8 flex-1">
            {activeSection === 'holidays' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Feiertag</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Zeitraum</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredHolidays.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4"><span className="font-bold text-slate-900 dark:text-slate-100">{h.name}</span></td>
                        <td className="px-6 py-4 text-center">
                           <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                             {formatDateForDisplay(h.startDate)} bis {formatDateForDisplay(h.endDate)}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setEditingHoliday(h)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">✏️</button>
                          <button onClick={() => setPendingDelete({ item: h, type: 'holidays' })} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(activeSection === 'cookingMethods' || activeSection === 'fridgeTypes') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(activeSection === 'cookingMethods' ? filteredCooking : filteredFridges).map((item: any) => (
                  <div key={item.id} className="p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm group hover:shadow-xl transition-all">
                    <div className="flex justify-between items-start mb-6">
                       <div>
                         <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{item.name}</h3>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.checkpoints.length} Prüfpunkte definiert</p>
                       </div>
                       <div className="flex space-x-1">
                          <button onClick={() => activeSection === 'cookingMethods' ? setEditingCooking(item) : setEditingFridge(item)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600">✏️</button>
                          <button onClick={() => setPendingDelete({ item, type: activeSection })} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-rose-600">🗑️</button>
                       </div>
                    </div>
                    <div className="space-y-2">
                       {item.checkpoints.map((cp: any, idx: number) => (
                         <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                            <span className="text-xs font-black text-slate-500 uppercase">{cp.name}</span>
                            <span className="text-xs font-black text-blue-600 font-mono italic">{cp.minTemp}° / {cp.maxTemp}°</span>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'facilityTypes' && (
              <div className="max-w-2xl mx-auto space-y-4">
                {filteredFacilityTypesList.map(ft => (
                  <div key={ft.id} className="flex justify-between items-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 hover:border-blue-200 transition-colors">
                     <span className="font-black text-slate-800 dark:text-white uppercase tracking-tight">{ft.name}</span>
                     <div className="flex space-x-2">
                       <button onClick={() => setEditingFacilityType(ft)} className="text-blue-600 font-bold px-4 py-2 hover:bg-blue-50 rounded-xl text-xs uppercase tracking-widest">Bearbeiten</button>
                       <button onClick={() => setPendingDelete({ item: ft, type: 'facilityTypes' })} className="text-rose-500 font-bold px-4 py-2 hover:bg-rose-50 rounded-xl text-xs uppercase tracking-widest">Löschen</button>
                     </div>
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'excludedFacilities' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredExcluded.map(ex => (
                    <div key={ex.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-[3rem] border border-slate-100 dark:border-slate-800 p-8 flex flex-col justify-between">
                       <div className="mb-6">
                         <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-xl shadow-sm">🚫</div>
                            <div className="flex space-x-1">
                               <button onClick={() => { setEditingExcluded(ex); setModalFacilitySearch(''); }} className="p-2 text-blue-600">✏️</button>
                               <button onClick={() => setPendingDelete({ item: ex, type: 'excludedFacilities' })} className="p-2 text-rose-500">🗑️</button>
                            </div>
                         </div>
                         <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">{ex.name}</h3>
                         <p className="text-xs text-slate-500 font-medium italic mb-4">{ex.reason}</p>
                         <div className="flex flex-wrap gap-1">
                            {ex.facilityIds.map(fid => (
                               <span key={fid} className="px-2 py-1 bg-white dark:bg-slate-900 border text-[9px] font-black text-blue-600 uppercase rounded-lg">
                                  {facilities.find(f => f.id === fid)?.name || fid}
                               </span>
                            ))}
                         </div>
                       </div>
                       <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {formatDateForDisplay(ex.startDate)} - {formatDateForDisplay(ex.endDate)}
                          </span>
                       </div>
                    </div>
                 ))}
               </div>
            )}

            {activeSection === 'legal' && (
              <div className="space-y-12 animate-in slide-in-from-bottom-4">
                 <div className="space-y-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Impressum (Inhalt)</label>
                    <textarea 
                      value={legalTexts.imprint}
                      onChange={e => setLegalTexts({...legalTexts, imprint: e.target.value})}
                      className="w-full h-48 p-8 rounded-[2rem] bg-slate-50 border border-slate-200 font-medium text-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all custom-scrollbar"
                      placeholder="Geben Sie hier die Firmendaten ein..."
                    />
                 </div>
                 <div className="space-y-4">
                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Datenschutzerklärung (DSGVO / German GDPR)</label>
                    <textarea 
                      value={legalTexts.privacy}
                      onChange={e => setLegalTexts({...legalTexts, privacy: e.target.value})}
                      className="w-full h-64 p-8 rounded-[2rem] bg-slate-50 border border-slate-200 font-medium text-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all custom-scrollbar"
                      placeholder="Geben Sie hier die Datenschutzerklärung ein..."
                    />
                 </div>
              </div>
            )}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-200 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Wirklich löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">"{pendingDelete.item.name}" wird permanent aus den Einstellungen entfernt.</p>
            <div className="flex flex-col space-y-3">
              <button onClick={executeDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-500/20 transition-all">JA, LÖSCHEN</button>
              <button onClick={() => setPendingDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {(editingHoliday || editingCooking || editingFridge || editingFacilityType || editingExcluded) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden border border-white/10 text-left flex flex-col relative">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Einstellung bearbeiten</h3>
                <button onClick={() => {
                   setEditingHoliday(null); setEditingCooking(null); setEditingFridge(null);
                   setEditingFacilityType(null); setEditingExcluded(null);
                   setInvalidFields(new Set());
                }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 custom-scrollbar max-h-[70vh]">
                {editingHoliday && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Name des Feiertags</label>
                      <input 
                        type="text" 
                        value={editingHoliday.name} 
                        onChange={e => {
                          setEditingHoliday({...editingHoliday, name: e.target.value});
                          if (invalidFields.has('name')) {
                              const n = new Set(invalidFields);
                              n.delete('name');
                              setInvalidFields(n);
                          }
                        }} 
                        className={getFieldClass('name')} 
                        placeholder="z.B. Tag der Arbeit"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <GermanCalendarPicker label="Beginn" value={editingHoliday.startDate!} onChange={v => setEditingHoliday({...editingHoliday, startDate: v})} />
                       <GermanCalendarPicker label="Ende" value={editingHoliday.endDate!} onChange={v => setEditingHoliday({...editingHoliday, endDate: v})} />
                    </div>
                  </div>
                )}

                {(editingCooking || editingFridge) && (
                  <div className="space-y-8">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Bezeichnung</label>
                      <input 
                        type="text" 
                        value={(editingCooking || editingFridge)!.name} 
                        onChange={e => {
                            const setter = editingCooking ? setEditingCooking : setEditingFridge;
                            const cur = (editingCooking || editingFridge)!;
                            setter({...cur, name: e.target.value});
                            if (invalidFields.has('name')) {
                                const n = new Set(invalidFields);
                                n.delete('name');
                                setInvalidFields(n);
                            }
                        }} 
                        className={getFieldClass('name')} 
                        placeholder="z.B. Warmausgabe oder Tiefkühl"
                      />
                    </div>
                    <div className="space-y-6">
                         <div className="flex justify-between items-center px-1">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Prüfpunkte & Grenzwerte</h4>
                            <button onClick={() => {
                               const setter = editingCooking ? setEditingCooking : setEditingFridge;
                               const cur = (editingCooking || editingFridge)!;
                               setter({...cur, checkpoints: [...(cur.checkpoints || []), { name: '', minTemp: '0', maxTemp: '10' }]});
                            }} className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Prüfpunkt hinzufügen</button>
                         </div>
                         {(editingCooking || editingFridge)!.checkpoints?.map((cp: any, idx: number) => (
                           <div key={idx} className="p-6 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-4">
                              <div className="flex justify-between items-center">
                                 <span className="text-[9px] font-black text-slate-400 uppercase">Nr. {idx + 1}</span>
                                 <button onClick={() => {
                                    const setter = editingCooking ? setEditingCooking : setEditingFridge;
                                    const cur = (editingCooking || editingFridge)!;
                                    setter({...cur, checkpoints: cur.checkpoints!.filter((_, i) => i !== idx)});
                                 }} className="text-rose-500 text-xs">Entfernen</button>
                              </div>
                              <input 
                                type="text" 
                                placeholder="Punkt-Bezeichnung (z.B. Kern)" 
                                value={cp.name} 
                                onChange={e => handleCheckpointChange(idx, 'name', e.target.value, editingCooking ? setEditingCooking : setEditingFridge, (editingCooking || editingFridge)!)} 
                                className={getFieldClass(`cp-${idx}-name`, "w-full bg-white dark:bg-slate-900 p-4 rounded-xl font-black text-sm uppercase outline-none shadow-sm")} 
                              />
                              <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase px-1">Min. °C</label>
                                    <input type="text" value={cp.minTemp} onChange={e => handleCheckpointChange(idx, 'minTemp', e.target.value, editingCooking ? setEditingCooking : setEditingFridge, (editingCooking || editingFridge)!)} className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl font-bold text-center outline-none shadow-sm border border-slate-100 dark:border-slate-800" />
                                 </div>
                                 <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase px-1">Max. °C</label>
                                    <input type="text" value={cp.maxTemp} onChange={e => handleCheckpointChange(idx, 'maxTemp', e.target.value, editingCooking ? setEditingCooking : setEditingFridge, (editingCooking || editingFridge)!)} className="w-full bg-white dark:bg-slate-900 p-4 rounded-xl font-bold text-center outline-none shadow-sm border border-slate-100 dark:border-slate-800" />
                                 </div>
                              </div>
                           </div>
                         ))}
                    </div>
                  </div>
                )}

                {editingFacilityType && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Typ-Bezeichnung</label>
                    <input 
                      type="text" 
                      value={editingFacilityType.name} 
                      onChange={e => {
                        setEditingFacilityType({...editingFacilityType, name: e.target.value});
                        if (invalidFields.has('name')) {
                          const n = new Set(invalidFields);
                          n.delete('name');
                          setInvalidFields(n);
                        }
                      }}
                      className={getFieldClass('name')}
                      placeholder="z.B. Seniorenheim"
                    />
                  </div>
                )}

                {editingExcluded && (
                   <div className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Bezeichnung</label>
                        <input 
                          type="text" 
                          value={editingExcluded.name} 
                          onChange={e => {
                            setEditingExcluded({...editingExcluded, name: e.target.value});
                            if (invalidFields.has('name')) {
                              const n = new Set(invalidFields);
                              n.delete('name');
                              setInvalidFields(n);
                            }
                          }}
                          className={getFieldClass('name')}
                          placeholder="z.B. Sommerpause 2025"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Grund / Beschreibung</label>
                        <input type="text" value={editingExcluded.reason} onChange={e => setEditingExcluded({...editingExcluded, reason: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none" placeholder="z.B. Betriebsferien" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <GermanCalendarPicker label="Beginn" value={editingExcluded.startDate!} onChange={v => setEditingExcluded({...editingExcluded, startDate: v})} />
                        <GermanCalendarPicker label="Ende" value={editingExcluded.endDate!} onChange={v => setEditingExcluded({...editingExcluded, endDate: v})} />
                      </div>
                      
                      <div className="space-y-2 relative" ref={facilityDropdownRef}>
                         <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Gilt für Standorte</label>
                         <div className="flex flex-wrap gap-2 mb-3">
                            {editingExcluded.facilityIds?.map(fid => (
                               <button key={fid} onClick={() => setEditingExcluded({...editingExcluded, facilityIds: editingExcluded.facilityIds?.filter(id => id !== fid)})} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center space-x-2">
                                  <span>{facilities.find(f => f.id === fid)?.name || fid}</span>
                                  <span>✕</span>
                               </button>
                            ))}
                         </div>
                         <div className="relative">
                            <input 
                              type="text" 
                              value={modalFacilitySearch} 
                              onChange={e => { setModalFacilitySearch(e.target.value); setIsFacilityDropdownOpen(true); }}
                              onFocus={() => setIsFacilityDropdownOpen(true)}
                              className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none text-sm"
                              placeholder="Standort suchen & hinzufügen..."
                            />
                            {isFacilityDropdownOpen && (
                              <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-[60] max-h-48 overflow-y-auto custom-scrollbar">
                                {modalFilteredFacilities.filter(f => !editingExcluded.facilityIds?.includes(f.id)).map(f => (
                                  <button key={f.id} onClick={() => { setEditingExcluded({...editingExcluded, facilityIds: [...(editingExcluded.facilityIds || []), f.id]}); setIsFacilityDropdownOpen(false); setModalFacilitySearch(''); }} className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs uppercase border-b last:border-0 border-slate-50 dark:border-slate-800">{f.name}</button>
                                ))}
                              </div>
                            )}
                         </div>
                      </div>
                   </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 bg-slate-50/50 dark:bg-slate-800/50">
                 <button onClick={() => {
                   setEditingHoliday(null); setEditingCooking(null); setEditingFridge(null);
                   setEditingFacilityType(null); setEditingExcluded(null);
                   setInvalidFields(new Set());
                 }} className="px-6 py-3 text-slate-500 font-black uppercase text-[10px] tracking-widest">Abbrechen</button>
                 <button onClick={handleGlobalSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-transform uppercase tracking-widest text-[10px]">Speichern</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
