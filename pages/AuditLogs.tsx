
import React, { useState, useMemo } from 'react';
import { TranslationSet, AuditLog } from '../types';

interface AuditLogsPageProps {
  t: TranslationSet;
  logs: AuditLog[];
}

export const AuditLogsPage: React.FC<AuditLogsPageProps> = ({ t, logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return logs
      .filter(log => {
        const matchesSearch = 
          log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
          log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entity.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;
        
        return matchesSearch && matchesAction;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [logs, searchTerm, actionFilter]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'LOGIN': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'CREATE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'UPDATE': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'DELETE': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 text-left">
      <header>
        <h1 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">System Logs</h1>
        <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 font-medium">Vollständige Historie aller Admin-Aktionen</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-[1.5rem] lg:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input 
            type="text" 
            placeholder="Aktivität suchen..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none h-[48px]"
          />
        </div>
        <div className="w-full md:w-48">
          <select 
            value={actionFilter} 
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none h-[48px]"
          >
            <option value="ALL">Alle Aktionen</option>
            <option value="LOGIN">Logins</option>
            <option value="CREATE">Erstellungen</option>
            <option value="UPDATE">Änderungen</option>
            <option value="DELETE">Löschungen</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] lg:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 lg:px-8 py-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Zeit / Nutzer</th>
                <th className="px-6 lg:px-8 py-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Aktivität</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 lg:px-8 py-4 min-w-[200px]">
                    <span className="text-[10px] font-black text-slate-900 dark:text-white block font-mono">
                      {new Date(log.timestamp).toLocaleDateString('de-DE')} • {new Date(log.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="mt-1">
                      <span className="text-xs font-black text-blue-600 uppercase">{log.userName}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase ml-2 opacity-60">[{log.entity}]</span>
                    </div>
                  </td>
                  <td className="px-6 lg:px-8 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                       <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase border shrink-0 ${getActionBadge(log.action)}`}>
                          {log.action}
                       </span>
                       <p className="text-xs lg:text-sm font-bold text-slate-700 dark:text-slate-300 leading-snug">
                         {log.details}
                       </p>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
