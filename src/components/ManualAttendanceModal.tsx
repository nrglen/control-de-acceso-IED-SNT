import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserCheck, 
  Search, 
  MapPin, 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  User, 
  FileText,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Estudiante, ClaseHorario, AppSettings } from '../types';

interface Props {
  students: Estudiante[];
  salones: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appSettings?: AppSettings | null;
}

export const ManualAttendanceModal: React.FC<Props> = ({
  students,
  salones,
  isOpen,
  onClose,
  onSuccess,
  appSettings
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSalon, setSelectedSalon] = useState(appSettings?.salon || 'Salón de Informática');
  const [selectedAsignatura, setSelectedAsignatura] = useState(appSettings?.asignatura || 'Informática y Tecnología');
  const [profesor, setProfesor] = useState(appSettings?.profesor || 'Prof. Roberto Gómez');
  const [horaIngreso, setHoraIngreso] = useState(appSettings?.hora_entrada || '08:30');
  const [horaLlegada, setHoraLlegada] = useState(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
  const [motivo, setMotivo] = useState('Tarjeta olvidada en casa');
  const [clases, setClases] = useState<ClaseHorario[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync with appSettings when opening
  useEffect(() => {
    if (appSettings) {
      if (appSettings.salon) setSelectedSalon(appSettings.salon);
      if (appSettings.asignatura) setSelectedAsignatura(appSettings.asignatura);
      if (appSettings.profesor) setProfesor(appSettings.profesor);
      if (appSettings.hora_entrada) setHoraIngreso(appSettings.hora_entrada);
    }
  }, [appSettings, isOpen]);

  // Fetch class schedules
  useEffect(() => {
    fetch('/api/clases')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClases(data);
      })
      .catch((err) => console.error('Error fetching clases:', err));
  }, []);

  // Update schedule info when salon or subject changes
  useEffect(() => {
    const match = clases.find(
      (c) => c.salon === selectedSalon && c.asignatura === selectedAsignatura
    ) || clases.find((c) => c.asignatura === selectedAsignatura);

    if (match) {
      setProfesor(match.profesor);
      setHoraIngreso(match.hora_ingreso);
    }
  }, [selectedSalon, selectedAsignatura, clases]);

  if (!isOpen) return null;

  // Selected student
  const currentStudent = students.find((s) => s.id === Number(selectedStudentId));

  // Filtered student list for search
  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(q) ||
      (s.codigo || '').toLowerCase().includes(q) ||
      s.grado.toLowerCase().includes(q) ||
      s.uid.toLowerCase().includes(q)
    );
  });

  // Calculate live preview of delay based on dynamic tolerance rule
  const calcularMinutosRetraso = () => {
    try {
      const [hLlegada, mLlegada] = horaLlegada.split(':').map(Number);
      const [hEntrada, mEntrada] = horaIngreso.split(':').map(Number);
      const tolerancia = Number(appSettings?.minutos_tolerancia) || 10;

      const minsLlegada = hLlegada * 60 + mLlegada;
      const minsEntrada = hEntrada * 60 + mEntrada;
      const minsLimite = minsEntrada + tolerancia;

      if (minsLlegada <= minsLimite) {
        return 0; // A tiempo
      } else {
        return Math.max(1, minsLlegada - minsEntrada);
      }
    } catch {
      return 0;
    }
  };

  const retrasoMins = calcularMinutosRetraso();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setErrorMsg('Por favor seleccione un estudiante.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/asistencias/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudiante_id: Number(selectedStudentId),
          salon: selectedSalon,
          asignatura: selectedAsignatura,
          profesor,
          hora: horaLlegada,
          observacion: motivo
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al registrar el ingreso manual.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-linear-to-r from-amber-600 via-amber-700 to-amber-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200 block">
                Control Docente
              </span>
              <h2 className="text-lg font-black text-white leading-tight">
                Ingreso Manual de Asistencia
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Student Selector & Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              1. Seleccionar Estudiante *
            </label>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <select
              required
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="">-- Seleccione un estudiante ({filteredStudents.length} disponibles) --</option>
              {filteredStudents.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.codigo ? `[${st.codigo}] ` : ''}{st.nombre} — {st.grado}
                </option>
              ))}
            </select>
          </div>

          {/* Selected Student Card Preview */}
          {currentStudent && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center shrink-0 border border-blue-200">
                {currentStudent.foto ? (
                  <img
                    src={currentStudent.foto}
                    alt={currentStudent.nombre}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  currentStudent.nombre.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-bold text-slate-900 truncate">{currentStudent.nombre}</div>
                <div className="text-slate-500 font-mono text-[11px]">
                  {currentStudent.codigo || 'Sin código'} • Grado: {currentStudent.grado}
                </div>
                {currentStudent.acudiente_nombre && (
                  <div className="text-[11px] text-amber-700 mt-0.5">
                    Acudiente: {currentStudent.acudiente_nombre} ({currentStudent.acudiente_contacto || 'Sin tel'})
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Salón, Asignatura y Profesor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Salón de Clase *
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <select
                  value={selectedSalon}
                  onChange={(e) => setSelectedSalon(e.target.value)}
                  className="w-full bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  {salones.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!salones.includes('Salon-101') && <option value="Salon-101">Salon-101</option>}
                  {!salones.includes('Salon-102') && <option value="Salon-102">Salon-102</option>}
                  {!salones.includes('Laboratorio') && <option value="Laboratorio">Laboratorio</option>}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Asignatura *
              </label>
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <select
                  value={selectedAsignatura}
                  onChange={(e) => setSelectedAsignatura(e.target.value)}
                  className="w-full bg-transparent font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                >
                  <option value="Matemáticas">Matemáticas</option>
                  <option value="Física">Física</option>
                  <option value="Química">Química</option>
                  <option value="Español y Literatura">Español y Literatura</option>
                  <option value="Inglés">Inglés</option>
                  <option value="Informática y Tecnología">Informática y Tecnología</option>
                  <option value="Biología">Biología</option>
                </select>
              </div>
            </div>
          </div>

          {/* Horario y Cálculo de Retraso en Vivo */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-amber-900">Horario Oficial de Entrada:</span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                {horaIngreso} AM ({profesor})
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Hora de Llegada Real
                </label>
                <input
                  type="text"
                  value={horaLlegada}
                  onChange={(e) => setHoraLlegada(e.target.value)}
                  placeholder="07:18:00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Estado de Puntualidad
                </label>
                {retrasoMins === 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>A tiempo (Puntual)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>Retraso: +{retrasoMins} min</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Motivo del Ingreso Manual */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Motivo del Ingreso Manual *
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="Tarjeta olvidada en casa">Tarjeta olvidada en casa</option>
              <option value="Tarjeta RFID extraviada / en trámite">Tarjeta RFID extraviada / en trámite</option>
              <option value="Falla temporal de hardware / lector">Falla temporal de hardware / lector</option>
              <option value="Permiso especial de coordinación">Permiso especial de coordinación</option>
              <option value="Llegada tardía justificada con acudiente">Llegada tardía justificada con acudiente</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedStudentId}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar Ingreso Manual'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
