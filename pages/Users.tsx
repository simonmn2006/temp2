
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
  
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
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

  // Managers only see 'User' role accounts. Admins/SuperAdmins see everyone.
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.username.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (currentUser.role === 'Manager') {
        return matchesSearch && u.role === 'User';
      }
      
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

  // Permission Logic
  const canEditUser = (target: User) => {
    if (currentUser.role === 'SuperAdmin') return true;
    if (currentUser.role === 'Admin') {
      // Admins cannot edit SuperAdmins
      return target.role !== 'SuperAdmin';
    }
    if (currentUser.role === 'Manager') {
      // Managers can only edit 'User' roles
      return target.role === 'User';
    }
    return false;
  };

  const isFieldDisabled = (fieldName: string) => {
    if (currentUser.role === 'SuperAdmin') return false;
    if (currentUser.role === 'Admin') {
        // Admins can change everything for Managers/Users except role 'SuperAdmin'
        return false; 
    }
    if (currentUser.role === 'Manager') {
        // Managers can ONLY change Name and Password
        return !['name', 'password'].includes(fieldName);
    }
    return true;
  };

  const openModal = (user?: User) => {
    if (user && !canEditUser(user)) {
      showAlert("Keine Berechtigung diesen Nutzer zu bearbeiten.", "error");
      return;
    }

    setAlertMsg(null);
    setInvalidFields(new Set());
    if (user) {
      setEditingUser(user);
      setFormData({ ...user, password: '' }); 
      setFacilitySearch(facilities.find(f => f.id === user.facilityId)?.name || '');
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'User', // Managers create Users by default
        status: 'Active',
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
    const trimmedEmail = formData.email?.trim() || '';
    const trimmedPassword = formData.password?.trim() || '';

    if (!trimmedName) errors.add('name');
    if (!trimmedUsername) errors.add('username');
    
    // Email is required for Admin/Manager roles
    if ((formData.role === 'Admin' || formData.role === 'Manager' || formData.role === 'SuperAdmin') && !trimmedEmail) {
        errors.add('email');
    }
    
    if (!editingUser && !trimmedPassword) errors.add('password');

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", 'error');
      return;
    }

    const normalizedNewUsername = trimmedUsername.toLowerCase();
    const isUsernameDuplicate = users.some(u => {
      if (editingUser && u.id === editingUser.id) return false;
      return u.username.toLowerCase() === normalizedNewUsername;
    });

    if (isUsernameDuplicate) {
      errors.add('username');
      setInvalidFields(errors);
      showAlert(`Der Benutzername "${trimmedUsername}" ist bereits vergeben.`, 'error');
      return;
    }

    setInvalidFields(new Set());

    let finalUser: User;

    if (editingUser) {
      finalUser = { 
        ...editingUser, 
        ...formData, 
        name: trimmedName, 
        username: trimmedUsername,
        email: (formData.role === 'Admin' || formData.role === 'Manager' || formData.role === 'SuperAdmin') ? trimmedEmail : undefined,
        ...(trimmedPassword ? { password: trimmedPassword } : {})
      } as User;
      
      setUsers(prev => prev.map(u => u.id === editingUser.id ? finalUser : u));
      onLog('UPDATE', 'USERS', `Benutzer '${trimmedName}' aktualisiert`);
      showAlert(`Benutzer "${trimmedName}" aktualisiert.`, 'success');
    } else {
      finalUser = {
        id: `U-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        name: trimmedName,
        username: trimmedUsername,
        email: (formData.role === 'Admin' || formData.role === 'Manager' || formData.role === 'SuperAdmin') ? trimmedEmail : undefined,
        password: trimmedPassword,
        role: formData.role as any,
        status: formData.status as any,
        facilityId: formData.facilityId
      };
      setUsers(prev => [...prev, finalUser]);
      onLog('CREATE', 'USERS', `Neuen Benutzer '${trimmedName}' erstellt`);
      showAlert(`Benutzer "${trimmedName}" erstellt.`, 'success');
    }
    
    // SYNC TO BACKEND
    onSync(finalUser);
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (userToDelete) {
      if (userToDelete.role === 'SuperAdmin') {
        showAlert("SuperAdmin Konten können nicht gelöscht werden.", "error");
        setUserToDelete(null);
        return;
      }
      const name = userToDelete.name;
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      onLog('DELETE', 'USERS', `Benutzer '${name}' gelöscht`);
      showAlert(`Benutzer "${name}" wurde gelöscht.`, 'success');
      setUserToDelete(null);
    }
  };

  const getFieldClass = (fieldName: string) => {
    const base = "w-full px-5 py-4 rounded-[1.25rem] bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none transition-all";
    if (invalidFields.has(fieldName)) {
        return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    const disabled = isFieldDisabled(fieldName);
    return `${base} ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10'}`;
  };

  const handleFieldChange = (field: keyof User, val: string) => {
    if (isFieldDisabled(field as string)) return;
    setFormData({...formData, [field]: val});
    if (invalidFields.has(field as string)) {
      const next = new Set(invalidFields);
      next.delete(field as string);
      setInvalidFields(next);
    }
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
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{t.tabs.users}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            {currentUser.role === 'Manager' ? 'Mitarbeiter-Verwaltung' : 'Systemweite Benutzerverwaltung & Rollen'}
          </p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] uppercase text-xs tracking-widest"
        >
          + Nutzer hinzufügen
        </button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
        <input 
          type="text" 
          placeholder="Suchen nach Name oder Username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 font-bold transition-all shadow-sm text-sm h-[52px]"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Name</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Username / Email</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Rolle</th>
              <th className="px-8 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredUsers.length > 0 ? filteredUsers.map((user) => {
              return (
                <tr key={user.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-8 py-6">
                    <span className="font-bold text-base text-slate-900 dark:text-white leading-tight block">{user.name}</span>
                    {user.facilityId && <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight mt-1 inline-block">📍 {facilities.find(f => f.id === user.facilityId)?.name}</span>}
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.1em] block mb-1">@{user.username}</span>
                    {user.email && <span className="text-[11px] font-bold text-slate-400 lowercase">{user.email}</span>}
                  </td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                      user.role === 'SuperAdmin' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600' :
                      user.role === 'Admin' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 
                      user.role === 'Manager' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600' : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right space-x-2">
                    <button 
                      onClick={() => openModal(user)} 
                      className={`p-2 rounded-xl transition-all text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                      title="Bearbeiten"
                    >
                      ✏️
                    </button>
                    {currentUser.role !== 'Manager' && (
                      <button 
                        disabled={user.role === 'SuperAdmin'}
                        onClick={() => setUserToDelete(user)} 
                        className={`p-2 rounded-xl transition-all ${user.role === 'SuperAdmin' ? 'opacity-20 cursor-not-allowed' : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
                        title="Löschen"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={4} className="px-8 py-16 text-center text-slate-400 font-black text-sm uppercase tracking-widest">Keine Benutzer</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🚨</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter uppercase">Nutzer löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-bold text-sm">Möchten Sie "{userToDelete.name}" wirklich entfernen?</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase text-xs tracking-widest">JA, LÖSCHEN</button>
              <button onClick={() => setUserToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all uppercase text-xs tracking-widest">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden text-left relative border border-white/10">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {editingUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 hover:scale-110 transition-all font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 pb-28 space-y-6 custom-scrollbar">
              {currentUser.role === 'Manager' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center space-x-4 mb-4">
                   <span className="text-xl">ℹ️</span>
                   <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Sie können als Manager nur den Anzeigenamen und das Passwort für Mitarbeiter anpassen.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Anzeigename</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => handleFieldChange('name', e.target.value)} 
                    className={getFieldClass('name')} 
                    placeholder="Name des Mitarbeiters..." 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Benutzername (ID)</label>
                  <input 
                    type="text" 
                    disabled={isFieldDisabled('username')}
                    value={formData.username} 
                    onChange={e => handleFieldChange('username', e.target.value)} 
                    className={getFieldClass('username')} 
                    placeholder="z.B. nutzer_1" 
                  />
                </div>
              </div>

              {(formData.role === 'Admin' || formData.role === 'Manager' || formData.role === 'SuperAdmin') && (
                <div className="animate-in slide-in-from-top-2">
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">{t.settings.email}</label>
                  <input 
                    type="email" 
                    disabled={isFieldDisabled('email')}
                    value={formData.email} 
                    onChange={e => handleFieldChange('email', e.target.value)} 
                    className={getFieldClass('email')} 
                    placeholder="name@gourmetta.de" 
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative">
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1 flex justify-between">
                    <span>Neues Passwort</span>
                  </label>
                  <input 
                    type="password" 
                    value={formData.password} 
                    onChange={e => handleFieldChange('password', e.target.value)} 
                    className={getFieldClass('password')} 
                    placeholder={editingUser ? "Leer lassen für keine Änderung" : "••••••••"} 
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Rolle</label>
                  <select 
                    disabled={isFieldDisabled('role')}
                    value={formData.role} 
                    onChange={e => {
                        const newRole = e.target.value as any;
                        setFormData({...formData, role: newRole});
                    }} 
                    className={getFieldClass('role')}
                  >
                    <option value="User">User (Nutzer/Operator)</option>
                    <option value="Manager" disabled={currentUser.role === 'Manager'}>Manager</option>
                    <option value="Admin" disabled={currentUser.role === 'Manager'}>Admin</option>
                    {currentUser.role === 'SuperAdmin' && <option value="SuperAdmin">SuperAdmin</option>}
                  </select>
                </div>
              </div>
              
              <div className="relative" ref={dropdownRef}>
                <label className="block text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">Standort Zuweisung</label>
                <div 
                  className={`${isFieldDisabled('facilityId') ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-text'} flex items-center px-5 py-4 rounded-[1.25rem] border font-bold text-sm h-[56px]`} 
                  onClick={() => !isFieldDisabled('facilityId') && setIsDropdownOpen(true)}
                >
                  <input 
                    type="text" 
                    disabled={isFieldDisabled('facilityId')}
                    value={facilitySearch} 
                    onChange={e => {setFacilitySearch(e.target.value); setIsDropdownOpen(true);}} 
                    placeholder="Standort suchen..." 
                    className="flex-1 bg-transparent font-bold text-sm outline-none" 
                  />
                  <span className="text-slate-400 text-xs ml-2">{isDropdownOpen ? '▲' : '▼'}</span>
                </div>
                {isDropdownOpen && !isFieldDisabled('facilityId') && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredFacilities.map(f => (
                      <button key={f.id} onClick={() => { setFormData({...formData, facilityId: f.id}); setFacilitySearch(f.name); setIsDropdownOpen(false); }} className={`w-full text-left px-5 py-3 hover:bg-slate-50 font-bold text-sm border-b last:border-0 border-slate-50 ${formData.facilityId === f.id ? 'text-blue-600 bg-blue-50' : 'text-slate-700'}`}>{f.name}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-[11px] tracking-widest">Abbrechen</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-10 py-3 rounded-[1.25rem] font-black shadow-xl uppercase text-xs tracking-widest hover:scale-105 transition-transform">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
