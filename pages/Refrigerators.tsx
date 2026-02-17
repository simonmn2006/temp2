
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, Refrigerator, Facility, RefrigeratorType, User, Assignment, AuditLog, Alert } from '../types';

const getHostname = () => {
  const host = window.location.hostname;
  return (host && host !== '' && host !== '0.0.0.0') ? host : 'localhost';
};
const API_BASE = `http://${getHostname()}:3001/api`;

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
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFridge, setEditingFridge] = useState<Refrigerator | null>(null);
  const [fridgeToDelete, setFridgeToDelete] = useState<Refrigerator | null>(null);
  
  const [modalFacilityId, setModalFacilityId] = useState<string>('');
  const [modalFacilitySearch, setModalFacilitySearch] = useState('');
  const [isModalDropdownOpen, setIsModalDropdownOpen] = useState(false);
  const modalDropdownRef = useRef<HTMLDivElement>(null);

  const [newFridgesForm, setNewFridgesForm] = useState<{ id: string; name: string; typeId: string }[]>([
    { id: Math.random().toString(), name: '', typeId: '' }
  ]);

  const filteredFacilities = useMemo(() => facilities.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())), [facilities, searchTerm]);
  const currentFridges = useMemo(() => fridges.filter(r => r.facilityId === selectedFacilityId), [fridges, selectedFacilityId]);
  const selectedFacility = useMemo(() => facilities.find(f => f.id === selectedFacilityId), [facilities, selectedFacilityId]);
  const associatedUsers = useMemo(() => !selectedFacilityId ? [] : users.filter(u => u.facilityId === selectedFacilityId), [users, selectedFacilityId]);

  const sync = async (item: any, del = false) => {
    const url = del ? `${API_BASE}/refrigerators/${item.id}` : `${API_BASE}/refrigerators`;
    await fetch(url, { method: del ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: del ? null : JSON.stringify(item) });
  };

  const handleSave = async () => {
    if (!modalFacilityId) return;
    if (editingFridge) {
      const row = newFridgesForm[0];
      const typeName = fridgeTypes.find(t => t.id === row.typeId)?.name || 'Standard';
      const updated = { ...editingFridge, name: row.name, facilityId: modalFacilityId, typeName };
      setFridges(prev => prev.map(f => f.id === updated.id ? updated : f));
      await sync(updated);
    } else {
      for (const f of newFridgesForm) {
        const item: Refrigerator = { id: `R-${Math.random().toString(36).substr(2,5).toUpperCase()}`, name: f.name, facilityId: modalFacilityId, currentTemp: 4.0, status: 'Optimal', typeName: fridgeTypes.find(t => t.id === f.typeId)?.name };
        setFridges(prev => [...prev, item]);
        await sync(item);
      }
    }
    setIsModalOpen(false);
  };

  const confirmDeleteFridge = async () => {
    if (fridgeToDelete) {
       setFridges(prev => prev.filter(f => f.id !== fridgeToDelete.id));
       await sync(fridgeToDelete, true);
       setFridgeToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h1 className="text-2xl font-bold uppercase">Kühlsysteme</h1><p className="text-sm text-slate-500">Zuweisung von Hardware an Standorte</p></div>
        <button onClick={() => { setEditingFridge(null); setNewFridgesForm([{id: '1', name: '', typeId: ''}]); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black">+ Geräte anlegen</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <input type="text" placeholder="Standort..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full px-4 py-3 bg-white border rounded-2xl outline-none" />
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredFacilities.map(f => (
              <button key={f.id} onClick={() => setSelectedFacilityId(f.id)} className={`w-full text-left p-4 rounded-2xl border transition-all ${selectedFacilityId === f.id ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                <p className="font-black text-sm uppercase">{f.name}</p>
                <p className="text-[10px] opacity-60">ID: {f.id}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedFacility ? (
            <div className="space-y-8">
               <div className="bg-white p-10 rounded-[2.5rem] border">
                  <h2 className="text-2xl font-black uppercase mb-8">{selectedFacility.name}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentFridges.map(fridge => (
                      <div key={fridge.id} className="p-6 bg-slate-50 border rounded-[2rem] flex justify-between items-center group">
                        <div>
                          <p className="font-black text-lg">{fridge.name}</p>
                          <p className="text-[10px] uppercase font-bold text-blue-600">{fridge.typeName}</p>
                        </div>
                        <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingFridge(fridge); setNewFridgesForm([{id: fridge.id, name: fridge.name, typeId: fridgeTypes.find(t=>t.name===fridge.typeName)?.id || ''}]); setIsModalOpen(true); }} className="p-2 bg-white rounded-lg text-blue-600">✏️</button>
                          <button onClick={() => setFridgeToDelete(fridge)} className="p-2 bg-white rounded-lg text-rose-600">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          ) : <div className="p-20 text-center text-slate-400 font-bold bg-white rounded-[2.5rem] border border-dashed">Standort links wählen</div>}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white w-full max-w-xl p-10 rounded-[3rem] shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-8">{editingFridge ? 'Bearbeiten' : 'Hinzufügen'}</h3>
              <div className="space-y-4">
                <select value={modalFacilityId} onChange={e => setModalFacilityId(e.target.value)} className="w-full p-4 border rounded-2xl font-bold">
                  <option value="">Standort wählen...</option>
                  {facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {newFridgesForm.map((row, idx) => (
                  <div key={row.id} className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="Name" value={row.name} onChange={e => { const n = [...newFridgesForm]; n[idx].name = e.target.value; setNewFridgesForm(n); }} className="p-4 border rounded-2xl" />
                    <select value={row.typeId} onChange={e => { const n = [...newFridgesForm]; n[idx].typeId = e.target.value; setNewFridgesForm(n); }} className="p-4 border rounded-2xl">
                      <option value="">Typ...</option>
                      {fridgeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-10 flex justify-end space-x-4">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-400">Abbrechen</button>
                <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase">Speichern</button>
              </div>
           </div>
        </div>
      )}

      {fridgeToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 flex items-center justify-center p-4 z-[200]">
           <div className="bg-white p-10 rounded-[2.5rem] text-center max-w-sm">
              <h3 className="text-xl font-black mb-4 uppercase">Löschen?</h3>
              <p className="mb-8 font-bold text-slate-500">"{fridgeToDelete.name}" wirklich entfernen?</p>
              <div className="flex flex-col space-y-2">
                 <button onClick={confirmDeleteFridge} className="bg-rose-600 text-white py-4 rounded-2xl font-black">JA, LÖSCHEN</button>
                 <button onClick={() => setFridgeToDelete(null)} className="bg-slate-100 py-4 rounded-2xl font-black">Abbrechen</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
