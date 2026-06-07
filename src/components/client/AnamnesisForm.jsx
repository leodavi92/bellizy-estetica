import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  Save, 
  X, 
  ArrowRight,
  AlertCircle,
  FileText,
  Layout,
  Star,
  PenTool,
  RotateCcw
} from 'lucide-react';
import { anamnesisService } from '../../services/anamnesisService';
import { motion, AnimatePresence } from 'framer-motion';

// Componente simples de Assinatura usando Canvas
const SignaturePad = ({ onSave, onClear }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    onSave(canvasRef.current.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="space-y-3">
      <div className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[200px] cursor-crosshair"
        />
        <button
          type="button"
          onClick={clear}
          className="absolute bottom-4 right-4 p-2 bg-white text-slate-400 hover:text-pink-600 rounded-xl shadow-sm border border-slate-100 transition-all"
          title="Limpar assinatura"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <p className="text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest">Assine acima para confirmar a veracidade das informações</p>
    </div>
  );
};

export default function AnamnesisForm({ template, appointmentId, customerId, establishmentId, onComplete, onCancel }) {
  const [answers, setAnswers] = useState({});
  const [signature, setSignature] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    // Inicializa as respostas
    if (template?.perguntas) {
      const initial = {};
      template.perguntas.forEach(q => {
        if (q.tipo === 'yes_no_with_text') {
          initial[q.id] = { choice: null, text: '' };
        } else {
          initial[q.id] = q.tipo === 'multiple_choice' ? [] : (q.tipo === 'yes_no' ? null : '');
        }
      });
      setAnswers(initial);
    }
  }, [template]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar obrigatórias
    const missing = template.perguntas.filter(q => {
      if (!q.obrigatoria) return false;
      const ans = answers[q.id];
      if (q.tipo === 'multiple_choice') return !ans || ans.length === 0;
      if (q.tipo === 'yes_no') return ans === null;
      if (q.tipo === 'yes_no_with_text') {
        if (ans.choice === null) return true;
        if (ans.choice === 'Sim' && !ans.text?.trim()) return true;
        return false;
      }
      return !ans || ans.trim() === '';
    });

    if (missing.length > 0) {
      setError(`Por favor, responda todas as perguntas obrigatórias.`);
      return;
    }

    if (!consent) {
      setError("Você precisa aceitar os termos de consentimento.");
      return;
    }

    if (!signature) {
      setError("A assinatura digital é obrigatória.");
      return;
    }

    setSaving(true);
    try {
      // Prepara as respostas com o enunciado da pergunta para consulta histórica
      const respostasComEnunciado = {};
      template.perguntas.forEach(q => {
        respostasComEnunciado[q.id] = {
          enunciado: q.enunciado,
          resposta: answers[q.id]
        };
      });

      await anamnesisService.saveResponse(establishmentId, customerId, {
        template_id: template.id,
        template_nome: template.nome,
        appointment_id: appointmentId || 'manual',
        respostas: respostasComEnunciado,
        assinatura: signature,
        consentimento: true,
        preenchidoEm: new Date().toISOString()
      });
      onComplete();
    } catch (err) {
      setError("Erro ao salvar suas respostas. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setError(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center">
            <ClipboardList size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{template.nome}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ficha de Avaliação Profissional</p>
          </div>
        </div>
        <button type="button" onClick={onCancel} className="p-2 text-slate-300 hover:text-slate-600 transition-all">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-10">
        {template.descricao && (
          <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
            <div className="flex items-start gap-3">
              <Star size={18} className="text-pink-500 shrink-0 mt-0.5" fill="currentColor" />
              <p className="text-xs font-medium text-slate-600 leading-relaxed italic">{template.descricao}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 animate-shake border border-red-100">
            <AlertCircle size={20} />
            <p className="text-xs font-bold">{error}</p>
          </div>
        )}

        {/* Perguntas */}
        <div className="space-y-12">
          {template.perguntas.map((q, idx) => (
            <div key={q.id} className="space-y-5">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <label className="text-sm font-black text-slate-800 leading-tight uppercase tracking-tight">
                  {q.enunciado}
                  {q.obrigatoria && <span className="text-pink-500 ml-1">*</span>}
                </label>
              </div>

              {/* Renderização Dinâmica por Tipo */}
              <div className="pl-9">
                {q.tipo === 'text' && (
                  <input 
                    type="text"
                    value={answers[q.id] || ''}
                    onChange={e => handleAnswer(q.id, e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                    placeholder="Sua resposta..."
                  />
                )}

                {q.tipo === 'long_text' && (
                  <textarea 
                    rows={3}
                    value={answers[q.id] || ''}
                    onChange={e => handleAnswer(q.id, e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-transparent rounded-2xl outline-none focus:border-pink-300 focus:bg-white transition-all font-bold text-slate-700 text-sm resize-none shadow-sm"
                    placeholder="Sua resposta detalhada..."
                  />
                )}

                {q.tipo === 'yes_no' && (
                  <div className="flex gap-3">
                    {['Sim', 'Não'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleAnswer(q.id, opt)}
                        className={`flex-1 py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                          answers[q.id] === opt
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                          : 'bg-white border-slate-100 text-slate-400 hover:border-pink-200 hover:text-pink-600'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {q.tipo === 'yes_no_with_text' && (
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      {['Sim', 'Não'].map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswer(q.id, { ...answers[q.id], choice: opt })}
                          className={`flex-1 py-4 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${
                            answers[q.id]?.choice === opt
                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                            : 'bg-white border-slate-100 text-slate-400 hover:border-pink-200 hover:text-pink-600'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    
                    <AnimatePresence>
                      {answers[q.id]?.choice === 'Sim' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <textarea 
                            rows={2}
                            value={answers[q.id]?.text || ''}
                            onChange={e => handleAnswer(q.id, { ...answers[q.id], text: e.target.value })}
                            className="w-full p-4 bg-pink-50/30 border-2 border-pink-100 rounded-2xl outline-none focus:border-pink-300 focus:bg-white transition-all font-bold text-slate-700 text-sm resize-none"
                            placeholder="Por favor, detalhe aqui..."
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {q.tipo === 'multiple_choice' && (
                  <div className="grid grid-cols-1 gap-2">
                    {q.opcoes?.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = answers[q.id] || [];
                          if (current.includes(opt)) {
                            handleAnswer(q.id, current.filter(o => o !== opt));
                          } else {
                            handleAnswer(q.id, [...current, opt]);
                          }
                        }}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                          (answers[q.id] || []).includes(opt)
                          ? 'bg-pink-50 border-pink-200 text-pink-700 font-bold shadow-sm'
                          : 'bg-white border-slate-50 text-slate-600 hover:border-pink-100'
                        }`}
                      >
                        <span className="text-sm">{opt}</span>
                        {(answers[q.id] || []).includes(opt) && <CheckCircle2 size={16} className="text-pink-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Termo de Consentimento */}
          <div className="space-y-6 pt-10 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <FileText size={20} />
              </div>
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Termo de Consentimento</h4>
            </div>

            <div className="p-6 bg-indigo-50/30 border border-indigo-100 rounded-[2rem] space-y-4">
              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                Declaro para os devidos fins que as informações acima prestadas são verdadeiras e estou ciente de que a omissão de dados sobre minha saúde pode comprometer o resultado do procedimento e colocar em risco minha integridade física. Autorizo a realização do procedimento e confirmo que recebi todas as orientações necessárias.
              </p>
              
              <button
                type="button"
                onClick={() => setConsent(!consent)}
                className="flex items-center gap-3 group"
              >
                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${consent ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200 group-hover:border-indigo-300'}`}>
                  {consent && <CheckCircle2 size={16} className="text-white" />}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${consent ? 'text-indigo-600' : 'text-slate-400'}`}>Li e aceito os termos</span>
              </button>
            </div>
          </div>

          {/* Assinatura */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                <PenTool size={20} />
              </div>
              <h4 className="font-black text-slate-800 uppercase tracking-tight">Assinatura Digital</h4>
            </div>

            <SignaturePad 
              onSave={(data) => setSignature(data)}
              onClear={() => setSignature(null)}
            />
          </div>
        </div>
      </form>

      <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center gap-3 shrink-0">
        <button 
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all"
        >
          Cancelar
        </button>
        <button 
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-[2] py-4 bg-slate-950 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-800 shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Salvando...' : 'Finalizar e Salvar'}
        </button>
      </div>
    </div>
  );
}
