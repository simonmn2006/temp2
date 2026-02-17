
import React, { useState, useMemo } from 'react';
import { TranslationSet, FormTemplate, FormQuestion, QuestionType, FormOption } from '../types';

interface FormCreatorPageProps {
  t: TranslationSet;
  forms: FormTemplate[];
  setForms: React.Dispatch<React.SetStateAction<FormTemplate[]>>;
  onSync: (form: FormTemplate, del?: boolean) => void;
}

export const FormCreatorPage: React.FC<FormCreatorPageProps> = ({ t, forms, setForms, onSync }) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [previewForm, setPreviewForm] = useState<FormTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [formToDelete, setFormToDelete] = useState<FormTemplate | null>(null);

  const [builderTitle, setBuilderTitle] = useState('');
  const [builderQuestions, setBuilderQuestions] = useState<FormQuestion[]>([]);
  const [builderSignature, setBuilderSignature] = useState(true);

  const showAlert = (text: string, type: 'error' | 'success' = 'error') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 3000);
  };

  const filteredForms = useMemo(() => {
    return forms.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [forms, searchTerm]);

  const openBuilder = (form?: FormTemplate) => {
    setAlertMsg(null);
    setInvalidFields(new Set());
    if (form) {
      setEditingForm(form);
      setBuilderTitle(form.title);
      setBuilderQuestions(form.questions);
      setBuilderSignature(form.requiresSignature);
    } else {
      setEditingForm(null);
      setBuilderTitle('');
      setBuilderQuestions([{ id: Date.now().toString(), text: '', type: 'text', options: [] }]);
      setBuilderSignature(true);
    }
    setIsBuilderOpen(true);
  };

  const addQuestion = () => {
    setBuilderQuestions([...builderQuestions, { id: Date.now().toString(), text: '', type: 'text', options: [] }]);
  };

  const removeQuestion = (id: string) => {
    setBuilderQuestions(builderQuestions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    setBuilderQuestions(builderQuestions.map(q => q.id === id ? { ...q, ...updates } : q));
    if (updates.text && invalidFields.has(`q-${id}-text`)) {
      const n = new Set(invalidFields);
      n.delete(`q-${id}-text`);
      setInvalidFields(n);
    }
  };

  const addOption = (qId: string) => {
    setBuilderQuestions(builderQuestions.map(q => {
      if (q.id === qId) {
        const newOpts = [...(q.options || []), { id: Date.now().toString(), text: '' }];
        return { ...q, options: newOpts };
      }
      return q;
    }));
  };

  const removeOption = (qId: string, optId: string) => {
    setBuilderQuestions(builderQuestions.map(q => {
      if (q.id === qId) {
        return { ...q, options: q.options?.filter(o => o.id !== optId) };
      }
      return q;
    }));
  };

  const updateOption = (qId: string, optId: string, text: string) => {
    setBuilderQuestions(builderQuestions.map(q => {
      if (q.id === qId) {
        return { ...q, options: q.options?.map(o => o.id === optId ? { ...o, text } : o) };
      }
      return q;
    }));
  };

  const saveForm = () => {
    const errors = new Set<string>();
    if (!builderTitle.trim()) errors.add('title');
    builderQuestions.forEach(q => {
      if (!q.text.trim()) errors.add(`q-${q.id}-text`);
      if (q.type === 'choice' && (!q.options || q.options.length === 0)) {
        errors.add(`q-${q.id}-options`);
      }
    });

    if (errors.size > 0) {
      setInvalidFields(errors);
      showAlert("Bitte füllen Sie alle markierten Pflichtfelder aus.", 'error');
      return;
    }

    const newForm: FormTemplate = {
      id: editingForm?.id || `FRM-${Date.now().toString().substr(-5)}`,
      title: builderTitle,
      description: '',
      questions: builderQuestions,
      requiresSignature: builderSignature,
      createdAt: editingForm?.createdAt || new Date().toISOString().split('T')[0]
    };

    if (editingForm) {
      setForms(prev => prev.map(f => f.id === editingForm.id ? newForm : f));
      showAlert(`Formular "${builderTitle}" aktualisiert.`, 'success');
    } else {
      setForms(prev => [...prev, newForm]);
      showAlert(`Formular "${builderTitle}" erstellt.`, 'success');
    }
    onSync(newForm);
    setIsBuilderOpen(false);
  };

  const confirmDelete = () => {
    if (formToDelete) {
      const title = formToDelete.title;
      setForms(prev => prev.filter(f => f.id !== formToDelete.id));
      onSync(formToDelete, true);
      showAlert(`Formular "${title}" gelöscht.`, 'success');
      setFormToDelete(null);
    }
  };

  const getFieldClass = (key: string, base: string = "w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border font-bold outline-none transition-all") => {
    if (invalidFields.has(key)) {
      return `${base} border-rose-500 ring-4 ring-rose-500/10 animate-shake`;
    }
    return `${base} border-slate-200 dark:border-slate-700 focus:ring-4 focus:ring-blue-500/10`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      {alertMsg && !isBuilderOpen && !formToDelete && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className={`${alertMsg.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'} text-white px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 border border-white/20`}>
             <span className="text-xl">{alertMsg.type === 'success' ? '✅' : '⚠️'}</span>
             <span className="font-black text-sm uppercase tracking-tight">{alertMsg.text}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.tabs.form_creator}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Erstellung und Verwaltung digitaler Prüflisten</p>
        </div>
        <button onClick={() => openBuilder()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98]">+ Neues Formular</button>
      </div>

      <div className="relative w-full max-w-2xl text-left">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input 
          type="text" 
          placeholder="Checklisten suchen..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 font-bold transition-all shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map(form => (
            <div key={form.id} className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 hover:shadow-2xl transition-all group relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 p-6 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openBuilder(form)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:scale-110 transition-transform">✏️</button>
                <button onClick={() => setFormToDelete(form)} className="p-2 bg-rose-50 text-rose-600 rounded-xl hover:scale-110 transition-transform">🗑️</button>
              </div>
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-xl mb-6 shadow-inner">📝</div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 leading-tight">{form.title}</h3>
              <div className="flex items-center justify-between pt-8 mt-6 border-t border-slate-50 dark:border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{form.questions.length} Fragen</span>
                <button onClick={() => setPreviewForm(form)} className="text-blue-600 font-bold text-sm hover:underline">Vorschau ➞</button>
              </div>
            </div>
          ))}
          {filteredForms.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 font-bold text-sm uppercase italic">Keine Formulare gefunden</div>
          )}
      </div>

      {formToDelete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] p-10 shadow-2xl border border-rose-500/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase">Formular löschen?</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">"{formToDelete.title}" wird permanent aus der Liste entfernt.</p>
            <div className="flex flex-col space-y-3">
              <button onClick={confirmDelete} className="w-full bg-rose-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-rose-500/20 transition-all">JA, LÖSCHEN</button>
              <button onClick={() => setFormToDelete(null)} className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black py-4 rounded-2xl transition-all">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      {isBuilderOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 text-left relative">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{editingForm ? 'Formular bearbeiten' : 'Neues Formular'}</h3>
              <button onClick={() => setIsBuilderOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-bold">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar pb-32">
              {alertMsg && alertMsg.type === 'error' && (
                <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-bold border border-rose-100 animate-in slide-in-from-top-2">
                  ⚠️ {alertMsg.text}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Titel der Checkliste</label>
                <input 
                  type="text" 
                  value={builderTitle} 
                  onChange={e => {
                    setBuilderTitle(e.target.value);
                    if (invalidFields.has('title')) {
                        const n = new Set(invalidFields);
                        n.delete('title');
                        setInvalidFields(n);
                    }
                  }} 
                  className={getFieldClass('title', "w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border font-bold outline-none transition-all text-lg shadow-inner")} 
                  placeholder="z.B. Monatliche Hygiene-Prüfung"
                />
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fragen-Katalog</h4>
                   <button onClick={addQuestion} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest">+ Frage hinzufügen</button>
                </div>
                {builderQuestions.map((q, idx) => (
                  <div key={q.id} className="p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-6 relative group/q">
                    <button onClick={() => removeQuestion(q.id)} className="absolute top-6 right-6 p-2 text-rose-500 opacity-0 group-hover/q:opacity-100 transition-opacity">🗑️</button>
                    <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 dark:border-slate-600">{idx+1}</span>
                        <div className="flex space-x-2">
                           {(['text', 'choice', 'yesno'] as QuestionType[]).map(type => (
                             <button key={type} onClick={() => updateQuestion(q.id, { type })} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${q.type === type ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-700 text-slate-400'}`}>
                               {type === 'text' ? 'Text' : type === 'choice' ? 'Auswahl' : 'Ja/Nein'}
                             </button>
                           ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Fragetext</label>
                        <input 
                          type="text" 
                          value={q.text} 
                          onChange={e => updateQuestion(q.id, { text: e.target.value })} 
                          className={getFieldClass(`q-${q.id}-text`, "w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900 border font-bold text-sm outline-none transition-all")} 
                          placeholder="z.B. Wurden die Oberflächen desinfiziert?"
                        />
                    </div>
                    {q.type === 'choice' && (
                       <div className="pl-8 space-y-3">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest px-1">Optionen</label>
                          {q.options?.map(opt => (
                            <div key={opt.id} className="flex items-center space-x-2">
                               <input type="text" value={opt.text} onChange={e => updateOption(q.id, opt.id, e.target.value)} className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 text-xs font-bold" placeholder="Optionstext..." />
                               <button onClick={() => removeOption(q.id, opt.id)} className="text-rose-500 p-2">✕</button>
                            </div>
                          ))}
                          <button onClick={() => addOption(q.id)} className="text-[9px] font-black text-blue-600 uppercase tracking-widest px-1">+ Option hinzufügen</button>
                       </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-8 rounded-[2.5rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                 <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center text-xl shadow-sm">✍️</div>
                    <div>
                       <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">Digitale Signatur erzwingen</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">Protokoll muss zum Abschluss signiert werden</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setBuilderSignature(!builderSignature)}
                   className={`w-14 h-8 rounded-full transition-all relative ${builderSignature ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                 >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${builderSignature ? 'left-7' : 'left-1'}`} />
                 </button>
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-4 bg-slate-50/50 dark:bg-slate-800/50">
              <button onClick={() => setIsBuilderOpen(false)} className="px-6 py-3 text-slate-500 font-black uppercase text-xs">Abbrechen</button>
              <button onClick={saveForm} className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
