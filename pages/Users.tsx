
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TranslationSet, User, Facility, AuditLog } from '../types';

interface UsersPageProps {
  t: TranslationSet;
  currentUser: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  facilities: Facility[];
  onLog: (action: AuditLog['action'], entity: string, details: string) => void;
  onSync: (user: User) => void;
}

export const UsersPage: React.FC<UsersPageProps> = ({ t, currentUser, users, setUsers, facilities, onLog, onSync }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'User',
    status: 'Active',
    facilityId: ''
  });

  const [facilitySearch, setFacilitySearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.username.toLowerCase().includes(searchTerm.toLowerCase());
      if (currentUser.role === 'Manager') return matchesSearch && u.role === 'User';
      return matchesSearch;
    });
  }, [users, searchTerm, currentUser.role]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase()));
  }, [facilities, facilitySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showAlert = (text: string, type: 'error' | 'success' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const isFieldDisabled = (fieldName: string) => {
    if (currentUser.role === 'SuperAdmin') return false;
    if (currentUser.role === 'Admin') return false; 
    if (currentUser.role === 'Manager') return !['name', 'password'].includes(fieldName);
    return true;
  };

  const openModal = (user?: User) => {
    setAlertMsg(null);
    setInvalidFields(new Set());
    if (user) {
      setEditingUser(user);
      setFormData({ ...user, password: '' }); 
      setFacilitySearch(facilities.find(f => f.id === user.facilityId)?.name || '');
    } else {
      setEditingUser(null);
      setFormData({
        name: '', username: '', email: '', password: '', role: 'User', status: 'Active',
        facilityId: currentUser.role === 'Manager' ? currentUser.facilityId : ''
      });
      setFacilitySearch(currentUser.role === 'Manager' ? (facilities.find(f => f.id === currentUser.facilityId)?.name || '') : '');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const errors = new Set<string>();
    const trimmedName = formData.name?.trim() || '';
    const trimmedUsername = formData.username?.trim() || '';
    
    if (!trimmedName) errors.add('name');
    if (!trimmedUsername) errors.add('username');
    if (!editingUser && !formData.password?.trim()) errors.add('password');

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte Pflichtfelder ausfüllen.", 'error');
      return;
    }

    const isUsernameDuplicate = users.some(u => (editingUser ? u.id !== editingUser.id : true) && u.username.toLowerCase() === trimmedUsername.toLowerCase());
    if (isUsernameDuplicate) {
      errors.add('username');
      setInvalidFields(errors);
      showAlert(`Benutzername "${trimmedUsername}" vergeben.`, 'error');
      return;
    }

    let finalUser: User;
    if (editingUser) {
      finalUser = { 
        ...editingUser, 
        ...formData, 
        name: trimmedName, 
        username: trimmedUsername,
        password: formData.password ? formData.password : editingUser.password,
        email: formData.role === 'User' ? '' : formData.email
      } as User;
      setUsers(prev => prev.map(u => u.id === editingUser.id ? finalUser : u));
    } else {
      finalUser = {
        id: `U-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        ...formData,
        name: trimmedName, 
        username: trimmedUsername,
        email: formData.role === 'User' ? '' : formData.email
      } as User;
      setUsers(prev => [...prev, finalUser]);
    }
    
    onSync(finalUser);
    onLog(editingUser ? 'UPDATE' : 'CREATE', 'USERS', `Nutzer ${trimmedName} ${editingUser ? 'aktualisiert' : 'erstellt'}`);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3`}>
             <span className="text-xl">{alertMsg.type === 'success' ? '✅' : '⚠️'}</span>
             <span className="font-black text-xs uppercase">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{t.tabs.users}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Benutzer- & Rollenverwaltung</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl uppercase text-xs">+ Nutzer hinzufügen</button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none font-bold text-sm h-[52px]" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nutzer</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Rolle / Status</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-8 py-6">
                  <span className="font-bold text-slate-900 dark:text-white block">{user.name}</span>
                  <span className="text-[11px] font-black text-blue-600 uppercase tracking-tight">@{user.username}</span>
                </td>
                <td className="px-8 py-6">
                  <span className={`px-2 py-1 rounded text-[10px] font-black uppercase mr-2 ${user.role === 'SuperAdmin' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>{user.role}</span>
                  <span className={`text-[10px] font-bold ${user.status === 'Active' ? 'text-emerald-500' : 'text-slate-400'}`}>{user.status}</span>
                </td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => openModal(user)} className="p-2 text-blue-600">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[2.5rem] p-10 shadow-2xl flex flex-col relative text-left">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase mb-8">{editingUser ? 'Nutzer bearbeiten' : 'Neuer Nutzer'}</h3>
            
            <div className="space-y-5 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Anzeigename</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Username</label>
                   <input type="text" disabled={isFieldDisabled('username')} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none disabled:opacity-50" />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Passwort</label>
                   <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="••••••••" />
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Rolle</label>
                   <select disabled={isFieldDisabled('role')} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none">
                     <option value="User">User</option>
                     <option value="Manager">Manager</option>
                     <option value="Admin">Admin</option>
                     {currentUser.role === 'SuperAdmin' && <option value="SuperAdmin">SuperAdmin</option>}
                   </select>
                </div>
                {formData.role !== 'User' ? (
                   <div className="animate-in slide-in-from-left-2 duration-300">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">E-Mail (Alarme)</label>
                      <input type="email" disabled={isFieldDisabled('email')} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none" placeholder="beispiel@domain.de" />
                   </div>
                ) : (
                  <div className="flex items-end pb-4">
                    <p className="text-[10px] font-bold text-slate-400 italic px-1">Rolle 'User' erhält keine E-Mail Alarme.</p>
                  </div>
                )}
              </div>

              <div className="relative" ref={dropdownRef}>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 px-1">Standort suchen & wählen</label>
                <div className="relative">
                  <input 
                    type="text" 
                    disabled={isFieldDisabled('facilityId')}
                    value={facilitySearch}
                    onChange={(e) => {
                      setFacilitySearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder="Standort suchen..."
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm outline-none disabled:opacity-50"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▼</span>
                </div>
                {isDropdownOpen && !isFieldDisabled('facilityId') && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    <button 
                      onClick={() => { setFormData({...formData, facilityId: ''}); setFacilitySearch('Kein Standort'); setIsDropdownOpen(false); }}
                      className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm border-b dark:border-slate-800 text-slate-400"
                    >
                      Kein Standort
                    </button>
                    {filteredFacilities.map(f => (
                      <button 
                        key={f.id} 
                        onClick={() => { setFormData({...formData, facilityId: f.id}); setFacilitySearch(f.name); setIsDropdownOpen(false); }} 
                        className={`w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm border-b dark:border-slate-800 last:border-0 ${formData.facilityId === f.id ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        {f.name}
                      </button>
                    ))}
                    {filteredFacilities.length === 0 && (
                      <div className="px-5 py-3 text-slate-400 text-xs italic">Kein Standort gefunden</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-10 flex justify-end space-x-4">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl uppercase text-xs tracking-widest">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
