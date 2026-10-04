import React, { useState } from 'react';
import { Radio, Send, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Estudiante } from '../types';

interface Props {
  students: Estudiante[];
  salones: string[];
  onTriggerScan: (uid: string, salon: string) => Promise<any>;
}

export const SimulatorBar: React.FC<Props> = ({ students, salones, onTriggerScan }) => {
  const [customUid, setCustomUid] = useState('');
  const [selectedSalon, setSelectedSalon] = useState('Salon-101');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleSimulate = async (uidToTest: string) => {
    if (!uidToTest.trim() || loading) return;
    setLoading(true);
    try {
      const res = await onTriggerScan(uidToTest, selectedSalon);
      setLastResult(res);
    } catch (err: any) {
      setLastResult({ ok: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const sampleUnknownUids = ['99AA88BB', 'F140D2C8', '04E2719B'];

  return (
    <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white border-b border-purple-800/50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Title & Tag */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="p-2 bg-purple-500/20 rounded-xl text-purple-300 border border-purple-400/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wider text-purple-300 uppercase">
                  Simulador de Hardware ESP8266
                </span>
                <span className="text-[10px] bg-purple-400/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-400/30">
                  POST /api/lectura
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Pruebe el paso de tarjetas sin necesidad de tener el lector físico conectado
              </p>
            </div>
          </div>

          {/* Quick preset card buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-purple-300 font-semibold mr-1">Tarjetas rápidas:</span>
            {students.slice(0, 3).map((st) => (
              <button
                key={st.id}
                onClick={() => handleSimulate(st.uid)}
                disabled={loading}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-xs rounded-lg transition-all border border-white/15 text-slate-200 font-medium flex items-center gap-1.5"
                title={`Simular tarjeta de ${st.nombre}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>{st.nombre.split(' ')[0]}</span>
                <span className="font-mono text-[10px] opacity-70">({st.uid})</span>
              </button>
            ))}

            <button
              onClick={() => handleSimulate(sampleUnknownUids[0])}
              disabled={loading}
              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 text-xs rounded-lg transition-all border border-rose-400/30 text-rose-200 font-medium flex items-center gap-1.5"
              title="Simular tarjeta no registrada (desconocida)"
            >
              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
              <span>No Registrada</span>
              <span className="font-mono text-[10px] opacity-80">({sampleUnknownUids[0]})</span>
            </button>
          </div>

          {/* Salon selector & Custom UID trigger */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <select
              value={selectedSalon}
              onChange={(e) => setSelectedSalon(e.target.value)}
              className="bg-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-purple-400"
            >
              {(salones.length > 0 ? salones : ['Salon-101', 'Salon-102', 'Laboratorio', 'Biblioteca']).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>

            <div className="flex items-center gap-1 flex-1 sm:flex-initial">
              <input
                type="text"
                value={customUid}
                onChange={(e) => setCustomUid(e.target.value.toUpperCase())}
                placeholder="UID (ej. A34F129C)"
                maxLength={20}
                className="w-32 sm:w-36 bg-slate-900 border border-slate-700 focus:border-purple-400 text-white text-xs font-mono uppercase px-2.5 py-1.5 rounded-lg tracking-wider placeholder:text-slate-500"
              />
              <button
                onClick={() => handleSimulate(customUid)}
                disabled={loading || !customUid.trim()}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mini status response line */}
        {lastResult && (
          <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">Respuesta recibida:</span>
              <span
                className={`px-2 py-0.5 rounded font-bold ${
                  lastResult.estado === 'asistencia_registrada'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : lastResult.estado === 'ya_registrada_hoy'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : lastResult.estado === 'tarjeta_capturada'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {lastResult.estado || (lastResult.ok ? 'OK' : 'ERROR')}
              </span>
              {lastResult.nombre && (
                <span className="text-slate-200">({lastResult.nombre})</span>
              )}
            </div>

            <button
              onClick={() => setLastResult(null)}
              className="text-[11px] text-slate-400 hover:text-white underline"
            >
              Ocultar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
