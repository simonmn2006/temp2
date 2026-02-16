
import React, { useState, useMemo } from 'react';
import { TranslationSet, Menu } from '../types';

interface MenusPageProps {
  t: TranslationSet;
  menus: Menu[];
  setMenus: React.Dispatch<React.SetStateAction<Menu[]>>;
}

export const MenusPage: React.FC<MenusPageProps> = ({ t, menus, setMenus }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [menuName, setMenuName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);

  const showAlert = (text: string, type: 'error' | 'success' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const filteredMenus = useMemo(() => {
    return menus.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [menus, searchTerm]);

  const openModal = (menu?: Menu) => {
    setAlertMsg(null);
    setInvalidFields(new Set());
    if (menu) {
      setEditingMenu(menu);
      setMenuName(menu.name);
    } else {
      setEditingMenu(null);
      setMenuName('');
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const trimmedName = menuName.trim();
    if (!trimmedName) {
      setInvalidFields(new Set(['menuName']));
      showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", 'error');
      return;
    }

    const normalizedNewName = trimmedName.toLowerCase();
    const isDuplicate = menus.some(m => {
      if (editingMenu && m.id === editingMenu.id) return false;
      return m.name.toLowerCase() === normalizedNewName;
    });

    if (isDuplicate) {
      setInvalidFields(new Set(['menuName']));
      showAlert(`Ein Menü mit dem Namen "${trimmedName}" existiert bereits.`, 'error');
      return;
    }

    setInvalidFields(new Set());

    if (editingMenu) {
      setMenus(prev => prev.map(m => m.id === editingMenu.id ? { ...m, name: trimmedName } : m));
      showAlert(`Menü "${trimmedName}" aktualisiert.`, 'success');
    } else {
      const newMenu: Menu = { id: `MNU-${Date.now().toString().substr(-5)}`, name: trimmedName };
      setMenus(prev => [...prev, newMenu]);
      showAlert(`Menü "${trimmedName}" angelegt.`, 'success');
    }
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (menuToDelete) {
      const name = menuToDelete.name;
      setMenus(prev => prev.filter(m => m.id !== menuToDelete.id));
      showAlert(`Menü "${name}" wurde gelöscht.`, 'success');
      setMenuToDelete(null);
    }
  };

  const handleNameChange = (val: string) => {
    setMenuName(val);
    if (invalidFields.has('menuName')) {
      const n = new Set(invalidFields);
      n.delete('menuName');
      setInvalidFields(n);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 border border-white/20`}>
             <span className="text-xl">{alertMsg.type === 'success' ? '✅' : '⚠️'}</span>
             <span className="font-black text-sm uppercase tracking-tight">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.tabs.menus}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Verwaltung der Speisepläne und Menüs</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl">+ Neues Menü</button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input 
          type="text" 
          placeholder="Menüs suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 font-bold transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredMenus.map((menu) => (
          <div key={menu.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 hover:shadow-2xl transition-all group relative">
            <div className="absolute top-0 right-0 p-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openModal(menu)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:scale-110 transition-transform">✏️</button>
                <button onClick={() => setMenuToDelete(menu)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:scale-110 transition-transform">🗑️</button>
            </div>
            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl mb-6 shadow-inner">🍽️</div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 truncate pr-12">{menu.name}</h3>
          </div>
        ))}
        {filteredMenus.length === 0 && (
          <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm uppercase italic">Keine Menüs gefunden</div>
        )}
      </div>

      {menuToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Menü löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">"{menuToDelete.name}" wird permanent aus der Liste entfernt.</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-500/20 transition-all">JA, LÖSCHEN</button>
              <button onClick={() => setMenuToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl border border-white/20 dark:border-slate-800 text-left relative">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{editingMenu ? 'Menü bearbeiten' : 'Neues Menü'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">✕</button>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Menü Name</label>
              <input 
                type="text" 
                autoFocus 
                value={menuName} 
                onChange={e => handleNameChange(e.target.value)} 
                className={`w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold transition-all outline-none ${invalidFields.has('menuName') ? 'border-rose-500 ring-4 ring-rose-500/10 animate-shake' : 'border-slate-200 dark:border-slate-700'}`} 
                placeholder="z.B. Mittagessen Plan A" 
              />
            </div>
            <div className="mt-10 flex justify-end space-x-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold">Abbrechen</button>
              <button onClick={handleSave} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
