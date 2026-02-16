
import React, { useState, useMemo, useRef, useEffect } from 'react';

const GERMAN_MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];
const GERMAN_DAYS = ['MO', 'DI', 'MI', 'DO', 'FR', 'SA', 'SO'];

interface GermanCalendarPickerProps {
  value: string;
  onChange: (val: string) => void;
  label: string;
  minDate?: string;
  initialMonth?: string;
}

export const GermanCalendarPicker: React.FC<GermanCalendarPickerProps> = ({ 
  value, onChange, label, minDate, initialMonth 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [viewDate, setViewDate] = useState(() => {
    const d = value ? new Date(value) : (initialMonth ? new Date(initialMonth + '-01') : new Date());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  useEffect(() => {
    if (!isOpen) {
      const d = value ? new Date(value) : (initialMonth ? new Date(initialMonth + '-01') : new Date());
      if (!isNaN(d.getTime())) {
        setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [value, initialMonth, isOpen]);

  const daysInMonth = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < offset; i++) calendarDays.push(null);
    for (let i = 1; i <= days; i++) calendarDays.push(i);
    return calendarDays;
  }, [viewDate]);

  const handleDaySelect = (day: number) => {
    const y = viewDate.getFullYear();
    const m = (viewDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (minDate && dateStr < minDate) return;
    onChange(dateStr);
    setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const formattedDisplay = useMemo(() => {
    if (!value) return 'TT.MM.JJJJ';
    const parts = value.split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }, [value]);

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && 
           viewDate.getMonth() === today.getMonth() && 
           viewDate.getFullYear() === today.getFullYear();
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split('-').map(Number);
    return d === day && (m - 1) === viewDate.getMonth() && y === viewDate.getFullYear();
  };

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const y = viewDate.getFullYear();
    const m = (viewDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${y}-${m}-${d}` < minDate;
  };

  return (
    <div className="flex-1 relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest px-1">
        {label}
      </label>
      
      <div 
        onClick={() => setIsOpen(true)}
        className={`w-full px-5 py-3 rounded-2xl border transition-all flex justify-between items-center cursor-pointer select-none group shadow-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-700`}
      >
        <span className={`font-mono text-sm font-bold ${!value ? 'text-slate-300' : 'text-slate-900 dark:text-slate-100'}`}>
          {formattedDisplay}
        </span>
        <span className={`text-lg transition-transform duration-300 opacity-60 group-hover:scale-110`}>📅</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Centered Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-[360px] bg-white dark:bg-slate-900 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800 p-8 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
              <button 
                onClick={(e) => { e.stopPropagation(); changeMonth(-1); }}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                ❮
              </button>
              <div className="flex flex-col items-center">
                <span className="font-black text-slate-900 dark:text-slate-100 text-base uppercase tracking-tight">
                  {GERMAN_MONTHS[viewDate.getMonth()]}
                </span>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">
                  {viewDate.getFullYear()}
                </span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); changeMonth(1); }}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                ❯
              </button>
            </div>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 text-center mb-4">
              {GERMAN_DAYS.map(d => (
                <span key={d} className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">{d}</span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysInMonth.map((day, idx) => (
                <div key={idx} className="aspect-square flex items-center justify-center relative">
                  {day !== null ? (
                    <>
                      <button
                        disabled={isDisabled(day)}
                        onClick={(e) => { e.stopPropagation(); handleDaySelect(day); }}
                        className={`w-11 h-11 rounded-2xl text-xs font-black transition-all flex items-center justify-center relative z-10 ${
                          isSelected(day) 
                            ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/30' 
                            : isDisabled(day) 
                              ? 'text-slate-200 dark:text-slate-800 cursor-not-allowed opacity-30' 
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {day}
                      </button>
                      {isToday(day) && !isSelected(day) && (
                        <div className="absolute bottom-1 w-1.5 h-1.5 bg-blue-500 rounded-full z-20" />
                      )}
                    </>
                  ) : (
                    <div className="w-11 h-11" />
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col space-y-4">
              <button 
                onClick={(e) => { 
                  e.stopPropagation();
                  const now = new Date();
                  const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
                  if (minDate && todayStr < minDate) {
                    const md = new Date(minDate);
                    setViewDate(new Date(md.getFullYear(), md.getMonth(), 1));
                  } else {
                    onChange(todayStr);
                    setIsOpen(false);
                  }
                }}
                className="w-full py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                Heute auswählen
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-full py-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
