import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  X, 
  BookOpen, 
  GraduationCap,
  Phone,
  ShieldCheck,
  UserCheck,
  MessageSquare,
  Send,
  ExternalLink
} from 'lucide-react';
import { Lectura, AppSettings } from '../types';

interface Props {
  lectura: Lectura | null;
  onClose: () => void;
  appSettings?: AppSettings | null;
}

export const AttendanceKioskOverlay: React.FC<Props> = ({ lectura, onClose, appSettings }) => {
  const [progress, setProgress] = useState(100);

  const nombreColegio = appSettings?.nombre_colegio || 'I.E. SAN NICOLÁS DE TOLENTINO';
  const gradoDefault = appSettings?.grado || '6° - 1';
  const salonDefault = appSettings?.salon || 'Salón de Informática';
  const asignaturaDefault = appSettings?.asignatura || 'Informática y Tecnología';
  const horaEntradaDefault = appSettings?.hora_entrada || '08:30';
  const minutosTolerancia = Number(appSettings?.minutos_tolerancia) || 10;

  const lecturaId = lectura?.id;
  const onCloseRef = React.useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!lecturaId) return;
    setProgress(100);

    const startTime = Date.now();
    const duration = 7000; // 7 seconds display for scanning notification

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingPct = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remainingPct);
      if (elapsed >= duration) {
        clearInterval(interval);
        onCloseRef.current();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [lecturaId]);

  if (!lectura) return null;

  const isSalida = lectura.estado === 'salida_registrada';
  const isDuplicate = lectura.estado === 'ya_registrada_hoy';
  const isUnregistered = lectura.estado === 'tarjeta_no_registrada';
  const isSuccess = lectura.estado === 'asistencia_registrada';

  // Extract arrival time e.g. "08:35:10"
  const horaTexto = lectura.fecha_hora ? lectura.fecha_hora.split(' ')[1] || lectura.fecha_hora : '--:--';

  // Dynamic calculation based on configured entry time and tolerance
  const calcularEstadoLlegada = () => {
    try {
      const [hl, ml] = horaTexto.split(':').map(Number);
      const [he, me] = horaEntradaDefault.split(':').map(Number);
      const minutosLlegada = hl * 60 + ml;
      const minutosEntrada = he * 60 + me;
      const minutosLimite = minutosEntrada + minutosTolerancia;

      if (minutosLlegada <= minutosLimite) {
        return { esTarde: false, retraso: 0, horaLimiteStr: `${Math.floor(minutosLimite/60).toString().padStart(2,'0')}:${(minutosLimite%60).toString().padStart(2,'0')}` };
      } else {
        return { esTarde: true, retraso: Math.max(1, minutosLlegada - minutosEntrada), horaLimiteStr: `${Math.floor(minutosLimite/60).toString().padStart(2,'0')}:${(minutosLimite%60).toString().padStart(2,'0')}` };
      }
    } catch {
      return { esTarde: false, retraso: 0, horaLimiteStr: '08:40' };
    }
  };

  const { esTarde, retraso, horaLimiteStr } = calcularEstadoLlegada();

  // Themes
  let theme = {
    bg: esTarde ? 'bg-amber-600' : 'bg-emerald-600',
    headerBg: esTarde ? 'bg-linear-to-r from-amber-600 to-amber-700' : 'bg-linear-to-r from-emerald-600 to-teal-700',
    border: esTarde ? 'border-amber-400' : 'border-emerald-400',
    badgeText: esTarde ? '¡BIENVENIDO/A! - ENTRADA TARDE' : '¡BIENVENIDO/A! - ENTRADA PUNTUAL',
    icon: esTarde ? <AlertTriangle className="w-10 h-10 text-white" /> : <CheckCircle2 className="w-10 h-10 text-white" />,
    submessage: esTarde 
      ? `Ingreso después de las ${horaLimiteStr} (${retraso} min de retraso)` 
      : `Ingreso puntual a clase de ${lectura.asignatura || asignaturaDefault}.`
  };

  if (isSalida) {
    theme = {
      bg: 'bg-indigo-600',
      headerBg: 'bg-linear-to-r from-indigo-600 to-purple-700',
      border: 'border-indigo-400',
      badgeText: `¡HASTA PRONTO, ${lectura.nombre || 'ESTUDIANTE'}!`,
      icon: <CheckCircle2 className="w-10 h-10 text-white" />,
      submessage: `Salida registrada exitosamente a las ${horaTexto}. ¡Que tengas un excelente día!`
    };
  } else if (isDuplicate) {
    theme = {
      bg: 'bg-blue-600',
      headerBg: 'bg-linear-to-r from-blue-600 to-indigo-700',
      border: 'border-blue-400',
      badgeText: 'ASISTENCIA YA REGISTRADA HOY',
      icon: <UserCheck className="w-10 h-10 text-white" />,
      submessage: 'Este estudiante ya tiene su asistencia marcada el día de hoy.'
    };
  } else if (isUnregistered) {
    theme = {
      bg: 'bg-rose-600',
      headerBg: 'bg-linear-to-r from-rose-600 to-rose-700',
      border: 'border-rose-400',
      badgeText: 'TARJETA NO REGISTRADA',
      icon: <XCircle className="w-10 h-10 text-white" />,
      submessage: `El UID escaneado no pertenece a ningún estudiante registrado en ${gradoDefault}.`
    };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div 
        className={`relative w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl border-4 ${theme.border} transform transition-all animate-scaleUp`}
      >
        {/* Progress Bar (6s timer) */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-slate-100 z-10">
          <div 
            className={`h-full transition-all duration-75 ease-linear ${theme.bg}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Top Header */}
        <div className={`${theme.headerBg} px-6 py-5 text-white flex items-center justify-between`}>
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shrink-0 shadow-xs">
              {theme.icon}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-amber-300 block">
                {nombreColegio} • {gradoDefault}
              </span>
              <h2 className="text-lg md:text-xl font-black tracking-tight leading-tight">
                {theme.badgeText}
              </h2>
              <p className="text-xs text-white/90 font-medium mt-0.5">
                {theme.submessage}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 md:p-7">
          {isUnregistered ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-3 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
                <XCircle className="w-10 h-10" />
              </div>
              <p className="text-slate-700 font-bold text-sm mb-1">{theme.submessage}</p>
              
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl shadow-inner font-mono text-xl tracking-wider my-3 font-bold border border-slate-700">
                <span className="text-slate-400 text-xs">UID:</span>
                <span className="text-amber-400">{lectura.uid}</span>
              </div>

              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                Para vincular esta tarjeta a un estudiante, vaya a la pestaña <strong>Estudiantes</strong> y use el botón <strong>"Vincular / Cambiar Tarjeta"</strong>.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Student Profile Row */}
              <div className="flex items-center gap-5">
                {/* Photo / Avatar */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-slate-100 border-4 border-slate-200/80 shadow-md">
                    {lectura.foto ? (
                      <img
                        src={lectura.foto}
                        alt={lectura.nombre || 'Estudiante'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-3xl">
                        {lectura.nombre ? lectura.nombre.slice(0, 2).toUpperCase() : 'ES'}
                      </div>
                    )}
                  </div>
                  <span className="absolute -bottom-2 -right-1 px-2.5 py-0.5 rounded-md text-[10px] font-black shadow-md bg-blue-700 text-white">
                    {lectura.grado || '6° - 1'}
                  </span>
                </div>

                {/* Identity info */}
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-black text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-md inline-block">
                    {lectura.codigo || `EST-601-${lectura.estudiante_id?.toString().padStart(3, '0') || '001'}`}
                  </span>
                  
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 mt-1 truncate">
                    {lectura.nombre}
                  </h3>

                  <p className="text-xs text-slate-500 font-medium">
                    {lectura.correo || 'Estudiante Oficial Grado 6° - 1'}
                  </p>

                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Tarjeta UID: <strong>{lectura.uid}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Class, Time & Punctuality Details */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {/* Salón y Asignatura */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Salón y Clase</span>
                  </div>
                  <div className="text-xs font-black text-slate-800">
                    {lectura.salon || 'Salón de Informática'}
                  </div>
                  <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">
                    {lectura.asignatura || 'Informática y Tecnología'}
                  </div>
                </div>

                {/* Hora de Entrada o Salida y Puntualidad */}
                <div className={`p-3 rounded-2xl border ${
                  isSalida
                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                    : esTarde 
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
                    : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="flex items-center gap-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5" /> {isSalida ? 'Hora de Salida' : 'Hora Llegada'}
                    </span>
                    <span className="font-mono text-xs font-black text-slate-900">
                      {horaTexto}
                    </span>
                  </div>
                  <div>
                    {isSalida ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Salida registrada con éxito</span>
                      </span>
                    ) : !esTarde ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>A tiempo (Antes de {horaLimiteStr})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Tarde (+{retraso} min retraso)</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {isSalida ? 'Jornada escolar terminada' : `Entrada oficial: ${horaEntradaDefault} AM (Límite: ${horaLimiteStr} AM)`}
                  </div>
                </div>
              </div>

              {/* Acudiente / Contact info with 1-Click WhatsApp Trigger */}
              {(lectura.acudiente_nombre || lectura.acudiente_contacto) && (
                <div className="p-3.5 bg-linear-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                      Acudiente / Contacto Familiar
                    </span>
                    <span className="font-extrabold text-slate-900 block truncate">
                      {lectura.acudiente_nombre || 'Acudiente registrado'}
                    </span>
                    {lectura.acudiente_contacto && (
                      <span className="text-[11px] font-mono text-emerald-700 font-bold">
                        {lectura.acudiente_contacto}
                      </span>
                    )}
                  </div>

                  {lectura.acudiente_contacto && (
                    <button
                      type="button"
                      onClick={() => {
                        const cleanPhone = (lectura.acudiente_contacto || '').replace(/[^0-9]/g, '');
                        const phone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
                        const msg = `🏫 *Colegio San Nicolás de Tolentino - Asistencia 6° - 1*\nEstimado(a) *${lectura.acudiente_nombre || 'Acudiente'}*,\nLe confirmamos que su hijo(a) *${lectura.nombre}* ha ingresado al *Salón de Informática* hoy a las *${horaTexto}*.\n📌 *Estado:* ${!esTarde ? '✅ Puntual (A tiempo)' : `⚠️ Entrada con retraso (+${retraso} min)`}\n👨‍🏫 *Docente:* Prof. Roberto Gómez`;
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer hover:scale-102 shrink-0"
                      title="Abrir WhatsApp para enviar confirmación de asistencia al padre de familia"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Notificar por WhatsApp</span>
                      <ExternalLink className="w-3 h-3 text-emerald-200" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer button */}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Escaneo RFID procesado en tiempo real
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cerrar (o esperar conteo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
