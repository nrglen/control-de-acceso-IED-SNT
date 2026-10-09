import React, { useEffect, useState } from 'react';
import { 
  X, 
  Mail, 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  CreditCard, 
  Award, 
  CheckCircle2, 
  History,
  GraduationCap,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { Estudiante } from '../types';

interface HistorialItem {
  id: number;
  salon: string;
  asignatura: string;
  profesor?: string;
  hora_programada?: string;
  minutos_retraso?: number;
  metodo?: 'rfid' | 'manual';
  observacion?: string;
  fecha: string;
  hora: string;
}

interface Props {
  student: Estudiante | null;
  onClose: () => void;
}

export const StudentDetailModal: React.FC<Props> = ({ student, onClose }) => {
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [isLoadingHistorial, setIsLoadingHistorial] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!student) return;

    let isMounted = true;
    setIsLoadingHistorial(true);

    fetch(`/api/estudiantes/${student.id}/historial`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setHistorial(Array.isArray(data) ? data : []);
          setIsLoadingHistorial(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching historial:', err);
        if (isMounted) setIsLoadingHistorial(false);
      });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [student, onClose]);

  if (!student) return null;

  // Format clean phone for tel / whatsapp
  const cleanPhone = (student.acudiente_contacto || '').replace(/[^0-9]/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Cover Banner */}
        <div className="relative bg-linear-to-r from-blue-700 via-indigo-700 to-blue-900 p-6 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 pr-10">
            {/* Foto del Estudiante */}
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-white p-1 shadow-lg shrink-0 border-2 border-white/80">
              {student.foto ? (
                <img
                  src={student.foto}
                  alt={student.nombre}
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                  }}
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-blue-100 text-blue-700 font-black text-xl flex items-center justify-center">
                  {student.nombre.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/30 text-blue-100 border border-blue-400/40 uppercase tracking-wider">
                  {student.codigo || `EST-${student.id.toString().padStart(4, '0')}`}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                  {student.grado}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1 truncate">
                {student.nombre}
              </h2>
              <div className="flex items-center gap-2 text-xs text-blue-200 mt-0.5 font-mono">
                <CreditCard className="w-3.5 h-3.5" />
                <span>RFID UID: {student.uid}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 divide-y divide-slate-100">
          {/* Detailed Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Contacto del Estudiante */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-wider">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                <span>Datos del Estudiante</span>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Correo Electrónico Institucional</span>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mt-0.5">
                  <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate">{student.correo || 'No registrado'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-400 block font-medium">Grado y Sección</span>
                <span className="text-sm font-semibold text-slate-800 block mt-0.5">{student.grado}</span>
              </div>
            </div>

            {/* Información del Acudiente */}
            <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-200/70 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-800 uppercase tracking-wider">
                <User className="w-4 h-4 text-amber-600" />
                <span>Información del Acudiente</span>
              </div>

              <div>
                <span className="text-[11px] text-amber-700/80 block font-medium">Nombre del Padre / Acudiente</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">
                  {student.acudiente_nombre || 'No asignado'}
                </span>
              </div>

              {/* Correo del Acudiente */}
              <div>
                <span className="text-[11px] text-amber-700/80 block font-medium">Correo Electrónico para Notificaciones</span>
                <div className="flex items-center justify-between mt-1 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>{student.acudiente_correo || 'Sin correo de notificaciones'}</span>
                  </div>

                  {student.acudiente_correo && (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={isSendingEmail}
                        onClick={async () => {
                          setIsSendingEmail(true);
                          setEmailFeedback(null);
                          try {
                            const res = await fetch('/api/email/send-manual', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                estudiante_id: student.id,
                                estudiante_nombre: student.nombre,
                                estudiante_codigo: student.codigo,
                                grado: student.grado,
                                salon: 'Salón de Informática',
                                asignatura: 'Informática y Tecnología',
                                profesor: 'Prof. Roberto Gómez',
                                acudiente_nombre: student.acudiente_nombre,
                                acudiente_correo: student.acudiente_correo
                              })
                            });

                            const contentType = res.headers.get('content-type') || '';
                            if (!contentType.includes('application/json')) {
                              throw new Error(`El servidor respondió con código ${res.status} (posible reinicio en curso). Espera unos segundos y reintenta.`);
                            }

                            const data = await res.json();
                            if (data.success) {
                              setEmailFeedback({ ok: true, text: data.message || '✓ Correo enviado con éxito' });
                            } else {
                              setEmailFeedback({ ok: false, text: data.message || 'No se pudo enviar el correo' });
                            }
                            setTimeout(() => setEmailFeedback(null), 5000);
                          } catch (err: any) {
                            setEmailFeedback({ ok: false, text: err.message || 'Error de conexión' });
                            setTimeout(() => setEmailFeedback(null), 5000);
                          } finally {
                            setIsSendingEmail(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Enviar comprobante de asistencia al correo del acudiente"
                      >
                        <Mail className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-bounce' : ''}`} />
                        <span>{isSendingEmail ? 'Enviando...' : 'Notificar por Correo'}</span>
                      </button>

                      {emailFeedback && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          emailFeedback.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {emailFeedback.text}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-amber-700/80 block font-medium">Contacto / Teléfono</span>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                    <Phone className="w-4 h-4 text-amber-600" />
                    <span>{student.acudiente_contacto || 'Sin número'}</span>
                  </div>

                  {cleanPhone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://wa.me/${cleanPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Enviar WhatsApp al acudiente"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                      <a
                        href={`tel:${cleanPhone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Llamar al acudiente"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Llamar</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Asistencias Section */}
          <div className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-slate-900">
                  Historial de Asistencia
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {historial.length} registros
                </span>
              </div>
            </div>

            {isLoadingHistorial ? (
              <div className="py-8 text-center text-slate-400 text-sm animate-pulse">
                Cargando historial de asistencias...
              </div>
            ) : historial.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-sm">
                No hay asistencias registradas para este estudiante aún.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Hora Llegada</th>
                        <th className="py-2.5 px-3">Salón</th>
                        <th className="py-2.5 px-3">Asignatura y Prof.</th>
                        <th className="py-2.5 px-3">Puntualidad</th>
                        <th className="py-2.5 px-3 text-right">Método</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {historial.map((reg) => {
                        const retraso = reg.minutos_retraso || 0;
                        const esTarde = retraso > 0;

                        return (
                          <tr key={reg.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{reg.fecha}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{reg.hora}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{reg.salon}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">
                                {reg.asignatura || 'Matemáticas'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {reg.profesor || 'Prof. Asignado'} (Entrada: {reg.hora_programada || '07:00'})
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {!esTarde ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Puntual</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  <span>+{retraso} min</span>
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                reg.metodo === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {reg.metodo === 'manual' ? 'Manual' : 'RFID'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Cerrar Expediente
          </button>
        </div>
      </div>
    </div>
  );
};
