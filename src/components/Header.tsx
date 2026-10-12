import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Radio, Cpu, Clock, AlertTriangle, ArrowRight, X, MessageSquare, Mail, Settings } from 'lucide-react';
import { ModoInfo, AppSettings } from '../types';

interface Props {
  currentTab: 'asistencia' | 'estudiantes';
  onSelectTab: (tab: 'asistencia' | 'estudiantes') => void;
  modoInfo: ModoInfo;
  onCancelModoRegistro: () => void;
  showSimulator: boolean;
  onToggleSimulator: () => void;
  pendingCardUid: string | null;
  appSettings?: AppSettings | null;
  onOpenSettings?: () => void;
}

export const Header: React.FC<Props> = ({
  currentTab,
  onSelectTab,
  modoInfo,
  onCancelModoRegistro,
  showSimulator,
  onToggleSimulator,
  pendingCardUid,
  appSettings,
  onOpenSettings
}) => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');

  const nombreColegio = appSettings?.nombre_colegio || 'I.E. SAN NICOLÁS DE TOLENTINO';
  const lemaColegio = appSettings?.lema_colegio || 'Interioridad • Amor • Trascendencia';
  const logoUrl = appSettings?.logo_url || '/static/logo.svg';
  const grado = appSettings?.grado || '6° - 1';
  const salon = appSettings?.salon || 'INFORMÁTICA';

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
      setDateStr(
        now.toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isModoRegistro = modoInfo.modo === 'registro';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Banner: Modo Registro Warning */}
      {isModoRegistro && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 font-bold shadow-md animate-pulse">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1 bg-white/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-slate-950" />
              </span>
              <div>
                <span className="text-sm font-black tracking-wide uppercase">
                  MODO REGISTRO DE TARJETAS ACTIVO
                </span>
                <span className="mx-2 text-slate-800">•</span>
                <span className="text-sm font-extrabold bg-slate-900 text-amber-400 px-2.5 py-0.5 rounded-full font-mono">
                  {modoInfo.segundos_restantes} s restantes
                </span>
                <span className="hidden md:inline ml-2 text-xs font-semibold text-slate-900">
                  (En este modo NUNCA se marca asistencia; el lector capturará el UID)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pendingCardUid && (
                <div className="bg-white text-slate-900 px-3 py-1 rounded-md text-xs font-mono font-bold shadow-xs">
                  UID Capturado: <span className="text-blue-700">{pendingCardUid}</span>
                </div>
              )}
              <button
                onClick={onCancelModoRegistro}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-950 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Cancelar y Volver a Asistencia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & School Identity */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-13 h-13 shrink-0 bg-white border-2 border-red-500/40 rounded-2xl p-1 shadow-md flex items-center justify-center overflow-hidden">
              <img
                src={logoUrl}
                alt={`Escudo ${nombreColegio}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none uppercase">
                  {nombreColegio}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800 rounded-full border border-red-200">
                  {grado} • {salon.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-amber-700 font-bold mt-0.5 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600"></span>
                <span>{lemaColegio}</span>
              </p>
            </div>
          </div>

          {/* Clock & Status */}
          <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200/60 text-right">
            <Clock className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <div className="text-sm font-black text-slate-800 font-mono tracking-wider">
                {timeStr || '--:--:--'}
              </div>
              <div className="text-[11px] text-slate-500 capitalize">
                {dateStr || 'Cargando fecha...'}
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onSelectTab('asistencia')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'asistencia'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Asistencia</span>
            </button>

            <button
              onClick={() => onSelectTab('estudiantes')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'estudiantes'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/30'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Estudiantes</span>
            </button>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-linear-to-r from-slate-900 via-slate-800 to-slate-950 hover:from-slate-800 hover:to-slate-900 text-white shadow-md transition-all cursor-pointer hover:scale-102"
                title="Ajustes generales: Colegio, Logo, Lema, Horarios, Tolerancia, Salón, Materia y Endpoint ESP8266"
              >
                <Settings className="w-4 h-4 text-amber-300 animate-spin-slow" />
                <span>Ajustes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

