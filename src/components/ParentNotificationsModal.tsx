import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Phone, 
  Mail, 
  BellRing, 
  ShieldCheck, 
  Smartphone, 
  ExternalLink,
  Settings,
  Sparkles,
  Clock,
  User,
  Share2
} from 'lucide-react';
import { Estudiante } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  students: Estudiante[];
}

export const ParentNotificationsModal: React.FC<Props> = ({ isOpen, onClose, students }) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>(students[0]?.id || '');
  const [tipoNotificacion, setTipoNotificacion] = useState<'puntual' | 'tarde'>('puntual');
  const [horaSimulada, setHoraSimulada] = useState('08:32');
  const [autoNotifyOnScan, setAutoNotifyOnScan] = useState(true);
  const [sentSuccessMsg, setSentSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentStudent = students.find((s) => s.id === Number(selectedStudentId)) || students[0];

  const acudienteNombre = currentStudent?.acudiente_nombre || 'Padre de Familia';
  const acudienteTel = currentStudent?.acudiente_contacto || '+57 315 889 4421';
  const cleanPhone = acudienteTel.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;

  // Generate customized school message
  const generarMensaje = () => {
    if (tipoNotificacion === 'puntual') {
      return `🏫 *Colegio San Nicolás de Tolentino - Control de Asistencia*
Estimado(a) *${acudienteNombre}*,
Le informamos que su hijo(a) *${currentStudent?.nombre || 'El alumno'}* (Grado 6° - 1) ha ingresado puntualmente al *Salón de Informática* el día de hoy a las *${horaSimulada} AM*.

✅ *Estado:* Asistencia Puntual (A tiempo)
💻 *Asignatura:* Informática y Tecnología
👨‍🏫 *Docente:* Prof. Roberto Gómez`;
    } else {
      return `🏫 *Colegio San Nicolás de Tolentino - Control de Asistencia*
Estimado(a) *${acudienteNombre}*,
Le informamos que su hijo(a) *${currentStudent?.nombre || 'El alumno'}* (Grado 6° - 1) ha registrado su ingreso al *Salón de Informática* el día de hoy a las *${horaSimulada} AM*.

⚠️ *Novedad:* Llegada posterior a las 08:40 AM (Retraso registrado en el sistema escolar).
💻 *Asignatura:* Informática y Tecnología
👨‍🏫 *Docente:* Prof. Roberto Gómez`;
    }
  };

  const mensajeTexto = generarMensaje();
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensajeTexto)}`;

  const handleTestSend = (e: React.FormEvent) => {
    e.preventDefault();
    window.open(whatsappUrl, '_blank');
    setSentSuccessMsg(`¡Ventana de WhatsApp abierta para notificar a ${acudienteNombre}!`);
    setTimeout(() => setSentSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-scaleUp max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-emerald-600 via-teal-700 to-blue-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                Módulo de Comunicación Familiar • Grado 6° - 1
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Avisos y Notificaciones a Padres por WhatsApp y Correo
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Explanation Banner */}
          <div className="p-4 bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <div className="p-2 bg-emerald-500 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
              <BellRing className="w-5 h-5" />
            </div>
            <div className="text-xs text-slate-700">
              <h4 className="font-black text-emerald-950 text-sm">
                ¿Cómo se le avisa a los padres cuando el alumno asiste?
              </h4>
              <p className="mt-1 leading-relaxed text-slate-600">
                El sistema cuenta con <strong>3 mecanismos integrados</strong> para mantener informados a los acudientes:
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-[11px] font-medium text-slate-700">
                <li><strong>Botón 1-Clic de WhatsApp:</strong> Aparece al escanear la tarjeta en la pantalla grande (Kiosk) y en la tabla de asistencia.</li>
                <li><strong>Webhooks / APIs de Envío Automático:</strong> Permite enviar mensajes instantáneos por WhatsApp Cloud API / Twilio / GreenAPI directamente desde el servidor.</li>
                <li><strong>Correo Institucional al Acudiente:</strong> Envío de constancia de asistencia y registro de puntualidad.</li>
              </ul>
            </div>
          </div>

          {/* Test and Preview Simulator */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Simulador de Envío Directo a Acudiente</span>
              </h4>
              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Grado 6° - 1 • Salón de Informática
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Seleccionar Estudiante:
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-500"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nombre} ({st.codigo || '6-1'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tipo de Asistencia:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoNotificacion('puntual');
                      setHoraSimulada('08:32');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      tipoNotificacion === 'puntual'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    ✓ Puntual (08:32 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoNotificacion('tarde');
                      setHoraSimulada('08:47');
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                      tipoNotificacion === 'tarde'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    ⚠️ Tarde (08:47 AM)
                  </button>
                </div>
              </div>
            </div>

            {/* Recipient Details */}
            {currentStudent && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">Acudiente Registrado:</span>
                    <strong className="text-slate-900">{acudienteNombre}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-bold">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{acudienteTel}</span>
                </div>
              </div>
            )}

            {/* Live Message Preview (WhatsApp Chat Bubble) */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Vista previa del mensaje que recibe el acudiente:
              </label>
              <div className="bg-[#EFEAE2] p-3.5 rounded-2xl border border-slate-300/80 shadow-inner">
                <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-xs border border-slate-200/60 max-w-lg space-y-1.5 text-xs text-slate-800 font-sans">
                  <div className="whitespace-pre-line leading-relaxed">
                    {mensajeTexto}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right flex items-center justify-end gap-1 font-mono">
                    <span>{horaSimulada} AM</span>
                    <span className="text-emerald-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Success Alert */}
            {sentSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{sentSuccessMsg}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestSend}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-md cursor-pointer hover:scale-102"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar WhatsApp de Prueba a {acudienteNombre.split(' ')[0]}</span>
                <ExternalLink className="w-3 h-3 text-emerald-200" />
              </button>
            </div>
          </div>

          {/* Technical Integration Guide for 100% Unattended Automation */}
          <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Settings className="w-4 h-4" />
              <span>¿Quieres que se envíe 100% automático sin tocar ningún botón?</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              El servidor Node.js/Python ya incluye el webhook receptor en <code>/api/lectura</code>. Puedes conectar una pasarela como <strong>Twilio WhatsApp API</strong> o <strong>Meta WhatsApp Cloud API</strong> en <code>server.ts</code> colocando tus credenciales de API para que cada vez que el ESP8266 detecte la tarjeta física, el servidor dispare el mensaje al celular del padre en menos de 1 segundo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <span className="text-xs text-slate-500">
            Colegio San Nicolás de Tolentino • 6° - 1
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
