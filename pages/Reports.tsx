
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

export const ReportsPage: React.FC<ReportsPageProps> = ({ t, currentUser, readings, formResponses, users, facilities, fridges, menus, forms }) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: getTodayStr(), end: getTodayStr() });
  const [filterType, setFilterType] = useState<'all' | 'refrigerator' | 'menu' | 'forms' | 'supervisor_audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupId, setSelectedSupId] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);

  const isPrivileged = currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  const getFacilityDisplayName = (id: string) => facilities.find(f => f.id === id)?.name || `ID: ${id}`;

  const supervisorStats = useMemo(() => {
    if (!isPrivileged) return [];
    const supData: Record<string, { totalVisits: number, totalChecked: number, breakdown: Record<string, { yes: number, no: number }> }> = {};

    formResponses.forEach(fr => {
      const date = fr.timestamp.split('T')[0];
      if (date < dateRange.start || date > dateRange.end) return;
      
      // Look for the special editable question ID or a question containing "Supervisor"
      const visitAnswerKey = Object.keys(fr.answers).find(k => k === 'Q-SUPER-VISIT' || k === 'SUPERVISOR_VISIT');
      if (!visitAnswerKey) return;

      const visit = fr.answers[visitAnswerKey];
      const fac = facilities.find(f => f.id === fr.facilityId);
      const supId = fac?.supervisorId || 'UNASSIGNED';

      if (!supData[supId]) supData[supId] = { totalVisits: 0, totalChecked: 0, breakdown: {} };
      if (!supData[supId].breakdown[fr.facilityId]) supData[supId].breakdown[fr.facilityId] = { yes: 0, no: 0 };

      supData[supId].totalChecked++;
      if (visit === 'YES') {
        supData[supId].totalVisits++;
        supData[supId].breakdown[fr.facilityId].yes++;
      } else {
        supData[supId].breakdown[fr.facilityId].no++;
      }
    });

    return Object.entries(supData).map(([id, data]) => ({ id, user: users.find(u => u.id === id), total: data.totalVisits, totalChecked: data.totalChecked, breakdown: data.breakdown })).sort((a, b) => b.total - a.total);
  }, [formResponses, dateRange, facilities, users, isPrivileged]);

  const reportEntries = useMemo(() => {
    const entries: any[] = [];
    const query = searchQuery.toLowerCase();

    if (filterType === 'all' || filterType === 'refrigerator' || filterType === 'menu') {
      readings.filter(r => {
        const d = r.timestamp.split('T')[0];
        return d >= dateRange.start && d <= dateRange.end && (filterType === 'all' || r.targetType === filterType);
      }).forEach(r => {
        const facName = getFacilityDisplayName(r.facilityId);
        const usr = users.find(u => u.id === r.userId);
        if (query && !facName.toLowerCase().includes(query) && !usr?.name.toLowerCase().includes(query)) return;
        entries.push({
          id: r.id, rawResponse: r, type: 'READING', timestamp: r.timestamp, facility: facName, user: usr?.name || 'N/A',
          typeLabel: r.targetType === 'refrigerator' ? 'KÜHLUNG' : 'HACCP',
          objectName: r.targetType === 'refrigerator' ? (fridges.find(f => f.id === r.targetId)?.name || 'Gerät') : (menus.find(m => m.id === r.targetId)?.name || 'Menü'),
          details: `${r.checkpointName}: ${r.value.toFixed(1)}°C`, status: r.reason ? '⚠️ KORREKTUR' : '✅ OK'
        });
      });
    }

    if (filterType === 'all' || filterType === 'forms') {
      formResponses.filter(fr => {
        const d = fr.timestamp.split('T')[0];
        return d >= dateRange.start && d <= dateRange.end;
      }).forEach(fr => {
        const facName = getFacilityDisplayName(fr.facilityId);
        const usr = users.find(u => u.id === fr.userId);
        if (query && !facName.toLowerCase().includes(query) && !usr?.name.toLowerCase().includes(query)) return;
        entries.push({
          id: fr.id, rawResponse: fr, type: 'FORM', timestamp: fr.timestamp, facility: facName, user: usr?.name || 'N/A',
          typeLabel: 'CHECKLISTE', objectName: forms.find(f => f.id === fr.formId)?.title || 'HACCP',
          details: `${Object.keys(fr.answers).length} Antworten`, status: '📝 ERFASST'
        });
      });
    }
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [readings, formResponses, dateRange, filterType, searchQuery, users, facilities, fridges, menus, forms]);

  const exportListToCSV = () => {
    const headers = ['Datum', 'Standort', 'Nutzer', 'Typ', 'Objekt', 'Details', 'Status'];
    const rows = reportEntries.map(e => [e.timestamp.split('T')[0], `"${e.facility}"`, `"${e.user}"`, e.typeLabel, `"${e.objectName}"`, `"${e.details}"`, e.status]);
    const content = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'Gourmetta_Report.csv'; link.click();
  };

  const exportFormToWord = (fr: FormResponse) => {
    const template = forms.find(f => f.id === fr.formId);
    const usr = users.find(u => u.id === fr.userId);
    const fac = facilities.find(f => f.id === fr.facilityId);
    let html = `<html><body style="font-family:sans-serif;"><h1>${template?.title}</h1>
                <p><b>Standort:</b> ${fac?.name}</p><p><b>Mitarbeiter:</b> ${usr?.name}</p><p><b>Zeit:</b> ${new Date(fr.timestamp).toLocaleString('de-DE')}</p>
                <table border="1" style="width:100%;border-collapse:collapse;">
                ${template?.questions.map(q => `<tr><td style="padding:10px;">${q.text}</td><td style="padding:10px;"><b>${fr.answers[q.id] || 'N/A'}</b></td></tr>`).join('')}
                </table>
                ${fr.signature ? `<p><b>Signatur:</b></p><img src="${fr.signature}" style="max-width:300px;border:1px solid #ccc;" />` : ''}
                </body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `HACCP_${fr.id}.doc`; link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Berichte & Archiv</h1>
          <p className="text-sm text-slate-500 font-medium">Zentrale HACCP Dokumentation</p>
        </div>
        <button onClick={exportListToCSV} className="px-6 py-2 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Export CSV</button>
      </header>

      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <GermanCalendarPicker label="Von" value={dateRange.start} onChange={v => setDateRange({...dateRange, start: v})} />
          <GermanCalendarPicker label="Bis" value={dateRange.end} onChange={v => setDateRange({...dateRange, end: v})} />
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="px-5 py-3 rounded-2xl bg-slate-50 border font-bold text-sm h-[52px] outline-none">
            <option value="all">📁 Alle Logs</option>
            <option value="refrigerator">❄️ Kühlung</option>
            <option value="menu">🍽️ HACCP Menü</option>
            <option value="forms">📝 Checklisten</option>
            {isPrivileged && <option value="supervisor_audit">🛡️ Supervisor Audit</option>}
          </select>
          <input type="text" placeholder="Suche..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="px-5 py-3 rounded-2xl bg-slate-50 border font-bold text-sm h-[52px] outline-none" />
      </div>

      {filterType === 'supervisor_audit' ? (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
           <table className="w-full text-left">
              <thead className="bg-slate-50"><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5">Supervisor</th><th className="px-8 py-5">Gesamtbesuche</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {supervisorStats.map(sup => (
                  <tr key={sup.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-6 font-black uppercase text-slate-800">{sup.user?.name || 'Intern'}</td>
                    <td className="px-8 py-6 font-black font-mono text-xl text-blue-600">{sup.total}</td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50"><tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5">Zeitpunkt</th><th className="px-8 py-5">Standort / Nutzer</th><th className="px-8 py-5">Gegenstand</th><th className="px-8 py-5">Messwert</th><th className="px-8 py-5 text-right">Aktion</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {reportEntries.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-8 py-6 text-sm font-bold text-slate-900">{row.timestamp.split('T')[0]}</td>
                    <td className="px-8 py-6">
                      <span className="text-sm font-bold block">{row.facility}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{row.user}</span>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-sm font-bold block">{row.objectName}</span>
                       <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded uppercase font-black">{row.typeLabel}</span>
                    </td>
                    <td className="px-8 py-6 font-mono text-xs text-slate-500">{row.details}</td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex justify-end space-x-2">
                         <span className={`px-2 py-1 rounded text-[9px] font-black border ${row.status.includes('OK') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{row.status}</span>
                         {row.type === 'FORM' && <button onClick={() => setSelectedResponse(row.rawResponse)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">🔍 Details</button>}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedResponse && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden text-left relative">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                 <h3 className="text-xl font-black uppercase">Log-Details</h3>
                 <div className="flex space-x-2">
                    <button onClick={() => exportFormToWord(selectedResponse)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase">Word Export</button>
                    <button onClick={() => setSelectedResponse(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 font-bold">✕</button>
                 </div>
              </div>
              <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inhalt der Checkliste</h4>
                    {Object.entries(selectedResponse.answers).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border">
                        <span className="font-bold text-slate-700">{forms.find(f => f.id === selectedResponse.formId)?.questions.find(q => q.id === key)?.text || key}</span>
                        <span className="font-black text-blue-600 uppercase">{val}</span>
                      </div>
                    ))}
                 </div>
                 {selectedResponse.signature && (
                    <div className="pt-8 border-t">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-4">Unterschrift</p>
                       <img src={selectedResponse.signature} className="max-h-32 border p-2 rounded-xl" alt="Signatur" />
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
