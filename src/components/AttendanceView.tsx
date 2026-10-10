import React, { useState } from 'react';
import { 
  Users, 
  Calendar, 
  Search, 
  Download, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Table as TableIcon,
  LayoutGrid,
  RefreshCw,
  Eye,
  AlertTriangle,
  PlusCircle,
  MessageSquare,
  LogOut
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
  onRefresh,
  isLoading,
  appSettings
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [colorFilter, setColorFilter] = useState<'todos' | 'verde' | 'amarillo' | 'rojo'>('todos');
  const [viewMode, setViewMode] = useState<'tabla' | 'tarjetas'>('tabla');
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Estudiante | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  const nombreColegio = appSettings?.nombre_colegio || 'I.E. SAN NICOLÁS DE TOLENTINO';
  const grado = appSettings?.grado || '6° - 1';
  const salon = appSettings?.salon || 'Salón de Informática';
  const asignatura = appSettings?.asignatura || 'Informática y Tecnología';
  const profesor = appSettings?.profesor || 'Prof. Roberto Gómez';
  const horaEntrada = appSettings?.hora_entrada || '08:30';
  const horaLimite = appSettings?.hora_limite || '08:40';
  const horaFinalizacion = appSettings?.hora_finalizacion || '14:00';

  // Build a complete list of students with their attendance states for the selected date
  const studentsAttendanceList = students.map((student) => {
    const attendance = asistencias.find(
      (a) => a.estudiante_id === student.id && a.fecha === selectedDate
    );
    const isPresent = !!attendance;
    const isLate = isPresent && (attendance.minutos_retraso || 0) > 0;

    let status: 'verde' | 'amarillo' | 'rojo' = 'rojo';
    if (isPresent) {
      status = isLate ? 'amarillo' : 'verde';
    }

    return {
      student,
      attendance,
      status,
      isPresent,
      isLate,
    };
  });

  // Filter list by search term and selected color status
  const filteredStudentsList = studentsAttendanceList.filter((item) => {
    const q = searchTerm.toLowerCase();
    const nameMatch = item.student.nombre.toLowerCase().includes(q) || 
                      (item.student.codigo || '').toLowerCase().includes(q) || 
                      item.student.uid.toLowerCase().includes(q);
    const colorMatch = colorFilter === 'todos' || item.status === colorFilter;
    return nameMatch && colorMatch;
  });

  const totalCount = studentsAttendanceList.length;
  const presentCount = studentsAttendanceList.filter(s => s.isPresent).length;
  const punctualCount = studentsAttendanceList.filter(s => s.status === 'verde').length;
  const lateCount = studentsAttendanceList.filter(s => s.status === 'amarillo').length;
  const absentCount = studentsAttendanceList.filter(s => s.status === 'rojo').length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  // Open detail modal for clicked student
  const handleOpenDetail = (student: Estudiante) => {
    setSelectedStudentForDetail(student);
  };

  // Direct WhatsApp notification to parent (Entry, Exit or Absence)
  const handleNotifyWhatsApp = (student: Estudiante, attendance?: Asistencia, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const cleanPhone = (student.acudiente_contacto || '').replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      alert(`El estudiante ${student.nombre} no tiene número telefónico de acudiente registrado.`);
      return;
    }
    const phone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
    let msg = '';

    if (attendance) {
      const isSalida = Boolean(attendance.hora_salida);
      const esTarde = (attendance.minutos_retraso || 0) > 0;
      if (isSalida) {
        msg = `🏫 *${nombreColegio} - Control de Asistencia*\nEstimado(a) *${student.acudiente_nombre || 'Acudiente'}*,\nLe confirmamos que su hijo(a) *${student.nombre}* (${student.grado}) registró su *SALIDA* del colegio hoy a las *${attendance.hora_salida}*.\n👋 ¡Que tenga un excelente día!`;
      } else {
        msg = `🏫 *${nombreColegio} - Control de Asistencia*\nEstimado(a) *${student.acudiente_nombre || 'Acudiente'}*,\nLe confirmamos que su hijo(a) *${student.nombre}* (${student.grado}) ha ingresado al *${salon}* hoy a las *${attendance.hora}*.\n📌 *Estado:* ${!esTarde ? '✅ Puntual (A tiempo)' : `⚠️ Entrada con retraso (+${attendance.minutos_retraso} min)`}\n👨‍🏫 *Docente:* ${profesor} - ${asignatura}`;
      }
    } else {
      msg = `🏫 *${nombreColegio} - Reporte de Inasistencia*\nEstimado(a) *${student.acudiente_nombre || 'Acudiente'}*,\nLe informamos que su hijo(a) *${student.nombre}* (${student.grado}) NO ha registrado asistencia el día de hoy (${selectedDate}) a la clase de *${asignatura}* en el *${salon}*.\nPor favor comunicarse con la institución si tiene alguna novedad o justificación.`;
    }

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Export to beautifully formatted Excel-compatible HTML spreadsheet
  const handleDownloadExcel = () => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Ingresos de Clase</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; margin-top: 15px; }
          th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #475569; padding: 10px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          h2 { color: #b91c1c; margin-bottom: 5px; }
          .verde { background-color: #d1fae5; color: #065f46; font-weight: bold; }
          .amarillo { background-color: #fef3c7; color: #92400e; font-weight: bold; }
          .rojo { background-color: #fee2e2; color: #991b1b; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Reporte Oficial de Ingresos de Clase - ${nombreColegio}</h2>
        <p>
          <b>Fecha:</b> ${selectedDate} | 
          <b>Grado:</b> ${grado} | 
          <b>Salón:</b> ${salon} | 
          <b>Asignatura:</b> ${asignatura} | 
          <b>Horario:</b> ${horaEntrada} - ${horaFinalizacion} | 
          <b>Docente:</b> ${profesor}
        </p>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Estudiante</th>
              <th>Grado</th>
              <th>Salón</th>
              <th>Asignatura</th>
              <th>Profesor</th>
              <th>Hora Entrada Prog.</th>
              <th>Hora Llegada Real</th>
              <th>Minutos de Retraso</th>
              <th>Estado de Asistencia</th>
              <th>Método de Registro</th>
            </tr>
          </thead>
          <tbody>
            ${studentsAttendanceList.map(({ student, attendance, status }) => {
              const minutos = attendance?.minutos_retraso || 0;
              const isAbsent = status === 'rojo';
              const isLate = status === 'amarillo';
              
              let statusText = 'Puntual';
              let classColor = 'verde';
              if (isAbsent) {
                statusText = 'Inasistente';
                classColor = 'rojo';
              } else if (isLate) {
                statusText = `Tarde (+${minutos} min)`;
                classColor = 'amarillo';
              }

              return `
                <tr>
                  <td>${student.codigo || `EST-${student.id}`}</td>
                  <td>${student.nombre}</td>
                  <td>${student.grado}</td>
                  <td>${salon}</td>
                  <td>${asignatura}</td>
                  <td>${profesor}</td>
                  <td>${horaEntrada}</td>
                  <td>${attendance?.hora || '—'}</td>
                  <td>${minutos}</td>
                  <td class="${classColor}">${statusText}</td>
                  <td>${attendance ? (attendance.metodo === 'manual' ? 'Manual' : 'RFID') : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Ingresos_Clase_${selectedDate}.xls`);
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
              {salon} • Asignatura: {asignatura} • Profesor: {profesor}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono font-bold text-white flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Horario Clase: <strong>{horaEntrada} - {horaFinalizacion}</strong></span>
          </div>
          <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tolerancia Entrada: <strong>{horaLimite}</strong></span>
          </div>
        </div>
      </div>

      {/* Metrics Row (3 Cards: Present, Late, Absent) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Presentes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Presentes Hoy
            </span>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {presentCount} <span className="text-sm font-medium text-slate-400">de {totalCount}</span>
            </div>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {punctualCount} a tiempo
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Retrasos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Llegadas Tardías
            </span>
            <div className={`text-3xl font-black mt-1 ${lateCount > 0 ? 'text-amber-500' : 'text-slate-900'}`}>
              {lateCount}
            </div>
            <span className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" /> Con minutos de retraso
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Inasistentes */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Inasistentes (No Llegaron)
            </span>
            <div className={`text-3xl font-black mt-1 ${absentCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {absentCount}
            </div>
            <span className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Sin registro de entrada
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search & Date picker */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative min-w-[250px] flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar código, nombre, grado, RFID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-red-500 font-medium text-slate-900"
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
          </div>

          {/* Right: Actions and view mode */}
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
              onClick={handleDownloadExcel}
              disabled={filteredStudentsList.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
              title="Descargar reporte en formato Excel"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Descargar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Color Filter Tabs (Todos, Verde, Amarillo, Rojo) */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-2xl flex flex-wrap gap-2 shadow-xs items-center">
        <span className="text-xs font-black text-slate-500 uppercase tracking-wider px-3">Filtrar por Asistencia:</span>
        
        <button
          onClick={() => setColorFilter('todos')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            colorFilter === 'todos'
              ? 'bg-slate-950 text-white shadow-md'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          <span>Todos ({studentsAttendanceList.length})</span>
        </button>

        <button
          onClick={() => setColorFilter('verde')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
            colorFilter === 'verde'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span>A Tiempo / Puntuales ({studentsAttendanceList.filter(s => s.status === 'verde').length})</span>
        </button>

        <button
          onClick={() => setColorFilter('amarillo')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
            colorFilter === 'amarillo'
              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Tarde / Retrasados ({studentsAttendanceList.filter(s => s.status === 'amarillo').length})</span>
        </button>

        <button
          onClick={() => setColorFilter('rojo')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border ${
            colorFilter === 'rojo'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
              : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          <span>Inasistentes ({studentsAttendanceList.filter(s => s.status === 'rojo').length})</span>
        </button>
      </div>

      {/* Main Container: Option 1 (Table) or Option 2 (Cards) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900">
              {viewMode === 'tabla' ? 'Planilla de Asistencias de la Clase' : 'Tarjetas de Asistencia'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 font-mono">
              {filteredStudentsList.length} estudiantes listados
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {selectedDate} • {colorFilter.toUpperCase()}
          </span>
        </div>

        {filteredStudentsList.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No hay estudiantes que coincidan con el filtro
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Prueba cambiando el término de búsqueda o seleccionando otro filtro de asistencia.
            </p>
          </div>
        ) : viewMode === 'tabla' ? (
          /* ============================================================ */
          /* OPCIÓN 1: TABLA PRINCIPAL DE TODOS LOS ESTUDIANTES          */
          /* ============================================================ */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-6">Código</th>
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Grado</th>
                  <th className="py-3 px-4">Hora Llegada</th>
                  <th className="py-3 px-4">Estado de Asistencia</th>
                  <th className="py-3 px-6 text-right">Método / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredStudentsList.map(({ student, attendance, status }) => {
                  const minutos = attendance?.minutos_retraso || 0;

                  return (
                    <tr
                      key={student.id}
                      onClick={() => handleOpenDetail(student)}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    >
                      {/* Código del Estudiante */}
                      <td className="py-3 px-6 font-mono font-bold text-blue-700 text-xs">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200/70">
                          {student.codigo || `EST-${student.id.toString().padStart(4, '0')}`}
                        </span>
                      </td>

                      {/* Nombre y Foto */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            {student.foto ? (
                              <img
                                src={student.foto}
                                alt={student.nombre}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs bg-slate-100">
                                {student.nombre.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {student.nombre}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              UID: {student.uid}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Grado */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                          {student.grado}
                        </span>
                      </td>

                      {/* Hora de Llegada y Salida */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Entrada: {attendance?.hora || '—'}</span>
                          </div>
                          {attendance?.hora_salida && (
                            <div className="flex items-center gap-1.5 text-indigo-700 font-semibold text-[11px]">
                              <LogOut className="w-3 h-3 text-indigo-500" />
                              <span>Salida: {attendance.hora_salida}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Puntualidad / Minutos de Retraso con Color Filters */}
                      <td className="py-3 px-4">
                        {status === 'verde' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Puntual</span>
                          </span>
                        )}
                        {status === 'amarillo' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span>Tarde (+{minutos} min)</span>
                          </span>
                        )}
                        {status === 'rojo' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            <span>Inasistente</span>
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {attendance && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                              {attendance.metodo === 'manual' ? 'Manual' : 'RFID'}
                            </span>
                          )}

                          {/* WhatsApp 1-Clic Notification */}
                          {student.acudiente_contacto ? (
                            <button
                              type="button"
                              onClick={(e) => handleNotifyWhatsApp(student, attendance, e)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                attendance
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                              }`}
                              title={attendance ? "Notificar Asistencia/Salida por WhatsApp" : "Notificar Inasistencia al Acudiente"}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{attendance ? 'WhatsApp' : 'Avisar Falta'}</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium italic hidden sm:inline">Sin Tel.</span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(student);
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
          /* OPCIÓN 2: TARJETAS VISUALES CON COLORES                     */
          /* ============================================================ */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudentsList.map(({ student, attendance, status }) => {
              const minutos = attendance?.minutos_retraso || 0;

              return (
                <div
                  key={student.id}
                  onClick={() => handleOpenDetail(student)}
                  className={`bg-slate-50/70 hover:bg-white hover:shadow-md border rounded-2xl p-4 transition-all duration-200 cursor-pointer group flex flex-col justify-between ${
                    status === 'verde' ? 'border-emerald-200 hover:border-emerald-400' :
                    status === 'amarillo' ? 'border-amber-200 hover:border-amber-400' :
                    'border-rose-200 hover:border-rose-400'
                  }`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="font-mono text-[11px] font-black text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                        {student.codigo || `EST-${student.id}`}
                      </span>

                      {attendance && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {attendance.metodo === 'manual' ? 'Manual' : 'RFID'}
                        </span>
                      )}
                    </div>

                    {/* Student Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white border-2 border-slate-200 shadow-xs shrink-0">
                        {student.foto ? (
                          <img
                            src={student.foto}
                            alt={student.nombre}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-black text-blue-600 bg-blue-50 text-sm">
                            {student.nombre.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 group-hover:text-blue-700 text-sm truncate">
                          {student.nombre}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200/70 text-slate-700 mt-1">
                          {student.grado}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Arrival Time and Status Indicator */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs gap-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 text-slate-700 font-mono font-bold">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Entrada: {attendance?.hora || '—'}</span>
                      </div>
                      {attendance?.hora_salida && (
                        <div className="flex items-center gap-1 text-indigo-700 font-mono font-semibold text-[11px]">
                          <LogOut className="w-3 h-3 text-indigo-500" />
                          <span>Salida: {attendance.hora_salida}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {status === 'verde' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Puntual</span>
                        </span>
                      )}
                      {status === 'amarillo' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>+{minutos} min</span>
                        </span>
                      )}
                      {status === 'rojo' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-500" />
                          <span>Inasistente</span>
                        </span>
                      )}

                      {student.acudiente_contacto && (
                        <button
                          type="button"
                          onClick={(e) => handleNotifyWhatsApp(student, attendance, e)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            attendance
                              ? 'text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                              : 'text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border-amber-200'
                          }`}
                          title={attendance ? "Enviar WhatsApp de Asistencia/Salida" : "Notificar Inasistencia por WhatsApp"}
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

      {/* Student Detail Modal */}
      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
        />
      )}
    </div>
  );
};
