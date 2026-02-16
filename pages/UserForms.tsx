
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, FormTemplate, Assignment, TranslationSet, FacilityException, FormResponse, FacilityType, Facility } from '../types';

const SignaturePad: React.FC<{ onEnd: () => void; canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({ onEnd, canvasRef }) => {
  const [isDrawing, setIsDrawing] = useState(false);
  
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const coords = getCoordinates(e);
    if (!coords || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => { if (!isDrawing) return; setIsDrawing(false); onEnd(); };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onEnd();
  };

  useEffect(() => {
    const preventDefault = (e: TouchEvent) => { if (isDrawing) e.preventDefault(); };
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => document.removeEventListener('touchmove', preventDefault);
  }, [isDrawing]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unterschrift (Feld unten)</label>
        <button onClick={clearCanvas} className="text-[10px] font-black text-blue-600 hover:text-blue-400 uppercase tracking-widest transition-colors">Löschen</button>
      </div>
      <div className="relative h-48 w-full bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 overflow-hidden cursor-crosshair group shadow-inner">
        <canvas ref={canvasRef} width={800} height={192} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className="w-full h-full" />
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none opacity-20">
           <div className="w-64 h-0.5 bg-slate-400" />
           <p className="text-[9px] font-bold text-slate-400 text-center mt-2 uppercase tracking-widest">Signaturlinie</p>
        </div>
      </div>
    </div>
  );
};

interface UserFormsProps {
  t: TranslationSet;
  user: User;
  forms: FormTemplate[];
  assignments: Assignment[];
  excludedFacilities: FacilityException[];
  facilityTypes: FacilityType[];
  facilities: Facility[];
  onSave: (response: FormResponse) => void;
  formResponses: FormResponse[];
}

export const UserForms: React.FC<UserFormsProps> = ({ t, user, forms, assignments, excludedFacilities, facilityTypes, facilities, onSave, formResponses }) => {
  const [selectedForm, setSelectedForm] = useState<FormTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [supervisorVisited, setSupervisorVisited] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const myFacility = useMemo(() => facilities.find(f => f.id === user.facilityId), [facilities, user.facilityId]);

  const activeExclusion = useMemo(() => {
    if (!user.facilityId) return null;
    return (excludedFacilities || []).find(ex => 
      ex.facilityIds.includes(user.facilityId!) && 
      todayStr >= ex.startDate && todayStr <= ex.endDate
    );
  }, [excludedFacilities, user.facilityId, todayStr]);

  const activeForms = useMemo(() => {
    if (activeExclusion) return [];
    
    const isWorkingDay = (dateStr: string, skipW: boolean, skipH: boolean) => {
      const d = new Date(dateStr);
      const day = d.getDay();
      if (skipW && (day === 0 || day === 6)) return false;
      return true;
    };

    const assigned = (assignments || []).filter(a => {
      const isUserMatch = a.targetType === 'user' && a.targetId === user.id;
      const isFacMatch = a.targetType === 'facility' && a.targetId === user.facilityId;
      const isTypeMatch = a.targetType === 'facilityType' && a.targetId === myFacility?.typeId;
      
      const isActive = todayStr >= a.startDate && todayStr <= a.endDate;
      const isTodayWorking = isWorkingDay(todayStr, a.skipWeekend, a.skipHolidays);
      return a.resourceType === 'form' && (isUserMatch || isFacMatch || isTypeMatch) && isActive && isTodayWorking;
    });

    const templates = assigned
      .map(a => forms.find(f => f.id === a.resourceId))
      .filter(Boolean) as FormTemplate[];

    return templates.filter(f => {
      return !(formResponses || []).some(fr => 
        fr.formId === f.id && 
        fr.timestamp.startsWith(todayStr) &&
        (fr.userId === user.id || fr.facilityId === user.facilityId)
      );
    });
  }, [assignments, user, forms, activeExclusion, todayStr, formResponses, myFacility]);

  const handleOpenForm = (form: FormTemplate) => {
    setSelectedForm(form);
    setAnswers({});
    setSupervisorVisited(null);
    setHasSignature(false);
    setError(null);
  };

  const handleSetAnswer = (qId: string, val: string) => {
    setAnswers(prev => ({ ...prev, [qId]: val }));
    setError(null);
  };

  const handleSaveForm = () => {
    if (!selectedForm) return;
    
    if (!supervisorVisited) {
       setError("Bitte geben Sie an, ob der Supervisor heute vor Ort war.");
       return;
    }

    const unansweredCount = selectedForm.questions.filter(q => !answers[q.id]).length;
    if (unansweredCount > 0) {
      setError(`Bitte beantworten Sie alle Fragen (${unansweredCount} offen).`);
      return;
    }

    let signatureData = undefined;
    if (selectedForm.requiresSignature) {
        if (!hasSignature || !signatureCanvasRef.current) {
            setError("Bitte unterschreiben Sie das Formular.");
            return;
        }
        signatureData = signatureCanvasRef.current.toDataURL('image/png');
    }

    const finalAnswers = { ...answers, "SUPERVISOR_VISIT": supervisorVisited };

    const newResponse: FormResponse = {
      id: `RESP-${Date.now()}`,
      formId: selectedForm.id,
      facilityId: user.facilityId || 'UNKNOWN',
      userId: user.id,
      timestamp: new Date().toISOString(),
      answers: finalAnswers,
      signature: signatureData
    };

    onSave(newResponse);
    setSelectedForm(null);
    setAnswers({});
    setSupervisorVisited(null);
    setHasSignature(false);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 text-left">
      <header className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{t.tabs.user_forms}</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight">Einhaltung gesetzlicher Dokumentationspflichten</p>
        </div>
        <div className="flex items-center space-x-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
           <span className="text-[10px] font-black text-slate-400 uppercase">Status per:</span>
           <span className="text-xs font-black text-blue-600 uppercase">{todayStr.split('-').reverse().join('.')}</span>
        </div>
      </header>

      {activeExclusion ? (
        <div className="bg-white min-h-[400px] rounded-[3.5rem] border-2 border-slate-100 flex flex-col items-center justify-center p-12 text-center shadow-xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-amber-500" />
          <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">🚫</div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase">Standort vorübergehend ausgesetzt</h2>
          <p className="text-slate-500 max-w-md font-medium">{activeExclusion.reason}</p>
        </div>
      ) : activeForms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeForms.map((form, i) => (
            <div key={`${form.id}-${i}`} onClick={() => handleOpenForm(form)} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all group cursor-pointer flex flex-col justify-between">
              <div>
                <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">📝</div>
                <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{form.title}</h3>
                <div className="flex items-center space-x-2">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{form.questions.length} Prüfpunkte</span>
                   <span className="text-[10px] text-slate-300">•</span>
                   <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Ausstehend</span>
                </div>
              </div>
              <div className="pt-8 flex justify-end">
                 <button className="bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-blue-600 transition-colors">Starten ➞</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white min-h-[400px] rounded-[3.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-12 text-center">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-inner">🏆</div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Alle Aufgaben erledigt</h2>
          <p className="text-slate-500 max-w-xs font-medium">Es sind momentan keine weiteren Checklisten für heute ausstehend.</p>
        </div>
      )}

      {selectedForm && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden text-left border border-white/5 relative">
              {error && (
                <div className="absolute top-0 left-0 w-full z-[60] p-6 animate-in slide-in-from-top-4 duration-300">
                   <div className="bg-rose-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between border border-white/20">
                     <div className="flex items-center space-x-3">
                        <span className="text-xl">⚠️</span>
                        <span className="font-black text-sm uppercase tracking-tight">{error}</span>
                     </div>
                     <button onClick={() => setError(null)} className="text-white/60 hover:text-white">✕</button>
                   </div>
                </div>
              )}
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                 <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{selectedForm.title}</h3>
                   <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fortschritt:</span>
                      <span className="text-[10px] font-black text-blue-600">{Object.keys(answers).length + (supervisorVisited ? 1 : 0)} von {selectedForm.questions.length + 1}</span>
                   </div>
                 </div>
                 <button onClick={() => setSelectedForm(null)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 text-slate-500 hover:scale-110 transition-all font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 sm:p-12 space-y-12 custom-scrollbar">
                 {/* MANDATORY SUPERVISOR QUESTION */}
                 <div className="p-8 bg-blue-50/50 rounded-[2.5rem] border-2 border-blue-100 space-y-6 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center space-x-4">
                       <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center text-lg">🛡️</div>
                       <label className="text-lg font-black text-slate-900 leading-snug">Hat der Supervisor heute persönlich am Standort vorbeigeschaut?</label>
                    </div>
                    <div className="flex space-x-4">
                       <button 
                         onClick={() => setSupervisorVisited('YES')}
                         className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black text-sm transition-all ${supervisorVisited === 'YES' ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-105' : 'bg-white border-blue-100 text-blue-400 hover:bg-blue-50'}`}
                       >
                         JA, WAR DA
                       </button>
                       <button 
                         onClick={() => setSupervisorVisited('NO')}
                         className={`flex-1 py-5 rounded-[1.5rem] border-2 font-black text-sm transition-all ${supervisorVisited === 'NO' ? 'bg-slate-900 border-slate-900 text-white shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                       >
                         NEIN, NICHT GESEHEN
                       </button>
                    </div>
                 </div>

                 <div className="space-y-12 border-t border-slate-100 pt-12">
                    {selectedForm.questions.map((q, idx) => (
                      <div key={q.id} className="space-y-5 animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${(idx + 1) * 100}ms` }}>
                        <div className="flex items-start space-x-4">
                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 shrink-0">{idx + 2}</div>
                           <label className="block text-sm font-black text-slate-800 leading-snug">{q.text}</label>
                        </div>
                        <div className="pl-12">
                          {q.type === 'yesno' && (
                            <div className="flex space-x-3">
                              <button onClick={() => handleSetAnswer(q.id, 'YES')} className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${answers[q.id] === 'YES' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>JA</button>
                              <button onClick={() => handleSetAnswer(q.id, 'NO')} className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${answers[q.id] === 'NO' ? 'bg-rose-500 border-rose-500 text-white shadow-lg' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}>NEIN</button>
                            </div>
                          )}
                          {q.type === 'text' && (
                            <input type="text" value={answers[q.id] || ''} onChange={(e) => handleSetAnswer(q.id, e.target.value)} className="w-full px-5 py-4 rounded-2xl bg-slate-50 border border-slate-100 outline-none font-bold text-sm focus:ring-4 focus:ring-blue-500/10 text-slate-900" placeholder="Antwort eingeben..." />
                          )}
                          {q.type === 'choice' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {q.options?.map(opt => (
                                <button key={opt.id} onClick={() => handleSetAnswer(q.id, opt.text)} className={`w-full py-4 px-6 rounded-2xl border-2 text-left font-bold text-xs transition-all ${answers[q.id] === opt.text ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>{opt.text}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                 </div>
                 {selectedForm.requiresSignature && (
                    <div className="pt-12 border-t border-slate-100 animate-in fade-in duration-700 delay-300">
                       <SignaturePad canvasRef={signatureCanvasRef} onEnd={() => setHasSignature(true)} />
                    </div>
                 )}
              </div>
              <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4">
                 <button onClick={() => setSelectedForm(null)} className="flex-1 py-4 text-slate-500 font-black uppercase text-xs tracking-widest">Abbrechen</button>
                 <button onClick={handleSaveForm} className={`flex-1 py-4 rounded-2xl font-black shadow-xl transition-all ${ (Object.keys(answers).length === selectedForm.questions.length && supervisorVisited) ? 'bg-blue-600 text-white shadow-blue-500/20 hover:scale-105 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>Absenden & Signieren</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
