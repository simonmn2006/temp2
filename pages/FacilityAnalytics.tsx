
import React, { useState, useMemo } from 'react';
import { TranslationSet, Facility, Alert, Reading, FacilityType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FacilityAnalyticsPageProps {
  t: TranslationSet;
  facilities: Facility[];
  alerts: Alert[];
  readings: Reading[];
  facilityTypes: FacilityType[];
}

export const FacilityAnalyticsPage: React.FC<FacilityAnalyticsPageProps> = ({ t, facilities, alerts, readings, facilityTypes }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all');

  const analyticsData = useMemo(() => {
    return facilities.map(f => {
      const facilityAlerts = alerts.filter(a => a.facilityId === f.id);
      const facilityReadings = readings.filter(r => r.facilityId === f.id);
      const unresolvedAlerts = facilityAlerts.filter(a => !a.resolved).length;
      
      // Calculate a pseudo-compliance score based on readings volume and violation history
      // Lower score if high violation count relative to reading count
      const violationRate = facilityReadings.length > 0 ? (facilityAlerts.length / facilityReadings.length) * 100 : 0;
      const baseScore = 100 - (violationRate * 2);
      const finalScore = Math.max(0, Math.min(100, baseScore - (unresolvedAlerts * 5)));

      return {
        id: f.id,
        name: f.name,
        typeId: f.typeId,
        typeName: facilityTypes.find(t => t.id === f.typeId)?.name || 'N/A',
        violations: facilityAlerts.length,
        unresolved: unresolvedAlerts,
        readings: facilityReadings.length,
        score: Math.round(finalScore)
      };
    }).filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedTypeId === 'all' || f.typeId === selectedTypeId;
      return matchesSearch && matchesType;
    }).sort((a, b) => b.violations - a.violations); // Default sort by most violations
  }, [facilities, alerts, readings, facilityTypes, searchTerm, selectedTypeId]);

  const chartData = useMemo(() => {
    return [...analyticsData]
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10) // Top 10 for visibility
      .map(d => ({
        name: d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name,
        violations: d.violations,
        fullName: d.name
      }));
  }, [analyticsData]);

  const stats = useMemo(() => {
    const totalV = alerts.length;
    const avgScore = analyticsData.length > 0 
      ? analyticsData.reduce((acc, curr) => acc + curr.score, 0) / analyticsData.length 
      : 0;
    const mostProblematic = analyticsData[0]?.name || 'N/A';
    const topPerformer = [...analyticsData].sort((a, b) => b.score - a.score)[0]?.name || 'N/A';

    return { totalV, avgScore, mostProblematic, topPerformer };
  }, [alerts, analyticsData]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-left pb-16">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Standort-Analyse</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Leistungsvergleich und HACCP-Konformität</p>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Standort suchen..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
            />
          </div>
          <select 
            value={selectedTypeId} 
            onChange={(e) => setSelectedTypeId(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-xs outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
          >
            <option value="all">Alle Typen</option>
            {facilityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Anzahl der Abweichungen', val: stats.totalV, icon: '⚠️', color: 'text-rose-600', sub: 'Historisch' },
          { label: 'Ø Einhaltungsquote', val: `${Math.round(stats.avgScore)}%`, icon: '🛡️', color: 'text-blue-600', sub: 'Gesamtnetz' },
          { label: 'Herausforderung', val: stats.mostProblematic, icon: '🔥', color: 'text-amber-600', sub: 'Meiste Fehler' },
          { label: 'Top Performer', val: stats.topPerformer, icon: '🏆', color: 'text-emerald-600', sub: 'Höchste Score' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
             <div className="flex justify-between items-start mb-2">
                <span className="text-2xl group-hover:scale-110 transition-transform">{kpi.icon}</span>
                <span className={`text-2xl font-black tracking-tighter ${kpi.color} truncate max-w-[120px]`}>{kpi.val}</span>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
             <p className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Violation Chart (Left) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
           <div className="mb-8">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Abweichungen pro Standort (Top 10)</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Identifizierung kritischer Hotspots</p>
           </div>
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}} 
                    contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px'}}
                  />
                  <Bar dataKey="violations" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.violations > 5 ? '#e11d48' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Action Needed (Right) */}
        <div className="lg:col-span-4 bg-rose-50 dark:bg-rose-900/10 p-8 rounded-[3.5rem] border border-rose-100 dark:border-rose-800 shadow-inner flex flex-col">
           <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 uppercase tracking-tight mb-6">Dringend Prüfen</h3>
           <div className="space-y-4 flex-1">
              {analyticsData.filter(d => d.unresolved > 0).slice(0, 4).map(d => (
                <div key={d.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center justify-between group cursor-pointer hover:shadow-lg transition-all">
                   <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500 animate-pulse">⚠️</div>
                      <div>
                         <p className="text-xs font-black text-slate-800 dark:text-slate-100 leading-tight">{d.name}</p>
                         <p className="text-[9px] font-bold text-rose-400 uppercase">{d.unresolved} Offene Alarme</p>
                      </div>
                   </div>
                   <span className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">➞</span>
                </div>
              ))}
              {analyticsData.filter(d => d.unresolved > 0).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                   <span className="text-4xl mb-4">🛡️</span>
                   <p className="text-[10px] font-black uppercase text-slate-400">Keine kritischen Standorte</p>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800">
           <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Vollständiges Ranking</h3>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Echtzeit-Sortierung nach Sicherheits-Score</p>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Standort</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Abweichungen</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Logs Gesamt</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Einhaltungsquote</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {analyticsData.map((d, idx) => (
                <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-4">
                       <span className="text-xs font-black text-slate-300">#{idx + 1}</span>
                       <div>
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100 block">{d.name}</span>
                          <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{d.typeName}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-3 py-1 rounded-lg text-xs font-black border ${d.violations > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      {d.violations}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                     <span className="text-xs font-black text-slate-400 font-mono">{d.readings}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end space-x-3">
                       <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className={`h-full transition-all duration-1000 ${d.score > 90 ? 'bg-emerald-500' : d.score > 70 ? 'bg-blue-500' : d.score > 40 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                            style={{ width: `${d.score}%` }}
                          />
                       </div>
                       <span className={`text-sm font-black italic ${d.score > 90 ? 'text-emerald-600' : d.score > 40 ? 'text-slate-900 dark:text-white' : 'text-rose-600'}`}>
                          {d.score}%
                       </span>
                    </div>
                  </td>
                </tr>
              ))}
              {analyticsData.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center text-slate-400 font-black uppercase text-sm italic tracking-widest">Keine Daten verfügbar</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
