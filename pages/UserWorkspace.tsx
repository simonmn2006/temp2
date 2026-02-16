import React, { useState, useMemo, useEffect } from 'react';
import { User, Refrigerator, Menu, Assignment, Reading, TranslationSet, RefrigeratorType, CookingMethod, Facility, Checkpoint, FacilityException, Alert, FormResponse, FacilityType } from '../types';

interface GroupedItem {
  id: string;
  name: string;
  type: 'refrigerator' | 'menu';
  checkpoints: any[];
  colorClass: string;
}

interface UserWorkspaceProps {
  t: TranslationSet;
  user: User;
  fridges: Refrigerator[];
  menus: Menu[];
  assignments: Assignment[];
  readings: Reading[];
  onSave: (reading: Reading, alert?: Alert) => void;
  fridgeTypes: RefrigeratorType[];
  cookingMethods: CookingMethod[];
  facilities: Facility[];
  excludedFacilities: FacilityException[];
  facilityTypes: FacilityType[];
  onViolation: (alert: Alert) => void;
  formResponses: FormResponse[];
}

export const UserWorkspace: React.FC<UserWorkspaceProps> = ({ 
  t, user, fridges, menus, assignments, readings, onSave, fridgeTypes, cookingMethods, facilities, excludedFacilities, facilityTypes, onViolation, formResponses
}) => {
  const [now, setNow] = useState(new Date());
  const [draftTemps, setDraftTemps] = useState<Record<string, string>>({});
  const [draftReasons, setDraftReasons] = useState<Record<string, string>>({});
  const [lockingIds, setLockingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [now]);

  const isWeekend = useMemo(() => {
    const day = now.getDay();
    return day === 0 || day === 6; 
  }, [now]);

  const myFacility = useMemo(() => facilities.find(f => f.id === user.facilityId), [facilities, user.facilityId]);

  const activeExclusion = useMemo(() => {
    if (!user.facilityId) return null;
    return (excludedFacilities || []).find(ex => 
      ex.facilityIds.includes(user.facilityId!) && 
      todayStr >= ex.startDate && todayStr <= ex.endDate
    );
  }, [excludedFacilities, user.facilityId, todayStr]);

  const groupedActiveItems = useMemo(() => {
    if (!user || !user.facilityId || activeExclusion) return [];
    
    const assignedFridges = isWeekend ? [] : (fridges || []).filter(f => f.facilityId === user.facilityId);
    
    const assignedMenuIds = (assignments || [])
      .filter(a => {
        if (a.resourceType !== 'menu') return false;
        const isUserMatch = a.targetType === 'user' && a.targetId === user.id;
        const isFacMatch = a.targetType === 'facility' && a.targetId === user.facilityId;
        const isTypeMatch = a.targetType === 'facilityType' && a.targetId === myFacility?.typeId;
        if (!(isUserMatch || isFacMatch || isTypeMatch)) return false;
        const isActive = todayStr >= a.startDate && todayStr <= a.endDate;
        const isSkippedWeekend = a.skipWeekend && isWeekend;
        return isActive && !isSkippedWeekend;
      })
      .map(a => a.resourceId);

    const groups: Record<string, GroupedItem> = {};

    assignedFridges.forEach(f => {
      const type = fridgeTypes.find(t => t.name === f.typeName);
      const cps = type?.checkpoints || [{ name: 'Temperatur', minTemp: 2, maxTemp: 7 }];
      const activeCps = cps.filter(cp => !(readings || []).some(r => r.targetId === f.id && r.checkpointName === cp.name && r.timestamp.startsWith(todayStr)))
        .map(cp => ({ ...cp, uniqueKey: `fridge-${f.id}-${cp.name}` }));
      if (activeCps.length > 0) {
        groups[f.id] = { id: f.id, name: f.name, type: 'refrigerator', checkpoints: activeCps, colorClass: 'border-slate-400 bg-slate-100 text-slate-700' };
      }
    });

    assignedMenuIds.forEach(mId => {
      const menu = menus.find(m => m.id === mId);
      if (!menu) return;
      const method = cookingMethods.find(m => m.id === myFacility?.cookingMethodId);
      const cps = method?.checkpoints || [{ name: 'Kern-Temperatur', minTemp: 72, maxTemp: 95 }];
      const activeCps = cps.filter(cp => !(readings || []).some(r => r.targetId === menu.id && r.checkpointName === cp.name && r.timestamp.startsWith(todayStr)))
        .map(cp => ({ ...cp, uniqueKey: `menu-${menu.id}-${cp.name}` }));
      if (activeCps.length > 0) {
        groups[menu.id] = { id: menu.id, name: menu.name, type: 'menu', checkpoints: activeCps, colorClass: 'border-blue-500 bg-blue-50 text-blue-700' };
      }
    });
    
    return Object.values(groups);
  }, [fridges, assignments, menus, user, fridgeTypes, cookingMethods, myFacility, readings, todayStr, activeExclusion, isWeekend]);

  const updateTemp = (key: string, delta: number, baseValue: number) => {
    const currentStr = draftTemps[key] ?? baseValue.toString();
    const currentVal = parseFloat(currentStr);
    const nextVal = Math.round((currentVal + delta) * 10) / 10;
    setDraftTemps({ ...draftTemps, [key]: nextVal.toString() });
  };

  const lockReading = (parent: GroupedItem, cp: any) => {
    const val = draftTemps[cp.uniqueKey] ? parseFloat(draftTemps[cp.uniqueKey]) : parseFloat(cp.minTemp.toString());
    const min = parseFloat(cp.minTemp.toString());
    const max = parseFloat(cp.maxTemp.toString());
    const isOutOfRange = val < min || val > max;
    const reason = draftReasons[cp.uniqueKey] || '';

    if (isOutOfRange && !reason.trim()) return;

    setLockingIds(prev => new Set(prev).add(cp.uniqueKey));
    
    setTimeout(() => {
      const timestamp = new Date().toISOString();
      const reading: Reading = {
        id: `READ-${Date.now()}`, 
        targetId: parent.id, 
        targetType: parent.type, 
        checkpointName: cp.name, 
        value: val, 
        timestamp, 
        userId: user.id, 
        facilityId: user.facilityId || '', 
        isLocked: true,
        reason: isOutOfRange ? reason : undefined
      };
      
      let violationAlert: Alert | undefined = undefined;

      if (isOutOfRange) {
        violationAlert = {
          id: `ALRT-${Date.now()}`,
          facilityId: user.facilityId || 'UNKNOWN',
          facilityName: myFacility?.name || 'Unbekannter Standort',
          targetName: parent.name,
          checkpointName: cp.name,
          value: val,
          min: min,
          max: max,
          timestamp: timestamp,
          userId: user.id,
          userName: user.name,
          resolved: false
        };
      }

      onSave(reading, violationAlert);

      setLockingIds(prev => { 
        const n = new Set(prev); 
        n.delete(cp.uniqueKey); 
        return n; 
      });
    }, 400);
  };

  const myGreenImpact = useMemo(() => {
    const myReadings = readings.filter(r => r.userId === user.id);
    const myResponses = formResponses.filter(r => r.userId === user.id);
    const menuDays = new Set(myReadings.filter(r => r.targetType === 'menu').map(r => r.timestamp.split('T')[0])).size;
    const fridgeDays = new Set(myReadings.filter(r => r.targetType === 'refrigerator').map(r => r.timestamp.split('T')[0])).size;
    const totalA4 = menuDays + Math.ceil(fridgeDays / 5) + (myResponses || []).length;
    return { totalA4, tonerSaved: (totalA4 / 1500).toFixed(4) };
  }, [readings, formResponses, user.id]);

  return (
    <div className="space-y-4 lg:space-y-8 animate-in fade-in duration-500 text-left pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 p-4 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
          <div>
            <h1 className="text-lg lg:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Temperatur-Logbuch</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">📍 {myFacility?.name || '---'}</p>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-2xl lg:text-3xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tighter">
              {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 p-6 rounded-[2rem] flex flex-col justify-center items-center text-center shadow-inner relative group">
           <div className="absolute top-2 right-4 text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">Gourmetta Go Green</div>
           <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-2xl mb-3 shadow-md group-hover:scale-110 transition-transform duration-500">🍃</div>
           <div className="space-y-1">
              <p className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">Mein Beitrag</p>
              <div className="flex items-baseline justify-center space-x-1">
                 <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{myGreenImpact.totalA4}</span>
                 <span className="text-[10px] font-black text-emerald-600/60 uppercase">Blätter gespart</span>
              </div>
           </div>
        </div>
      </div>

      <div className="space-y-10">
        {activeExclusion ? (
          <div className="bg-white dark:bg-slate-900 min-h-[400px] rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center p-12 text-center shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-amber-500" />
            <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">🚫</div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase">Standort vorübergehend ausgesetzt</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md font-medium">{activeExclusion.reason}</p>
          </div>
        ) : isWeekend && groupedActiveItems.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[3.5rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
             <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">🛋️</div>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Wochenende</h3>
             <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Keine Kühlschrank-Log-Aufgaben für heute.</p>
          </div>
        ) : groupedActiveItems.length > 0 ? (
          groupedActiveItems.map((group) => (
            <div key={group.id} className={`bg-white dark:bg-slate-900 rounded-[3rem] border-l-[12px] shadow-2xl overflow-hidden ${group.colorClass.split(' ')[0]}`}>
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
                <div className="flex items-center space-x-5">
                   <span className="text-4xl">{group.type === 'refrigerator' ? '❄️' : '🍽️'}</span>
                   <h2 className="text-2xl lg:text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">{group.name}</h2>
                </div>
              </div>
              <div className="p-8 space-y-12">
                {group.checkpoints.map((cp) => {
                  const currentVal = parseFloat(draftTemps[cp.uniqueKey] ?? cp.minTemp.toString());
                  const min = parseFloat(cp.minTemp.toString());
                  const max = parseFloat(cp.maxTemp.toString());
                  const isOutOfRange = currentVal < min || currentVal > max;

                  return (
                    <div key={cp.uniqueKey} className={`flex flex-col space-y-6 p-8 rounded-[3.5rem] border-2 transition-all ${lockingIds.has(cp.uniqueKey) ? 'opacity-30 scale-95' : 'bg-white dark:bg-slate-900'} ${isOutOfRange ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100 dark:border-slate-800'}`}>
                      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="text-center lg:text-left">
                          <h4 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-3">{cp.name}</h4>
                          <div className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-5 py-2 rounded-full">
                             <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Soll:</span>
                             <span className="text-lg font-black text-blue-600 font-mono italic">{cp.minTemp}° - {cp.maxTemp}°C</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6">
                          <div className={`flex items-center bg-white dark:bg-slate-800 rounded-[2.5rem] p-3 border-2 transition-all shadow-xl ${isOutOfRange ? 'border-rose-500 shadow-rose-500/10' : 'border-slate-100 dark:border-slate-700'}`}>
                            <button 
                              onClick={() => updateTemp(cp.uniqueKey, -0.5, parseFloat(cp.minTemp))}
                              className="w-20 h-20 flex items-center justify-center rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 text-blue-600 font-black text-4xl hover:bg-blue-100 transition-colors shadow-sm"
                            >
                              -
                            </button>
                            <input 
                              type="text" 
                              value={draftTemps[cp.uniqueKey] ?? cp.minTemp} 
                              onChange={e => setDraftTemps({...draftTemps, [cp.uniqueKey]: e.target.value})}
                              className={`w-48 text-center bg-transparent border-none font-black text-6xl font-mono outline-none tracking-tighter ${isOutOfRange ? 'text-rose-600 animate-pulse' : 'text-slate-900 dark:text-white'}`}
                            />
                            <button 
                              onClick={() => updateTemp(cp.uniqueKey, 0.5, parseFloat(cp.minTemp))}
                              className="w-20 h-20 flex items-center justify-center rounded-[1.5rem] bg-slate-50 dark:bg-slate-900 text-blue-600 font-black text-4xl hover:bg-blue-100 transition-colors shadow-sm"
                            >
                              +
                            </button>
                          </div>
                          <button 
                            onClick={() => lockReading(group, cp)} 
                            disabled={isOutOfRange && !(draftReasons[cp.uniqueKey]?.trim())}
                            className={`w-24 h-24 rounded-[2.5rem] shadow-2xl flex items-center justify-center text-3xl transition-all ${isOutOfRange && !(draftReasons[cp.uniqueKey]?.trim()) ? 'bg-slate-200 text-slate-400 grayscale opacity-50 cursor-not-allowed' : 'bg-blue-600 text-white hover:scale-110 active:scale-95'}`}
                          >
                            {isOutOfRange && !(draftReasons[cp.uniqueKey]?.trim()) ? '⚠️' : '🔒'}
                          </button>
                        </div>
                      </div>
                      {isOutOfRange && (
                         <div className="animate-in slide-in-from-top-4 duration-500 pt-6">
                            <div className="flex items-center space-x-2 mb-4 px-2">
                               <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                               <label className="text-sm font-black text-rose-600 uppercase tracking-[0.15em]">Grund für Abweichung erforderlich</label>
                            </div>
                            <textarea 
                              value={draftReasons[cp.uniqueKey] || ''}
                              onChange={(e) => setDraftReasons({...draftReasons, [cp.uniqueKey]: e.target.value})}
                              placeholder="Warum weicht der Wert ab? (z.B. Abtauung, Tür offen...)"
                              className="w-full p-8 rounded-[2.5rem] bg-rose-50/50 dark:bg-rose-900/10 border-2 border-rose-200 dark:border-rose-900/30 font-bold text-lg outline-none focus:border-rose-500 transition-all placeholder:text-rose-300 min-h-[120px] shadow-inner"
                            />
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[3.5rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
             <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner animate-bounce">🏆</div>
             <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">Alle Aufgaben erledigt</h3>
             <p className="text-slate-400 font-bold uppercase tracking-widest mt-2">Die heutigen Messwerte wurden vollständig erfasst.</p>
          </div>
        )}
      </div>
    </div>
  );
};