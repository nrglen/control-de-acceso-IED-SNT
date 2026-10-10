import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  CreditCard, 
  Camera, 
  Upload, 
  Trash2, 
  Edit3, 
  Radio, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  X, 
  RefreshCw,
  Sparkles,
  CameraOff,
  Mail,
  User,
  Phone,
  Eye,
  GraduationCap
} from 'lucide-react';
import { Estudiante, ModoInfo } from '../types';
import { StudentDetailModal } from './StudentDetailModal';

interface Props {
  students: Estudiante[];
  modoInfo: ModoInfo;
  onActivateModoRegistro: () => Promise<void>;
  onCancelModoRegistro: () => Promise<void>;
  pendingCardUid: string | null;
  onClearPendingCard: () => Promise<void>;
  onRefreshStudents: () => Promise<void>;
  lastLecturaState: { estado: string; nombre: string | null; uid: string } | null;
}

export const StudentsView: React.FC<Props> = ({
  students,
  modoInfo,
  onActivateModoRegistro,
  onCancelModoRegistro,
  pendingCardUid,
  onClearPendingCard,
  onRefreshStudents,
  lastLecturaState
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Estudiante | null>(null);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<Estudiante | null>(null);

  // Quick Card Change State
  const [cardModalStudent, setCardModalStudent] = useState<Estudiante | null>(null);
  const [newCardUid, setNewCardUid] = useState('');
  const [cardUpdateMsg, setCardUpdateMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [assignedCardSuccess, setAssignedCardSuccess] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    codigo: '',
    uid: '',
    nombre: '',
    grado: '6° - 1',
    correo: '',
    acudiente_nombre: '',
    acudiente_contacto: '',
    acudiente_correo: '',
    fotoUrl: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<'upload' | 'camera'>('upload');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Submitting & status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-fill UID and handle automatic sensor association
  useEffect(() => {
    if (pendingCardUid) {
      if (isModalOpen) {
        setFormData((prev) => ({ ...prev, uid: pendingCardUid }));
        onCancelModoRegistro();
      }
      if (cardModalStudent && !assignedCardSuccess) {
        setAssignedCardSuccess(pendingCardUid);
        onRefreshStudents();
        setTimeout(() => {
          setCardModalStudent(null);
          setAssignedCardSuccess(null);
        }, 1800);
      }
    }
  }, [pendingCardUid, isModalOpen, cardModalStudent, assignedCardSuccess, onRefreshStudents, onCancelModoRegistro]);

  // If a reading occurs while modal is open in registration mode, assign it immediately
  useEffect(() => {
    if (isModalOpen && lastLecturaState?.uid && modoInfo.modo === 'registro') {
      setFormData((prev) => ({ ...prev, uid: lastLecturaState.uid }));
      onCancelModoRegistro();
    }
  }, [lastLecturaState, isModalOpen, modoInfo.modo, onCancelModoRegistro]);

  // Listen to lastLecturaState if backend completed association directly
  useEffect(() => {
    if (cardModalStudent && lastLecturaState) {
      if (lastLecturaState.estado === 'tarjeta_asignada' && !assignedCardSuccess) {
        setAssignedCardSuccess(lastLecturaState.uid);
        onRefreshStudents();
        setTimeout(() => {
          setCardModalStudent(null);
          setAssignedCardSuccess(null);
        }, 1800);
      } else if (lastLecturaState.estado === 'tarjeta_ya_asignada') {
        setCardUpdateMsg({
          type: 'err',
          text: `La tarjeta ${lastLecturaState.uid} ya está asignada a ${lastLecturaState.nombre || 'otro estudiante'}.`
        });
      }
    }
  }, [lastLecturaState, cardModalStudent, assignedCardSuccess, onRefreshStudents]);

  // Clean camera stream on unmount or mode switch
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Start webcam
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 480, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Error starting camera:', err);
      setCameraError('No se pudo acceder a la cámara web. Verifique los permisos de su navegador.');
      setIsCameraActive(false);
    }
  };

  // Capture snapshot from webcam
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw square cropped image
    const v = videoRef.current;
    const minDim = Math.min(v.videoWidth, v.videoHeight);
    const startX = (v.videoWidth - minDim) / 2;
    const startY = (v.videoHeight - minDim) / 2;

    ctx.drawImage(v, startX, startY, minDim, minDim, 0, 0, 400, 400);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhotoBase64(dataUrl);
    setSelectedFile(null);
    stopCamera();
  };

  // Open modal for creating or editing
  const handleOpenCreate = () => {
    setEditingStudent(null);
    setFormData({
      codigo: `EST-601-${Math.floor(100 + Math.random() * 900)}`,
      uid: '',
      nombre: '',
      grado: '6° - 1',
      correo: '',
      acudiente_nombre: '',
      acudiente_contacto: '',
      acudiente_correo: '',
      fotoUrl: ''
    });
    setSelectedFile(null);
    setCapturedPhotoBase64(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenCardModal = async (student: Estudiante) => {
    setCardModalStudent(student);
    setNewCardUid(student.uid || '');
    setCardUpdateMsg(null);
    setShowManualInput(false);
    setAssignedCardSuccess(null);

    // Tell the backend to listen for this student's card directly from sensor
    try {
      await fetch('/api/modo/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estudiante_id: student.id })
      });
    } catch (err) {
      console.error('Error activating registration mode:', err);
    }
  };

  const handleCloseCardModal = async () => {
    setCardModalStudent(null);
    setAssignedCardSuccess(null);
    setShowManualInput(false);
    try {
      await fetch('/api/modo/asistencia', { method: 'POST' });
    } catch {}
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardModalStudent) return;
    const cleanUid = newCardUid.replace(/[:\s]/g, '').trim().toUpperCase();
    if (!cleanUid) {
      setCardUpdateMsg({ type: 'err', text: 'Ingrese un UID válido.' });
      return;
    }
    setIsSavingCard(true);
    setCardUpdateMsg(null);
    try {
      const res = await fetch(`/api/estudiantes/${cardModalStudent.id}/tarjeta`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: cleanUid })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Error al actualizar la tarjeta.');
      }
      await onRefreshStudents();
      setCardUpdateMsg({ type: 'ok', text: '¡Tarjeta RFID vinculada con éxito!' });
      setTimeout(() => {
        setCardModalStudent(null);
      }, 1300);
    } catch (err: any) {
      setCardUpdateMsg({ type: 'err', text: err.message || 'Error de red.' });
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleOpenEdit = (student: Estudiante) => {
    setEditingStudent(student);
    setFormData({
      codigo: student.codigo || `EST-${student.id.toString().padStart(4, '0')}`,
      uid: student.uid,
      nombre: student.nombre,
      grado: student.grado,
      correo: student.correo || '',
      acudiente_nombre: student.acudiente_nombre || '',
      acudiente_contacto: student.acudiente_contacto || '',
      acudiente_correo: student.acudiente_correo || '',
      fotoUrl: student.foto || ''
    });
    setSelectedFile(null);
    setCapturedPhotoBase64(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    stopCamera();
    if (modoInfo.modo === 'registro') {
      onCancelModoRegistro();
    }
    setIsModalOpen(false);
    setEditingStudent(null);
  };

  // Submit create or edit form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanUid = formData.uid.replace(/[:\s]/g, '').trim().toUpperCase();
    if (!cleanUid || !formData.nombre.trim() || !formData.grado.trim()) {
      setFormError('El UID, nombre y grado son campos requeridos.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = new FormData();
      data.append('uid', cleanUid);
      data.append('nombre', formData.nombre.trim());
      data.append('grado', formData.grado.trim());
      data.append('codigo', formData.codigo.trim());
      data.append('correo', formData.correo.trim());
      data.append('acudiente_nombre', formData.acudiente_nombre.trim());
      data.append('acudiente_contacto', formData.acudiente_contacto.trim());
      data.append('acudiente_correo', formData.acudiente_correo.trim());

      if (selectedFile) {
        data.append('foto', selectedFile);
      } else if (capturedPhotoBase64) {
        data.append('foto_base64', capturedPhotoBase64);
      } else if (formData.fotoUrl) {
        data.append('foto', formData.fotoUrl);
      }

      const url = editingStudent
        ? `/api/estudiantes/${editingStudent.id}`
        : '/api/estudiantes';
      const method = editingStudent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: data
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Error al guardar el estudiante.');
      }

      await onRefreshStudents();
      handleCloseModal();
    } catch (err: any) {
      setFormError(err.message || 'Error de red al guardar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete student
  const handleDeleteStudent = async (id: number) => {
    try {
      const res = await fetch(`/api/estudiantes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await onRefreshStudents();
        setDeleteConfirmId(null);
      }
    } catch (e) {
      console.error('Error deleting student:', e);
    }
  };

  // Filtered student list
  const filteredStudents = students.filter((st) => {
    const q = searchTerm.toLowerCase();
    return (
      st.nombre.toLowerCase().includes(q) ||
      st.uid.toLowerCase().includes(q) ||
      st.grado.toLowerCase().includes(q) ||
      (st.codigo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            <span>Directorio de Estudiantes y Tarjetas RFID</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestione las tarjetas RFID asociadas, información de acudientes y capture fotografías.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Registration Mode Button */}
          {modoInfo.modo === 'asistencia' ? (
            <button
              onClick={onActivateModoRegistro}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-amber-200 cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>Registrar Tarjeta Nueva</span>
            </button>
          ) : (
            <button
              onClick={onCancelModoRegistro}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Modo Registro Activo ({modoInfo.segundos_restantes}s) - Cancelar</span>
            </button>
          )}

          {/* New Student Manual Button */}
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Estudiante</span>
          </button>
        </div>
      </div>

      {/* Prominent Banner when in Registration Mode */}
      {modoInfo.modo === 'registro' && (
        <div className="bg-linear-to-r from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-white animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-xs">
                  Modo Registro Activo
                </span>
                <span className="font-mono font-bold text-xs bg-black/20 px-2 py-0.5 rounded">
                  {modoInfo.segundos_restantes} segundos restantes
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-1 max-w-xl">
                Acerque una tarjeta nueva al lector RFID conectado al ESP8266. En este modo <strong>no se marca asistencia</strong>. 
                El UID aparecerá automáticamente en el formulario.
              </p>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {pendingCardUid ? (
              <div className="bg-white text-slate-900 px-3.5 py-1.5 rounded-xl font-mono font-bold text-xs flex items-center gap-2 shadow-xs">
                <span className="text-emerald-600">✓ Capturada:</span>
                <span className="text-blue-700">{pendingCardUid}</span>
              </div>
            ) : (
              <span className="text-xs text-amber-100 italic">Esperando lectura física...</span>
            )}
          </div>
        </div>
      )}

      {/* Warning if already assigned card scanned */}
      {lastLecturaState && lastLecturaState.estado === 'tarjeta_ya_asignada' && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center justify-between text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              La tarjeta <strong>{lastLecturaState.uid}</strong> ya está asignada al alumno{' '}
              <strong>"{lastLecturaState.nombre}"</strong>. No puede duplicarse.
            </span>
          </div>
        </div>
      )}

      {/* Search and Student Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, nombre, grado o UID..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 shadow-xs"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {filteredStudents.length} estudiantes registrados
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-700">No se encontraron estudiantes</h3>
            <p className="text-xs text-slate-400 mt-1">
              Haga clic en "Nuevo Estudiante" o "Registrar Tarjeta Nueva" para registrar alumnos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    {/* Photo / Avatar */}
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-100 shrink-0 shadow-inner">
                      {st.foto ? (
                        <img
                          src={st.foto}
                          alt={st.nombre}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-tr from-blue-100 to-indigo-100 text-blue-700 font-bold text-base">
                          {st.nombre.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                          {st.codigo || `EST-${st.id.toString().padStart(4, '0')}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {st.grado}
                        </span>
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-sm mt-1 truncate" title={st.nombre}>
                        {st.nombre}
                      </h3>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 w-fit">
                          <CreditCard className="w-3 h-3 text-blue-600" />
                          <span>{st.uid || 'Sin tarjeta'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenCardModal(st)}
                          className="text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition-colors cursor-pointer"
                          title="Cambiar o registrar la tarjeta RFID asignada"
                        >
                          Cambiar Tarjeta
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Extra contact badges */}
                  <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 text-xs">
                    {st.acudiente_nombre && (
                      <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                        <User className="w-3 h-3 text-amber-500 shrink-0" />
                        <span className="truncate">Acudiente: {st.acudiente_nombre}</span>
                      </div>
                    )}
                    {st.correo && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="truncate">{st.correo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer card actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setSelectedStudentForDetail(st)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Expediente</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(st)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Editar estudiante"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(st.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar estudiante"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">¿Eliminar estudiante?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Esta acción eliminará al estudiante y sus registros de asistencia asociados. No se puede deshacer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStudent(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>{editingStudent ? 'Editar Estudiante' : 'Nuevo Estudiante'}</span>
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  {formError}
                </div>
              )}

              {/* Grid 2 cols for Code and UID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Código Estudiantil */}
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Código Estudiante *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    placeholder="Ej. EST-2026-001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-blue-700 focus:outline-hidden focus:border-blue-500 uppercase"
                  />
                </div>

                {/* UID Field with Direct RFID Scanner Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      UID de Tarjeta RFID *
                    </label>
                    {formData.uid && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Asignada
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        required
                        value={formData.uid}
                        onChange={(e) =>
                          setFormData({ ...formData, uid: e.target.value.toUpperCase() })
                        }
                        placeholder="Ej. 8B6FD934 o presiona Escanear"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold tracking-wider text-slate-900 focus:outline-hidden focus:border-blue-500 uppercase"
                      />
                      {formData.uid && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, uid: '' })}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Integrated Button to Start/Cancel RFID Scan */}
                    <button
                      type="button"
                      onClick={() => {
                        if (modoInfo.modo === 'registro') {
                          onCancelModoRegistro();
                        } else {
                          onActivateModoRegistro();
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 ${
                        modoInfo.modo === 'registro'
                          ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                      title={modoInfo.modo === 'registro' ? 'Cancelar escaneo' : 'Activar lector RFID para asignar tarjeta'}
                    >
                      <Radio className={`w-3.5 h-3.5 ${modoInfo.modo === 'registro' ? 'animate-spin' : ''}`} />
                      <span>{modoInfo.modo === 'registro' ? 'Cancelar' : 'Escanear Tarjeta'}</span>
                    </button>
                  </div>

                  {/* Active Sensor Listening Banner */}
                  {modoInfo.modo === 'registro' && (
                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 animate-pulse shadow-xs">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                        <div>
                          <span className="font-bold block">📡 Lector activo: Acerca la tarjeta RFID al sensor</span>
                          <span className="text-[11px] text-amber-700">
                            La primera lectura se asignará automáticamente a este estudiante ({modoInfo.segundos_restantes}s)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success Banner when Card Detected */}
                  {formData.uid && modoInfo.modo !== 'registro' && (
                    <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Tarjeta asignada: <code className="font-mono text-emerald-950 font-black">{formData.uid}</code></span>
                      </div>
                      <button
                        type="button"
                        onClick={onActivateModoRegistro}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-semibold cursor-pointer"
                      >
                        Cambiar tarjeta
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Nombre Field */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Nombre Completo del Alumno *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Ej. Sofía Martínez Reyes"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Grado & Correo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Grado / Sección *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.grado}
                    onChange={(e) => setFormData({ ...formData, grado: e.target.value })}
                    placeholder="Ej. 10° - A"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Correo Institucional
                  </label>
                  <input
                    type="email"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                    placeholder="sofia.martinez@colegio.edu.co"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Guardian Info */}
              <div className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200/70 space-y-3">
                <span className="text-xs font-black text-amber-800 uppercase tracking-wider block">
                  Información del Acudiente / Familiar
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      Nombre del Padre o Acudiente
                    </label>
                    <input
                      type="text"
                      value={formData.acudiente_nombre}
                      onChange={(e) => setFormData({ ...formData, acudiente_nombre: e.target.value })}
                      placeholder="Ej. Patricia Reyes Mendoza"
                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      Teléfono / WhatsApp de Contacto
                    </label>
                    <input
                      type="text"
                      value={formData.acudiente_contacto}
                      onChange={(e) => setFormData({ ...formData, acudiente_contacto: e.target.value })}
                      placeholder="+57 315 889 4421"
                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-amber-900 block mb-1">
                      Correo Electrónico del Acudiente (Notificaciones de Asistencia)
                    </label>
                    <input
                      type="email"
                      value={formData.acudiente_correo}
                      onChange={(e) => setFormData({ ...formData, acudiente_correo: e.target.value })}
                      placeholder="patricia.reyes@gmail.com"
                      className="w-full bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Foto Section: Upload or Camera */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Fotografía del Estudiante (Opcional)
                </label>

                {/* Tabs Upload / Camera */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setPhotoMode('upload');
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      photoMode === 'upload'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Archivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoMode('camera');
                      startCamera();
                    }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                      photoMode === 'camera'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Cámara Web</span>
                  </button>
                </div>

                {/* Mode 1: File upload */}
                {photoMode === 'upload' && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                          setCapturedPhotoBase64(null);
                        }
                      }}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                )}

                {/* Mode 2: Camera Stream */}
                {photoMode === 'camera' && (
                  <div className="space-y-2">
                    {cameraError ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                        {cameraError}
                      </div>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-700 aspect-square max-w-[220px] mx-auto flex items-center justify-center">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                        />
                        {!isCameraActive && (
                          <div className="text-center p-4 text-slate-400 text-xs">
                            Iniciando cámara...
                          </div>
                        )}
                      </div>
                    )}

                    {isCameraActive && (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={captureSnapshot}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Tomar Foto</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Photo Preview */}
                {(capturedPhotoBase64 || selectedFile || formData.fotoUrl) && (
                  <div className="mt-3 flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={
                        capturedPhotoBase64 ||
                        (selectedFile ? URL.createObjectURL(selectedFile) : formData.fotoUrl)
                      }
                      alt="Preview"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-300"
                    />
                    <div className="text-xs flex-1">
                      <span className="font-bold text-slate-800 block">Foto seleccionada</span>
                      <span className="text-[11px] text-slate-400">
                        {capturedPhotoBase64
                          ? 'Capturada desde cámara'
                          : selectedFile
                          ? selectedFile.name
                          : 'Foto actual'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setCapturedPhotoBase64(null);
                        setFormData({ ...formData, fotoUrl: '' });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : editingStudent ? 'Guardar Cambios' : 'Registrar Alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Card Assignment / Change Modal (Sensor Contactless First) */}
      {cardModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-scaleUp">
            {/* Header */}
            <div className={`p-5 text-white flex items-center justify-between transition-colors ${
              assignedCardSuccess ? 'bg-emerald-600' : 'bg-linear-to-r from-blue-600 to-indigo-700'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                  {assignedCardSuccess ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Radio className="w-6 h-6 text-white animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-200 block">
                    {assignedCardSuccess ? '¡Operación Exitosa!' : 'Sensor RFID Activo'}
                  </span>
                  <h3 className="text-base font-black text-white">
                    {assignedCardSuccess ? 'Tarjeta Vinculada' : 'Acerca la Tarjeta al Lector'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCardModal}
                className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Student info preview */}
              <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <div className="w-13 h-13 rounded-2xl bg-blue-100 text-blue-700 font-black text-base flex items-center justify-center shrink-0 border border-blue-200 overflow-hidden">
                  {cardModalStudent.foto ? (
                    <img
                      src={cardModalStudent.foto}
                      alt={cardModalStudent.nombre}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    cardModalStudent.nombre.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-mono font-bold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded">
                    {cardModalStudent.codigo || `EST-601-${cardModalStudent.id}`}
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate mt-1">
                    {cardModalStudent.nombre}
                  </h4>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Grado: <strong className="text-slate-700">6° - 1</strong> • Tarjeta actual: <span className="font-mono font-bold text-slate-700">{cardModalStudent.uid || 'Ninguna'}</span>
                  </div>
                </div>
              </div>

              {/* SUCCESS STATE */}
              {assignedCardSuccess ? (
                <div className="py-6 text-center space-y-3 animate-fadeIn">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-md">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">
                      ¡Tarjeta Registrada con Éxito!
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      El estudiante <strong>{cardModalStudent.nombre}</strong> ahora usará este UID.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-mono text-base font-bold shadow-inner">
                    <span className="text-slate-400 text-xs">UID:</span>
                    <span className="text-emerald-400">{assignedCardSuccess}</span>
                  </div>
                </div>
              ) : (
                /* WAITING SCAN STATE */
                <div className="py-3 text-center space-y-4">
                  {/* Radar Wave Animation */}
                  <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                    <div className="absolute inset-2 rounded-full bg-blue-500/30 animate-pulse" />
                    <div className="relative w-20 h-20 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex flex-col items-center justify-center shadow-lg border-2 border-white">
                      <Radio className="w-8 h-8 animate-pulse text-amber-300" />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Pasa la nueva tarjeta por el lector físico
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                      El sensor ESP8266 está abierto. Al acercar la tarjeta, el sistema la asociará automáticamente al estudiante.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-800 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Esperando lectura del sensor...</span>
                  </div>
                </div>
              )}

              {/* Error message if card already assigned */}
              {cardUpdateMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cardUpdateMsg.text}</span>
                </div>
              )}

              {/* Optional Manual Fallback Toggle */}
              {!assignedCardSuccess && (
                <div className="pt-2 border-t border-slate-100">
                  {!showManualInput ? (
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowManualInput(true)}
                        className="text-[11px] font-bold text-slate-500 hover:text-blue-600 underline cursor-pointer"
                      >
                        ¿No tienes el lector conectado? Escribir UID a mano
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveCard} className="space-y-3 pt-1 animate-fadeIn">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Ingresar UID manualmente
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={newCardUid}
                            onChange={(e) => setNewCardUid(e.target.value.toUpperCase())}
                            placeholder="Ej. 8B6FD934"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider text-slate-900 focus:outline-hidden focus:border-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={isSavingCard || !newCardUid.trim()}
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            {isSavingCard ? '...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleCloseCardModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {assignedCardSuccess ? 'Listo' : 'Cancelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
