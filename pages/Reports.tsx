
import React, { useState, useMemo } from 'react';
import { TranslationSet, Reading, User, Facility, Refrigerator, Menu, FacilityException, FormResponse, FormTemplate, Assignment } from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

interface ReportsPageProps {
  t: TranslationSet;
  currentUser: User;
  readings: Reading[];
  formResponses: FormResponse[];
  users: User[];
  facilities: Facility[];
  fridges: Refrigerator[];
  menus: Menu[];
  forms: FormTemplate[];
  excludedFacilities: FacilityException[];
  assignments: Assignment[];
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ t, currentUser, readings, formResponses, users, facilities, fridges, menus, forms, excludedFacilities }) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];

  const [dateRange, setDateRange] = useState({ 
    start: getTodayStr(),
    end: getTodayStr()
  });
  
  const [filterType, setFilterType] = useState<'all' | 'refrigerator' | 'menu' | 'forms' | 'supervisor_audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupId, setSelectedSupId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  const isPrivileged = currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  
  const myFacilityIds = useMemo(() => {
    if (isPrivileged) return null;
    return facilities.filter(f => f.supervisorId === currentUser.id).map(f => f.id);
  }, [facilities, currentUser, isPrivileged]);

  const getFacilityDisplayName = (id: string) => {
    const fac = facilities.find(f => f.id === id);
    return fac ? fac.name : `ID: ${id} (Gelöscht)`;
  };

  const supervisorStats = useMemo(() => {
    if (!isPrivileged) return [];
    
    const supData: Record<string, { totalVisits: number, totalResponses: number, facilityBreakdown: Record<string, { yes: number, no: number }> }> = {};

    formResponses.forEach(fr => {
      const date = fr.timestamp.split('T')[0];
      if (date < dateRange.start || date > dateRange.end) return;
      
      const visit = fr.answers['SUPERVISOR_VISIT'];
      if (!visit) return;

      const fac = facilities.find(f => f.id === fr.facilityId);
      const supId = fac?.supervisorId || 'UNASSIGNED';

      if (!supData[supId]) {
        supData[supId] = { totalVisits: 0, totalResponses: 0, facilityBreakdown: {} };
      }

      if (!supData[supId].facilityBreakdown[fr.facilityId]) {
        supData[supId].facilityBreakdown[fr.facilityId] = { yes: 0, no: 0 };
      }

      supData[supId].totalResponses++;
      if (visit === 'YES') {
        supData[supId].totalVisits++;
        supData[supId].facilityBreakdown[fr.facilityId].yes++;
      } else {
        supData[supId].facilityBreakdown[fr.facilityId].no++;
      }
    });

    return Object.entries(supData)
      .map(([id, data]) => ({
        id,
        user: users.find(u => u.id === id),
        total: data.totalVisits,
        totalChecked: data.totalResponses,
        breakdown: data.facilityBreakdown
      }))
      .sort((a, b) => b.total - a.total);
  }, [formResponses, dateRange, facilities, users, isPrivileged]);

  const selectedSupervisorData = useMemo(() => {
    if (!selectedSupId || !isPrivileged) return null;
    return supervisorStats.find(s => s.id === selectedSupId);
  }, [supervisorStats, selectedSupId, isPrivileged]);

  const reportEntries = useMemo(() => {
    const entries: any[] = [];
    const query = searchQuery.toLowerCase();

    if (filterType === 'all' || filterType === 'refrigerator' || filterType === 'menu') {
      let baseReadings = readings.filter(r => {
        const date = r.timestamp.split('T')[0];
        const isInRange = date >= dateRange.start && date <= dateRange.end;
        if (!isInRange) return false;
        if (myFacilityIds && !myFacilityIds.includes(r.facilityId)) return false;
        if (filterType === 'refrigerator' && r.targetType !== 'refrigerator') return false;
        if (filterType === 'menu' && r.targetType !== 'menu') return false;
        
        const facName = getFacilityDisplayName(r.facilityId);
        const usr = users.find(u => u.id === r.userId);
        return !query || facName.toLowerCase().includes(query) || usr?.name.toLowerCase().includes(query);
      });

      const sorted = [...baseReadings].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const bundled: Reading[][] = [];
      sorted.forEach(r => {
        const match = bundled.find(g => 
          g[0].targetId === r.targetId && 
          g[0].userId === r.userId && 
          Math.abs(new Date(r.timestamp).getTime() - new Date(g[0].timestamp).getTime()) < 600000
        );
        if (match) match.push(r); else bundled.push([r]);
      });

      bundled.forEach(items => {
        const first = items[0];
        const dateObj = new Date(first.timestamp);
        const usr = users.find(u => u.id === first.userId);
        entries.push({
          id: `TEMP-${first.id}`,
          rawId: first.id,
          type: 'READING',
          timestamp: first.timestamp,
          displayDate: dateObj.toLocaleDateString('de-DE'),
          displayTime: dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          facility: getFacilityDisplayName(first.facilityId),
          user: usr?.name || 'N/A',
          typeLabel: first.targetType === 'refrigerator' ? 'KÜHLUNG' : 'HACCP',
          objectName: first.targetType === 'refrigerator' ? (fridges.find(f => f.id === first.targetId)?.name || 'Gerät') : (menus.find(m => m.id === first.targetId)?.name || 'Menü'),
          details: items.map(it => `${it.checkpointName}: ${it.value.toFixed(1)}°C`).join(' | '),
          status: items.some(i => i.reason) ? '⚠️ KORREKTUR' : '✅ OK'
        });
      });
    }

    if (filterType === 'all' || filterType === 'forms') {
      formResponses.forEach(fr => {
        const date = fr.timestamp.split('T')[0];
        if (date < dateRange.start || date > dateRange.end) return;
        if (myFacilityIds && !myFacilityIds.includes(fr.facilityId)) return;

        const facName = getFacilityDisplayName(fr.facilityId);
        const usr = users.find(u => u.id === fr.userId);
        if (query && !(facName.toLowerCase().includes(query) || usr?.name.toLowerCase().includes(query))) return;

        const dateObj = new Date(fr.timestamp);
        const template = forms.find(f => f.id === fr.formId);
        entries.push({
          id: fr.id,
          rawId: fr.id,
          type: 'FORM',
          timestamp: fr.timestamp,
          displayDate: dateObj.toLocaleDateString('de-DE'),
          displayTime: dateObj.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
          facility: facName,
          user: usr?.name || 'N/A',
          typeLabel: 'CHECKLISTE',
          objectName: template?.title || 'Formular',
          details: `Besuch: ${fr.answers['SUPERVISOR_VISIT'] === 'YES' ? 'JA' : 'NEIN'} | ${Object.keys(fr.answers).length - 1} Antworten`,
          status: '📝 ERFASST',
          rawResponse: fr
        });
      });
    }

    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [readings, formResponses, dateRange, filterType, searchQuery, users, facilities, fridges, menus, forms, myFacilityIds]);

  // --- EXPORT FUNCTIONS ---
  const exportListToCSV = () => {
    const headers = ['Datum', 'Zeit', 'Standort', 'Nutzer', 'Typ', 'Gegenstand', 'Messwerte/Details', 'Status'];
    const rows = reportEntries.map(e => [
      e.displayDate, e.displayTime, `"${e.facility}"`, `"${e.user}"`, e.typeLabel, `"${e.objectName}"`, `"${e.details}"`, e.status
    ]);
    const content = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gourmetta_Report_${dateRange.start}_${dateRange.end}.csv`;
    link.click();
  };

  const exportListToWord = () => {
    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Report</title></head>
      <body style="font-family: sans-serif;">
        <h1 style="color: #2563eb;">Gourmetta HACCP Bericht</h1>
        <p>Zeitraum: ${dateRange.start} bis ${dateRange.end}</p>
        <table border="1" style="width:100%; border-collapse: collapse;">
          <tr style="background: #f1f5f9;">
            <th>Datum</th><th>Zeit</th><th>Standort</th><th>Nutzer</th><th>Typ</th><th>Gegenstand</th><th>Details</th><th>Status</th>
          </tr>
          ${reportEntries.map(e => `
            <tr>
              <td>${e.displayDate}</td><td>${e.displayTime}</td><td>${e.facility}</td><td>${e.user}</td>
              <td>${e.typeLabel}</td><td>${e.objectName}</td><td>${e.details}</td><td>${e.status}</td>
            </tr>
          `).join('')}
        </table>
      </body></html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gourmetta_Report_${dateRange.start}_${dateRange.end}.doc`;
    link.click();
  };

  const exportFormToWord = (fr: FormResponse) => {
    const template = forms.find(f => f.id === fr.formId);
    const usr = users.find(u => u.id === fr.userId);
    const fac = facilities.find(f => f.id === fr.facilityId);
    const dateStr = new Date(fr.timestamp).toLocaleString('de-DE');

    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Form Report</title></head>
      <body style="font-family: sans-serif; padding: 40px;">
        <h1 style="color: #2563eb; text-transform: uppercase; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">${template?.title || 'Checkliste'}</h1>
        <table border="0" style="width:100%; margin-bottom: 30px;">
          <tr><td><b>Standort:</b></td><td>${fac?.name || 'N/A'}</td></tr>
          <tr><td><b>Mitarbeiter:</b></td><td>${usr?.name || 'N/A'}</td></tr>
          <tr><td><b>Zeitpunkt:</b></td><td>${dateStr}</td></tr>
        </table>
        
        <h3 style="background: #f8fafc; padding: 10px; border-radius: 8px;">Supervisor Audit</h3>
        <p>Hat der Supervisor persönlich am Standort vorbeigeschaut? <b>${fr.answers['SUPERVISOR_VISIT'] === 'YES' ? 'JA' : 'NEIN'}</b></p>
        
        <h3 style="background: #f8fafc; padding: 10px; border-radius: 8px;">Prüfpunkte</h3>
        <table border="1" style="width:100%; border-collapse: collapse;">
          <tr style="background: #f1f5f9;">
            <th style="padding: 10px;">Frage</th><th style="padding: 10px;">Antwort</th>
          </tr>
          ${template?.questions.map(q => `
            <tr>
              <td style="padding: 10px;">${q.text}</td>
              <td style="padding: 10px; font-weight: bold;">${fr.answers[q.id] || 'N/A'}</td>
            </tr>
          `).join('') || ''}
        </table>
        
        ${fr.signature ? `
          <h3 style="margin-top: 40px;">Digitale Unterschrift</h3>
          <img src="${fr.signature}" style="max-width: 300px; border: 1px solid #e2e8f0; border-radius: 8px;" />
        ` : ''}
      </body></html>
    `;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Checkliste_${template?.title || 'HACCP'}_${fr.id}.doc`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left relative">
      <header className="no-print flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Berichte & Archiv</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">HACCP-Zentrale & Supervisor-Monitoring</p>
        </div>
        <div className="flex space-x-2">
           <button onClick={exportListToCSV} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Export CSV</button>
           <button onClick={exportListToWord} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all">Export Word</button>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 no-print">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2 lg:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Zeitraum</label>
            <div className="flex items-center space-x-2">
               <GermanCalendarPicker label="" value={dateRange.start} onChange={(v) => setDateRange({...dateRange, start: v})} />
               <span className="text-slate-400 font-black text-[10px] uppercase">bis</span>
               <GermanCalendarPicker label="" value={dateRange.end} onChange={(v) => setDateRange({...dateRange, end: v})} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Filter</label>
            <select value={filterType} onChange={(e) => {setFilterType(e.target.value as any); setSelectedSupId(null);}} className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none h-[52px]">
              <option value="all">📁 Alle Protokolle</option>
              <option value="refrigerator">❄️ Kühlgeräte</option>
              <option value="menu">🍽️ HACCP Menü</option>
              <option value="forms">📝 Checklisten</option>
              {isPrivileged && <option value="supervisor_audit">🛡️ Supervisor Audit</option>}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Suche</label>
            <input type="text" placeholder="Standort/Nutzer..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 font-bold text-sm outline-none h-[52px]" />
          </div>
        </div>
      </div>

      {filterType === 'supervisor_audit' && isPrivileged ? (
        <div className="space-y-12 animate-in slide-in-from-bottom-4">
           {!selectedSupId ? (
             <>
               <div className="bg-slate-900 text-white p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none text-[12rem]">🏆</div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter mb-12 italic border-l-4 border-blue-500 pl-6">Supervisor Ranking (Gesamtbesuche)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {supervisorStats.length > 0 ? supervisorStats.slice(0, 6).map((item, i) => (
                        <button 
                          key={item.id} 
                          onClick={() => setSelectedSupId(item.id)}
                          className={`group relative p-10 rounded-[3rem] border transition-all text-left ${i === 0 ? 'bg-blue-600 border-blue-400 scale-105 shadow-2xl' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                        >
                           <div className="flex justify-between items-start mb-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl ${i === 0 ? 'bg-white text-blue-600' : 'bg-white/10 text-white'}`}>
                                 {i === 0 ? '🥇' : `#${i+1}`}
                              </div>
                              <span className="text-xl opacity-0 group-hover:opacity-100 transition-opacity">➞</span>
                           </div>
                           <p className="text-xl font-black uppercase tracking-tight mb-1 truncate">{item.user?.name || 'Interner Supervisor'}</p>
                           <div className="flex items-baseline space-x-2">
                              <span className={`text-5xl font-black font-mono tracking-tighter ${i === 0 ? 'text-white' : 'text-blue-400'}`}>{item.total}</span>
                              <span className={`${i === 0 ? 'text-blue-100' : 'text-slate-500'} font-black text-[10px] uppercase tracking-widest`}>Besuche</span>
                           </div>
                        </button>
                     )) : (
                        <div className="col-span-3 py-20 text-center text-slate-500 italic font-black uppercase tracking-widest border-2 border-dashed border-white/10 rounded-[3rem]">Keine Besuchsdaten gefunden</div>
                     )}
                  </div>
               </div>

               <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-slate-50 dark:border-slate-800">
                     <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase">Vollständige Performance-Liste</h4>
                  </div>
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                           <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Supervisor</th>
                           <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Besuche</th>
                           <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {supervisorStats.map(sup => (
                           <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-10 py-6">
                                 <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-inner">👤</div>
                                    <span className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{sup.user?.name || 'Unbekannter Supervisor'}</span>
                                 </div>
                              </td>
                              <td className="px-10 py-6 text-center">
                                 <span className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-black text-lg font-mono">{sup.total}</span>
                              </td>
                              <td className="px-10 py-6 text-right">
                                 <button onClick={() => setSelectedSupId(sup.id)} className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline">Standorte prüfen ➞</button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
             </>
           ) : (
             <div className="space-y-8 animate-in slide-in-from-right-4">
                <button onClick={() => setSelectedSupId(null)} className="flex items-center space-x-2 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:translate-x-[-4px] transition-transform mb-4">
                   <span>❮ Zurück zum Ranking</span>
                </button>

                <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                   <div className="p-10 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-end">
                      <div className="flex items-center space-x-8">
                         <div className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[2rem] flex items-center justify-center text-5xl shadow-sm">🛡️</div>
                         <div>
                            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em] mb-2">Audit-Bericht für:</p>
                            <h3 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic">{selectedSupervisorData?.user?.name || 'Unbekannt'}</h3>
                            <p className="text-sm font-bold text-slate-400 mt-2">Detaillierte Präsenzprüfung für diesen Zeitraum</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Besuche im Zeitraum</p>
                         <div className="text-6xl font-black text-blue-600 font-mono tracking-tighter">{selectedSupervisorData?.total}</div>
                      </div>
                   </div>

                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                         <thead className="bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800">
                            <tr>
                               <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Standort</th>
                               <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Besuche (JA)</th>
                               <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nicht Vor-Ort (NEIN)</th>
                               <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Präsenz-Quote</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {selectedSupervisorData && Object.entries(selectedSupervisorData.breakdown).map(([facId, value]) => {
                               const stats = value as any;
                               const ratio = (stats.yes + stats.no) > 0 ? Math.round((stats.yes / (stats.yes + stats.no)) * 100) : 0;
                               return (
                                 <tr key={facId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                    <td className="px-10 py-8">
                                       <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xl">{getFacilityDisplayName(facId)}</span>
                                       <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Standort-ID: {facId}</p>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                       <span className="px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-lg font-mono">{stats.yes}</span>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                       <span className="px-5 py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl font-black text-lg font-mono">{stats.no}</span>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                       <div className="flex items-center justify-end space-x-4">
                                          <div className="w-32 bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                             <div className={`h-full transition-all duration-1000 ${ratio > 70 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${ratio}%` }} />
                                          </div>
                                          <span className="font-black text-xl text-slate-900 dark:text-white italic w-14">{ratio}%</span>
                                       </div>
                                    </td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>
           )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zeitpunkt</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Standort / Nutzer</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Typ / Objekt</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Messwerte / Details</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {reportEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-900 dark:text-white block font-mono">{row.displayDate}</span>
                      <span className="text-[10px] font-black text-blue-600 mt-0.5 block">{row.displayTime}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold block text-slate-800 dark:text-slate-200">{row.facility}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.user}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-black text-slate-900 dark:text-white block">{row.objectName}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded mt-1 inline-block">{row.typeLabel}</span>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-xs font-black font-mono text-slate-500 leading-relaxed truncate max-w-xs">{row.details}</p>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex items-center justify-end space-x-2">
                         <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border ${row.status.includes('OK') ? 'border-emerald-100 bg-emerald-50 text-emerald-600' : 'border-rose-100 bg-rose-50 text-rose-600'}`}>
                           {row.status}
                         </span>
                         {row.type === 'FORM' && (
                           <button onClick={() => setSelectedResponse(row.rawResponse)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">🔍</button>
                         )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- FORM RESPONSE DETAIL VIEW MODAL --- */}
      {selectedResponse && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/5 relative">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                 <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">📝</div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{forms.find(f => f.id === selectedResponse.formId)?.title || 'HACCP Protokoll'}</h3>
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{new Date(selectedResponse.timestamp).toLocaleString('de-DE')}</p>
                    </div>
                 </div>
                 <div className="flex items-center space-x-3">
                   <button onClick={() => exportFormToWord(selectedResponse)} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all">Export Word</button>
                   <button onClick={() => setSelectedResponse(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold">✕</button>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 lg:p-14 space-y-12 custom-scrollbar text-left">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10 border-b border-slate-100 dark:border-slate-800">
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Standort</p>
                       <p className="text-xl font-black text-slate-900 dark:text-white uppercase">{getFacilityDisplayName(selectedResponse.facilityId)}</p>
                    </div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Zuständiger Mitarbeiter</p>
                       <p className="text-xl font-black text-slate-900 dark:text-white uppercase">{users.find(u => u.id === selectedResponse.userId)?.name || 'Unbekannt'}</p>
                    </div>
                 </div>

                 <div className="p-8 rounded-[2.5rem] bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                       <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-2xl shadow-sm">🛡️</div>
                       <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Supervisor-Präsenzprüfung</p>
                          <p className="text-lg font-black text-slate-900 dark:text-white">War der Supervisor heute persönlich am Standort?</p>
                       </div>
                    </div>
                    <span className={`px-8 py-3 rounded-2xl font-black text-sm uppercase ${selectedResponse.answers['SUPERVISOR_VISIT'] === 'YES' ? 'bg-emerald-500 text-white shadow-xl' : 'bg-rose-500 text-white shadow-xl'}`}>
                       {selectedResponse.answers['SUPERVISOR_VISIT'] === 'YES' ? 'JA' : 'NEIN'}
                    </span>
                 </div>

                 <div className="space-y-8">
                    <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Protokollierte Prüfschritte</h4>
                    <div className="space-y-4">
                       {forms.find(f => f.id === selectedResponse.formId)?.questions.map((q, i) => (
                         <div key={q.id} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center space-x-4">
                               <span className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 shadow-sm">{i+1}</span>
                               <p className="font-bold text-slate-800 dark:text-slate-200">{q.text}</p>
                            </div>
                            <span className="font-black text-blue-600 uppercase tracking-widest text-sm bg-white dark:bg-slate-700 px-4 py-2 rounded-xl shadow-sm">
                               {selectedResponse.answers[q.id] || '---'}
                            </span>
                         </div>
                       ))}
                    </div>
                 </div>

                 {selectedResponse.signature && (
                    <div className="pt-10 border-t border-slate-100 dark:border-slate-800">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Rechtsgültige Digitale Signatur</p>
                       <div className="bg-slate-50 dark:bg-slate-800 rounded-[2rem] p-8 inline-block shadow-inner">
                          <img src={selectedResponse.signature} alt="Signatur" className="max-h-32 grayscale brightness-90 contrast-125" />
                       </div>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
