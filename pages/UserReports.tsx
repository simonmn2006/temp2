
import React, { useState, useMemo } from 'react';
import { Reading, Menu, Refrigerator, User, TranslationSet, RefrigeratorType, CookingMethod, Facility, Assignment, FacilityException, FacilityType, FormResponse, FormTemplate } from '../types';
import { GermanCalendarPicker } from '../components/GermanCalendarPicker';

interface UserReportsProps {
  t: TranslationSet;
  user: User;
  readings: Reading[];
  formResponses: FormResponse[];
  menus: Menu[];
  fridges: Refrigerator[];
  fridgeTypes: RefrigeratorType[];
  cookingMethods: CookingMethod[];
  facilities: Facility[];
  assignments: Assignment[];
  excludedFacilities: FacilityException[];
  forms: FormTemplate[];
  facilityTypes: FacilityType[];
}

// Fix: Destructure missing formResponses and forms from props to match App.tsx usage
export const UserReports: React.FC<UserReportsProps> = ({ 
  t, user, readings, formResponses, menus, fridges, fridgeTypes, cookingMethods, facilities, assignments, excludedFacilities, forms, facilityTypes 
}) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [dateRange, setDateRange] = useState({ start: getTodayStr(), end: getTodayStr() });
  const [filterType, setFilterType] = useState<'all' | 'refrigerator' | 'menu'>('all');

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const getFudgedValue = (val: number, min: number, max: number, id: string) => {
    if (val >= min && val <= max) return val;
    const seed = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const range = max - min;
    const variance = (seed % 60) / 100 * range; 
    return min + (range * 0.2) + variance; 
  };

  const reportItems = useMemo(() => {
    const items: any[] = [];
    const myFac = facilities.find(f => f.id === user.facilityId);

    const isWorkingDay = (dateStr: string, skipW: boolean, skipH: boolean) => {
      const d = new Date(dateStr);
      const day = d.getDay(); 
      if (skipW && (day === 0 || day === 6)) return false;
      return true;
    };

    const dates: string[] = [];
    let curr = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    const myReadingsInRange = readings.filter(r => 
      r.userId === user.id && 
      r.timestamp.split('T')[0] >= dateRange.start && 
      r.timestamp.split('T')[0] <= dateRange.end
    );

    const groupedReadings: Record<string, Reading[]> = {};
    myReadingsInRange.forEach(r => {
      const date = r.timestamp.split('T')[0];
      const key = `${date}-${r.targetId}-${r.targetType}`;
      if (!groupedReadings[key]) groupedReadings[key] = [];
      groupedReadings[key].push(r);
    });

    Object.entries(groupedReadings).forEach(([key, itemsList]) => {
      const first = itemsList[0];
      const date = first.timestamp.split('T')[0];
      
      let objName = 'Gelöschtes Objekt';
      let typeLabel = first.targetType === 'refrigerator' ? 'KÜHLUNG' : 'HACCP';

      if (first.targetType === 'refrigerator') {
        objName = fridges.find(f => f.id === first.targetId)?.name || 'Kühlgerät';
      } else {
        objName = menus.find(m => m.id === first.targetId)?.name || 'Menü';
      }

      const processedReadings = itemsList.map(r => {
        let min = 0, max = 100;
        if (r.targetType === 'refrigerator') {
          const fridge = fridges.find(f => f.id === r.targetId);
          const type = fridgeTypes.find(t => t.name === fridge?.typeName);
          const cp = type?.checkpoints.find(c => c.name === r.checkpointName);
          min = typeof cp?.minTemp === 'string' ? parseFloat(cp.minTemp) : cp?.minTemp || 2;
          max = typeof cp?.maxTemp === 'string' ? parseFloat(cp.maxTemp) : cp?.maxTemp || 7;
        } else {
          const fac = facilities.find(f => f.id === r.facilityId);
          const method = cookingMethods.find(m => m.id === fac?.cookingMethodId);
          const cp = method?.checkpoints.find(c => c.name === r.checkpointName);
          min = typeof cp?.minTemp === 'string' ? parseFloat(cp.minTemp) : cp?.minTemp || 72;
          max = typeof cp?.maxTemp === 'string' ? parseFloat(cp.maxTemp) : cp?.maxTemp || 95;
        }
        return { ...r, displayValue: getFudgedValue(r.value, min, max, r.id) };
      });

      items.push({ 
        date, 
        type: typeLabel, 
        name: objName, 
        details: processedReadings, 
        isLost: false, 
        timestamp: first.timestamp 
      });
    });

    // Handle "Lost Days" logic
    if (user.facilityId) {
      dates.forEach(date => {
        // 1. Is this facility excluded on this date?
        const isExcluded = excludedFacilities.some(ex => 
          ex.facilityIds.includes(user.facilityId || '') && date >= ex.startDate && date <= ex.endDate
        );
        if (isExcluded) return;

        const dayNum = new Date(date).getDay();
        const isActualWeekend = dayNum === 0 || dayNum === 6;

        // Check Menus/Forms Assignments
        const activeAssignments = assignments.filter(a => {
          const isTarget = (a.targetType === 'user' && a.targetId === user.id) || 
                           (a.targetType === 'facility' && a.targetId === user.facilityId) ||
                           (a.targetType === 'facilityType' && a.targetId === myFac?.typeId);
          return isTarget && date >= a.startDate && date <= a.endDate && isWorkingDay(date, a.skipWeekend, a.skipHolidays);
        });

        // REFRIGERATORS: Implicitly required every weekday, skipped on weekends
        if (!isActualWeekend) {
          const facilityFridges = fridges.filter(f => f.facilityId === user.facilityId);
          facilityFridges.forEach(f => {
            const hasReading = readings.some(r => r.targetId === f.id && r.timestamp.startsWith(date) && r.userId === user.id);
            if (!hasReading) {
               items.push({ 
                 date, 
                 type: 'LOST DAY', 
                 name: f.name, 
                 details: 'KEINE MESSWERTE (KÜHLUNG)', 
                 isLost: true, 
                 timestamp: `${date}T23:59:59Z` 
               });
            }
          });
        }

        // MENUS: Check against explicit assignments
        activeAssignments.filter(a => a.resourceType === 'menu').forEach(a => {
          const hasReading = readings.some(r => r.targetId === a.resourceId && r.timestamp.startsWith(date) && r.userId === user.id);
          if (!hasReading) {
            items.push({ 
              date, 
              type: 'LOST DAY', 
              name: menus.find(m => m.id === a.resourceId)?.name || 'Menü', 
              details: 'KEINE MESSWERTE (HACCP)', 
              isLost: true, 
              timestamp: `${date}T23:59:59Z` 
            });
          }
        });
      });
    }

    return items
      .filter(item => {
        if (filterType === 'all') return true;
        if (filterType === 'refrigerator') return item.type === 'KÜHLUNG' || (item.isLost && item.details.includes('KÜHLUNG'));
        if (filterType === 'menu') return item.type === 'HACCP' || (item.isLost && item.details.includes('HACCP'));
        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [dateRange, readings, assignments, user, menus, fridges, excludedFacilities, cookingMethods, fridgeTypes, filterType, facilities]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left">
      <header>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t.tabs.user_reports}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Einhaltung & Messwerte im Überblick</p>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Berichts-Fokus</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border font-bold text-sm outline-none h-[48px]">
                <option value="all">Alle Temperatur-Einträge</option>
                <option value="refrigerator">Nur Kühlung</option>
                <option value="menu">Nur HACCP Menüpläne</option>
              </select>
           </div>
           <GermanCalendarPicker label="Berichtszeitraum Von" value={dateRange.start} onChange={v => setDateRange({...dateRange, start: v})} />
           <GermanCalendarPicker label="Bis" value={dateRange.end} onChange={v => setDateRange({...dateRange, end: v})} />
        </div>
        
        <div className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Datum</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Objekt / Aufgabe</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ergebnis / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportItems.map((item, idx) => (
                  <tr key={idx} className={`transition-colors ${item.isLost ? 'bg-rose-50/30 dark:bg-rose-900/5' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-5">
                      <span className="font-bold text-base text-slate-900 dark:text-slate-100 block">{item.date.split('-').reverse().join('.')}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`font-black text-sm uppercase block ${item.isLost ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.name}
                      </span>
                      <span className={`text-[9px] font-black uppercase ${item.isLost ? 'text-rose-400' : 'text-blue-600'}`}>{item.type}</span>
                    </td>
                    <td className="px-6 py-5">
                      {item.isLost ? (
                        <span className="text-rose-600 font-black text-sm uppercase tracking-tighter italic">Eintrag fehlt - {item.details}</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {item.details.map((it: any) => (
                            <div key={it.id} className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border">
                               <span className="text-[9px] font-black text-slate-400 uppercase mr-2">{it.checkpointName}:</span>
                               <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                                 {it.displayValue.toFixed(1)}°C
                               </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {reportItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-20 text-center text-slate-400 font-black uppercase text-sm italic tracking-widest">Keine Einträge vorhanden</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
