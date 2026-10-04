import React, { useState } from 'react';
import { 
  Users, 
  Calendar, 
  MapPin, 
  Search, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  BookOpen, 
  Table as TableIcon,
  LayoutGrid,
  RefreshCw,
  Eye,
  GraduationCap,
  AlertTriangle,
  PlusCircle,
  Radio,
  FileCheck,
  MessageSquare,
  Mail,
  Send,
  UserX,
  Sparkles
} from 'lucide-react';
import { Asistencia, SystemStats, Estudiante, AppSettings } from '../types';
import { StudentDetailModal } from './StudentDetailModal';
import { ManualAttendanceModal } from './ManualAttendanceModal';

interface Props {
  asistencias: Asistencia[];
  stats: SystemStats | null;
  salones: string[];
  students: Estudiante[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedSalon: string;
  onSalonChange: (salon: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  appSettings?: AppSettings | null;
}

export const AttendanceView: React.FC<Props> = ({
  asistencias,
  stats,
  salones,
  students,
  selectedDate,
  onDateChange,
  selectedSalon,
  onSalonChange,
  onRefresh,
  isLoading,
  appSettings
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsignatura, setSelectedAsignatura] = useState<string>('todas');
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Estudiante | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const nombreColegio = appSettings?.nombre_colegio || 'I.E. San Nicolás de Tolentino';
  const grado = appSettings?.grado || '6° - 1';
  const salon = appSettings?.salon || 'Salón de Informática';
  const asignatura = appSettings?.asignatura || 'Informática y Tecnología';
  const profesor = appSettings?.profesor || 'Prof. Roberto Gómez';
  const horaEntrada = appSettings?.hora_entrada || '08:30';
  const horaLimite = appSettings?.hora_limite || '08:40';

  // Absence notification states
  const [isNotifyingAbsences, setIsNotifyingAbsences] = useState(false);
  const [absenceNoticeMsg, setAbsenceNoticeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sendingStudentId, setSendingStudentId] = useState<number | null>(null);

  // Available subjects
  const asignaturas = [
    'Matemáticas',
    'Física',
    'Química',
    'Español y Literatura',
    'Inglés',
    'Historia y Ciencias Sociales',
    'Informática y Tecnología',
    'Biología'
  ];

  // Filter attendances
  const filteredAsistencias = asistencias.filter((item) => {
    const q = searchTerm.toLowerCase();
    const nameMatch = item.nombre?.toLowerCase().includes(q) || false;
    const gradeMatch = item.grado?.toLowerCase().includes(q) || false;
    const uidMatch = item.uid?.toLowerCase().includes(q) || false;
    const codigoMatch = item.codigo?.toLowerCase().includes(q) || false;
    const profMatch = (item.profesor || '').toLowerCase().includes(q);
    const subjectMatch = selectedAsignatura === 'todas' || (item.asignatura || 'General').toLowerCase() === selectedAsignatura.toLowerCase();
    return (nameMatch || gradeMatch || uidMatch || codigoMatch || profMatch) && subjectMatch;
  });

  const totalStudents = students.length || stats?.totalEstudiantes || 0;
  const presentStudents = filteredAsistencias.length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;
  const totalRetrasos = filteredAsistencias.filter((a) => (a.minutos_retraso || 0) > 0).length;

  // Identify absent students for selected date
  const presentStudentIds = new Set(asistencias.map((a) => a.estudiante_id));
  const absentStudentsList = students.filter((s) => !presentStudentIds.has(s.id));

  // Handle Bulk Notification for Absent Students
  const handleNotifyAllAbsences = async () => {
    if (absentStudentsList.length === 0) return;
    setIsNotifyingAbsences(true);
    setAbsenceNoticeMsg(null);
    try {
      const res = await fetch('/api/email/notify-absences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: selectedDate,
          hora_limite: '08:40 AM',
          salon: 'Salón de Informática',
          asignatura: 'Informática y Tecnología',
          profesor: 'Prof. Roberto Gómez'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAbsenceNoticeMsg({ type: 'ok', text: data.message });
      } else {
        setAbsenceNoticeMsg({ type: 'err', text: data.message || 'Error al enviar alertas' });
      }
    } catch (err: any) {
      setAbsenceNoticeMsg({ type: 'err', text: err.message || 'Error de conexión' });
    } finally {
      setIsNotifyingAbsences(false);
    }
  };

  // Handle Single Absence Notification
  const handleNotifySingleAbsence = async (student: Estudiante, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSendingStudentId(student.id);
    setAbsenceNoticeMsg(null);
    try {
      const res = await fetch('/api/email/send-absence-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estudiante_id: student.id,
          fecha: selectedDate,
          hora_limite: '08:40 AM',
          salon: 'Salón de Informática',
          asignatura: 'Informática y Tecnología',
          profesor: 'Prof. Roberto Gómez'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAbsenceNoticeMsg({ type: 'ok', text: `✓ Alerta de inasistencia enviada al acudiente de ${student.nombre}` });
      } else {
        setAbsenceNoticeMsg({ type: 'err', text: data.message || 'Error al enviar alerta' });
      }
    } catch (err: any) {
      setAbsenceNoticeMsg({ type: 'err', text: err.message || 'Error de conexión' });
    } finally {
      setSendingStudentId(null);
    }
  };

  // Open detail modal for clicked attendance item
  const handleOpenDetail = (item: Asistencia) => {
    const est: Estudiante = {
      id: item.estudiante_id,
      codigo: item.codigo || `EST-${item.estudiante_id.toString().padStart(4, '0')}`,
      uid: item.uid,
      nombre: item.nombre,
      grado: item.grado,
      correo: item.correo,
      acudiente_nombre: item.acudiente_nombre,
      acudiente_contacto: item.acudiente_contacto,
      acudiente_correo: item.acudiente_correo,
      foto: item.foto
    };
    setSelectedStudentForDetail(est);
  };

  // Direct WhatsApp notification to parent
  const handleNotifyWhatsApp = (item: Asistencia, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const esTarde = (item.minutos_retraso || 0) > 0;
    const cleanPhone = (item.acudiente_contacto || '').replace(/[^0-9]/g, '');
    const phone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    const msg = `🏫 *Colegio San Nicolás de Tolentino - Asistencia 6° - 1*\nEstimado(a) *${item.acudiente_nombre || 'Acudiente'}*,\nLe confirmamos que su hijo(a) *${item.nombre}* ha registrado su asistencia en el *Salón de Informática* hoy a las *${item.hora}*.\n📌 *Estado:* ${!esTarde ? '✅ Puntual (A tiempo)' : `⚠️ Entrada con retraso (+${item.minutos_retraso} min)`}\n👨‍🏫 *Docente:* Prof. Roberto Gómez - Informática y Tecnología`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredAsistencias.length === 0) return;
    const headers = [
      'ID', 
      'Codigo Estudiante', 
      'Nombre Completo', 
      'Grado', 
      'Salon', 
      'Asignatura', 
      'Profesor',
      'Hora Programada',
      'Hora Llegada',
      'Minutos de Retraso',
      'Metodo de Registro',
      'Observaciones',
      'UID Tarjeta', 
      'Fecha'
    ];
    const rows = filteredAsistencias.map((a) => [
      a.id,
      `"${a.codigo || ''}"`,
      `"${a.nombre || ''}"`,
      `"${a.grado || ''}"`,
      `"${a.salon || ''}"`,
      `"${a.asignatura || 'Matemáticas'}"`,
      `"${a.profesor || 'Prof. Asignado'}"`,
      `"${a.hora_programada || '07:00'}"`,
      a.hora,
      a.minutos_retraso || 0,
      `"${a.metodo === 'manual' ? 'Manual (Profesor)' : 'Tarjeta RFID'}"`,
      `"${a.observacion || ''}"`,
      `"${a.uid || ''}"`,
      a.fecha
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `asistencias_retrasos_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Scope Banner: Grado • Salón */}
      <div className="bg-linear-to-r from-red-800 via-red-900 to-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-red-700/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 flex items-center justify-center font-black text-lg text-amber-300 border border-amber-300/40 shrink-0">
            {grado}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                Curso Oficial
              </span>
              <h2 className="text-base sm:text-lg font-black text-white">
                {nombreColegio} • {grado}
              </h2>
            </div>
            <p className="text-xs text-amber-200/90 font-medium mt-0.5">
              {salon} • Asignatura: {asignatura} • {profesor}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Entrada: <strong>{horaEntrada}</strong></span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tolerancia Puntual: <strong>{horaLimite}</strong></span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Asistencias */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Presentes Hoy
            </span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {presentStudents}
            </div>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {presentStudents - totalRetrasos} puntuales
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Retrasos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Llegadas Tardías
            </span>
            <div className={`text-3xl font-black mt-1 ${totalRetrasos > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {totalRetrasos}
            </div>
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Con minutos de retraso
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Matricula y Tasa */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Tasa de Asistencia
            </span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {attendanceRate}%
            </div>
            <span className="text-xs text-slate-500 font-medium mt-1 block">
              {presentStudents} de {totalStudents} alumnos
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Botón de Ingreso Manual Destacado */}
        <div className="bg-linear-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-100 block">
              Sin Tarjeta / Emergencia
            </span>
            <div className="text-base font-black text-white mt-1">
              Ingreso Manual
            </div>
          </div>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="mt-3 w-full py-2 bg-white hover:bg-amber-50 text-amber-800 rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-600" />
            <span>Registrar Estudiante</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filters: Search, Date, Room, Subject */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar código, nombre, grado, profesor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedSalon}
                onChange={(e) => onSalonChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="todos">Todos los Salones</option>
                {salones.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <select
                value={selectedAsignatura}
                onChange={(e) => setSelectedAsignatura(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="todas">Todas las Asignaturas</option>
                {asignaturas.map((asig) => (
                  <option key={asig} value={asig}>{asig}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View Switcher: [Tabla] vs [Tarjetas] */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('tabla')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'tabla'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ver como Tabla"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Tabla</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tarjetas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'tarjetas'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ver como Tarjetas"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
            </div>

            <button
              onClick={() => setIsManualModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition-colors cursor-pointer"
              title="Registrar ingreso manual para estudiante sin tarjeta"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Ingreso Manual</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Actualizar lista"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleExportCSV}
              disabled={filteredAsistencias.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={filteredAsistencias.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Message Toast / Alert */}
      {absenceNoticeMsg && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-fadeIn ${
          absenceNoticeMsg.type === 'ok'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {absenceNoticeMsg.type === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-bold">{absenceNoticeMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setAbsenceNoticeMsg(null)}
            className="text-slate-400 hover:text-slate-600 p-1 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Control de Inasistencias y Alerta a Padres */}
      <div className="bg-linear-to-br from-slate-900 via-slate-900 to-red-950 text-white rounded-2xl p-5 shadow-md border-2 border-red-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${
              absentStudentsList.length > 0 ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 animate-pulse' : 'bg-emerald-600 text-white'
            }`}>
              {absentStudentsList.length > 0 ? (
                <UserX className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-300/30">
                  Tolerancia Oficial (08:40 AM)
                </span>
                <span className="text-xs font-bold text-slate-300">
                  {absentStudentsList.length > 0 ? `${absentStudentsList.length} alumno(s) sin ingreso confirmado hoy` : 'Asistencia completa al 100%'}
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-1">
                {absentStudentsList.length > 0 
                  ? 'Estudiantes Ausentes o Fuera del Tiempo de Tolerancia'
                  : '✓ ¡Todos los estudiantes de 6° - 1 han ingresado puntualmente!'}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                {absentStudentsList.length > 0
                  ? 'Puedes enviar una alerta oficial por correo a los padres de familia notificando que su acudido no ha registrado su ingreso al Salón de Informática.'
                  : 'No hay inasistencias reportadas en este momento.'}
              </p>
            </div>
          </div>

          {absentStudentsList.length > 0 && (
            <button
              type="button"
              onClick={handleNotifyAllAbsences}
              disabled={isNotifyingAbsences}
              className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer hover:scale-102 shrink-0"
            >
              {isNotifyingAbsences ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Despachando Correos...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-amber-300" />
                  <span>Notificar Inasistencia a Todos ({absentStudentsList.length})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* List of absent students chips */}
        {absentStudentsList.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {absentStudentsList.map((st) => (
              <div
                key={st.id}
                className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-red-950 text-red-400 border border-red-800/60 font-black text-xs flex items-center justify-center shrink-0">
                    {st.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <strong className="text-white block truncate text-xs">{st.nombre}</strong>
                    <span className="text-[10px] text-amber-300 font-mono block truncate">
                      {st.acudiente_correo || 'Sin correo registrado'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleNotifySingleAbsence(st, e)}
                  disabled={sendingStudentId === st.id || !st.acudiente_correo}
                  className="px-2.5 py-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white rounded-lg text-[10px] font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                  title="Enviar correo de alerta de inasistencia al acudiente"
                >
                  {sendingStudentId === st.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Mail className="w-3 h-3 text-amber-300" />
                  )}
                  <span>Alerta</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Container: Option 1 (Table) or Option 2 (Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900">
              {viewMode === 'tabla' ? 'Tabla de Asistencia Escolar' : 'Tarjetas de Asistencia Escolar'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 font-mono">
              {filteredAsistencias.length} registros
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {selectedDate} • Horarios y Minutos de Retraso
          </span>
        </div>

        {filteredAsistencias.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Clock className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No hay asistencias registradas
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Acerque una tarjeta al lector RFID, o use el botón <strong>"Ingreso Manual"</strong> si el estudiante no tiene su tarjeta.
            </p>
          </div>
        ) : viewMode === 'tabla' ? (
          /* ============================================================ */
          /* OPCIÓN 1: TABLA PRINCIPAL CON MINUTOS DE RETRASO             */
          /* ============================================================ */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-6">Código</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Grado</th>
                  <th className="py-3 px-4">Salón</th>
                  <th className="py-3 px-4">Asignatura y Profesor</th>
                  <th className="py-3 px-4">Hora Llegada</th>
                  <th className="py-3 px-4">Puntualidad / Retraso</th>
                  <th className="py-3 px-6 text-right">Método / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredAsistencias.map((item) => {
                  const minutos = item.minutos_retraso || 0;
                  const esTarde = minutos > 0;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => handleOpenDetail(item)}
                      className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    >
                      {/* Código del Estudiante */}
                      <td className="py-3 px-6 font-mono font-bold text-blue-700 text-xs">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/70">
                          {item.codigo || `EST-${item.estudiante_id.toString().padStart(4, '0')}`}
                        </span>
                      </td>

                      {/* Nombre y Foto */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {item.foto ? (
                              <img
                                src={item.foto}
                                alt={item.nombre}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs bg-slate-100">
                                {item.nombre ? item.nombre.slice(0, 2).toUpperCase() : 'ES'}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {item.nombre}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              UID: {item.uid}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Grado */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                          {item.grado}
                        </span>
                      </td>

                      {/* Salón */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>{item.salon}</span>
                        </div>
                      </td>

                      {/* Asignatura y Profesor */}
                      <td className="py-3 px-4">
                        <div>
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>{item.asignatura || 'Matemáticas'}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.profesor || 'Prof. Asignado'} (Entrada: {item.hora_programada || '07:00'})
                          </div>
                        </div>
                      </td>

                      {/* Hora de Llegada */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.hora}</span>
                        </div>
                      </td>

                      {/* Puntualidad / Minutos de Retraso */}
                      <td className="py-3 px-4">
                        {!esTarde ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Puntual (0 min)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Retraso: +{minutos} min</span>
                          </span>
                        )}
                      </td>

                      {/* Método (RFID o Manual) y Acción */}
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.metodo === 'manual'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {item.metodo === 'manual' ? 'Manual' : 'RFID'}
                          </span>

                          {item.acudiente_correo && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const res = await fetch('/api/email/send-manual', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      estudiante_id: item.estudiante_id,
                                      estudiante_nombre: item.nombre,
                                      estudiante_codigo: item.codigo,
                                      grado: item.grado,
                                      salon: item.salon,
                                      asignatura: item.asignatura,
                                      profesor: item.profesor,
                                      fecha: item.fecha,
                                      hora: item.hora,
                                      minutos_retraso: item.minutos_retraso,
                                      acudiente_nombre: item.acudiente_nombre,
                                      acudiente_correo: item.acudiente_correo
                                    })
                                  });
                                  const data = await res.json();
                                  setAbsenceNoticeMsg({ type: 'ok', text: data.message || `✓ Correo de confirmación enviado a ${item.acudiente_correo}` });
                                } catch (err: any) {
                                  setAbsenceNoticeMsg({ type: 'err', text: err.message || 'Error enviando correo' });
                                }
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
                              title={`Enviar comprobante oficial por correo a ${item.acudiente_correo}`}
                            >
                              <Mail className="w-3.5 h-3.5 text-red-600" />
                              <span className="hidden xl:inline">Correo</span>
                            </button>
                          )}

                          {item.acudiente_contacto && (
                            <button
                              type="button"
                              onClick={(e) => handleNotifyWhatsApp(item, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                              title={`Notificar por WhatsApp a ${item.acudiente_nombre || 'acudiente'}`}
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="hidden md:inline">WhatsApp</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Expediente</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ============================================================ */
          /* OPCIÓN 2: TARJETAS VISUALES CON HORA Y RETRASO               */
          /* ============================================================ */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAsistencias.map((item) => {
              const minutos = item.minutos_retraso || 0;
              const esTarde = minutos > 0;

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="bg-slate-50/70 hover:bg-white hover:shadow-md border border-slate-200/80 rounded-2xl p-4 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Bar with Code, Subject & Method */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-[11px] font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                        {item.codigo || `EST-${item.estudiante_id.toString().padStart(4, '0')}`}
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                          <BookOpen className="w-3 h-3 text-indigo-500" />
                          <span>{item.asignatura || 'Matemáticas'}</span>
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.metodo === 'manual' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {item.metodo === 'manual' ? 'Manual' : 'RFID'}
                        </span>
                      </div>
                    </div>

                    {/* Student Photo & Name */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shadow-xs shrink-0">
                        {item.foto ? (
                          <img
                            src={item.foto}
                            alt={item.nombre}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-blue-600 bg-blue-50 text-sm">
                            {item.nombre ? item.nombre.slice(0, 2).toUpperCase() : 'ES'}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-700 text-sm truncate">
                          {item.nombre}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200/70 text-slate-700 mt-1">
                          {item.grado}
                        </span>
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {item.profesor || 'Prof. Asignado'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delay & Arrival Time & WhatsApp button */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1 text-slate-600 font-mono font-bold">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.hora}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!esTarde ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Puntual</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>+{minutos} min</span>
                        </span>
                      )}

                      {item.acudiente_contacto && (
                        <button
                          type="button"
                          onClick={(e) => handleNotifyWhatsApp(item, e)}
                          className="p-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                          title="Enviar WhatsApp al acudiente"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        students={students}
        salones={salones}
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={onRefresh}
        appSettings={appSettings}
      />

      {/* Student Detail Modal (Expediente con Foto, Correo, Acudiente e Historial) */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
        />
      )}
    </div>
  );
};
