import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Settings, 
  School, 
  Clock, 
  Calendar,
  BookOpen, 
  Wifi, 
  Cpu, 
  Globe, 
  Save, 
  Upload, 
  Image as ImageIcon, 
  RefreshCw, 
  Check, 
  Copy, 
  Download, 
  Play, 
  Shield, 
  KeyRound, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  Sparkles,
  HelpCircle,
  Laptop,
  Server,
  Mail,
  MessageSquare
} from 'lucide-react';
import { AppSettings, DiaHorario } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentSettings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>;
  onLogoUploaded?: (newLogoUrl: string) => void;
  onOpenParentNotifications?: () => void;
  onOpenEmailConfig?: () => void;
}

export const DEFAULT_HORARIOS: DiaHorario[] = [
  { dia: 'lunes', nombreDia: 'Lunes', activo: true, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' },
  { dia: 'martes', nombreDia: 'Martes', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' },
  { dia: 'miercoles', nombreDia: 'Miércoles', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' },
  { dia: 'jueves', nombreDia: 'Jueves', activo: true, hora_entrada: '10:00', minutos_tolerancia: 10, hora_limite: '10:10' },
  { dia: 'viernes', nombreDia: 'Viernes', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' },
  { dia: 'sabado', nombreDia: 'Sábado', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' },
  { dia: 'domingo', nombreDia: 'Domingo', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40' }
];

type TabType = 'identidad' | 'horarios' | 'academico' | 'esp8266' | 'seguridad' | 'notificaciones';

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentSettings,
  onSaveSettings,
  onLogoUploaded,
  onOpenParentNotifications,
  onOpenEmailConfig
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('identidad');
  const [form, setForm] = useState<AppSettings>(() => ({
    ...currentSettings,
    horarios_semanales: (currentSettings.horarios_semanales && currentSettings.horarios_semanales.length > 0)
      ? currentSettings.horarios_semanales
      : DEFAULT_HORARIOS
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>(currentSettings.logo_url || '/static/logo.svg');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Network info & endpoint testing state
  const [networkInfo, setNetworkInfo] = useState<{
    detectedWebUrl: string;
    detectedLanUrl: string;
    localIps: string[];
    port: number;
  } | null>(null);

  const [testEndpointUrl, setTestEndpointUrl] = useState('');
  const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: number;
    latencyMs: number;
    response?: any;
    error?: string;
  } | null>(null);

  // Arduino code state
  const [arduinoCode, setArduinoCode] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  // Admin password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Sync state when currentSettings or modal opens
  useEffect(() => {
    if (isOpen) {
      const initialHorarios = (currentSettings.horarios_semanales && currentSettings.horarios_semanales.length > 0)
        ? currentSettings.horarios_semanales
        : DEFAULT_HORARIOS;

      setForm({
        ...currentSettings,
        horarios_semanales: initialHorarios
      });
      setLogoPreview(currentSettings.logo_url || '/static/logo.svg');
      setStatusMsg(null);
      setTestResult(null);

      // Fetch server network IPs & web URL
      fetch('/api/app-config')
        .then((res) => res.json())
        .then((data) => {
          if (data) {
            setNetworkInfo({
              detectedWebUrl: data.detectedWebUrl,
              detectedLanUrl: data.detectedLanUrl,
              localIps: data.localIps || [],
              port: data.port || 3000
            });
            if (!currentSettings.esp_endpoint_url) {
              const defaultWeb = typeof window !== 'undefined' 
                ? `${window.location.origin}/api/lectura` 
                : data.detectedWebUrl;
              setForm((prev) => ({ ...prev, esp_endpoint_url: prev.esp_endpoint_url || defaultWeb }));
              setTestEndpointUrl(defaultWeb);
            } else {
              setTestEndpointUrl(currentSettings.esp_endpoint_url);
            }
          }
        })
        .catch(() => {});

      // Fetch live Arduino code
      fetch('/api/esp8266/arduino-code')
        .then((res) => res.json())
        .then((data) => {
          if (data?.code) setArduinoCode(data.code);
        })
        .catch(() => {});
    }
  }, [isOpen, currentSettings]);

  if (!isOpen) return null;

  // Calculate live dynamic hora límite
  const calcularHoraLimite = (horaEntrada: string, minutosTolerancia: number) => {
    try {
      const [h, m] = horaEntrada.split(':').map(Number);
      const totalMin = h * 60 + m + Number(minutosTolerancia);
      const limH = Math.floor(totalMin / 60) % 24;
      const limM = totalMin % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(limH)}:${pad(limM)}`;
    } catch {
      return '08:40';
    }
  };

  const horaLimiteCalculada = calcularHoraLimite(form.hora_entrada, form.minutos_tolerancia);

  // Weekly schedule day key for today
  const getTodayDiaKey = (): 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo' => {
    const d = new Date();
    const dias: ('domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado')[] = [
      'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'
    ];
    return dias[d.getDay()] || 'lunes';
  };

  const diaHoyKey = getTodayDiaKey();
  const horariosActuales = form.horarios_semanales && form.horarios_semanales.length > 0
    ? form.horarios_semanales
    : DEFAULT_HORARIOS;
  const horarioHoy = horariosActuales.find((h) => h.dia === diaHoyKey) || {
    dia: diaHoyKey,
    nombreDia: diaHoyKey.charAt(0).toUpperCase() + diaHoyKey.slice(1),
    activo: true,
    hora_entrada: form.hora_entrada || '08:30',
    minutos_tolerancia: form.minutos_tolerancia || 10,
    hora_limite: horaLimiteCalculada
  };

  // Handlers for weekly schedule modifications
  const handleToggleDia = (diaKey: string) => {
    setForm((prev) => {
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) =>
        item.dia === diaKey ? { ...item, activo: !item.activo } : item
      );
      return { ...prev, horarios_semanales: updated };
    });
  };

  const handleHoraDiaChange = (diaKey: string, hora: string) => {
    setForm((prev) => {
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) => {
        if (item.dia === diaKey) {
          const lim = calcularHoraLimite(hora, item.minutos_tolerancia);
          return { ...item, hora_entrada: hora, hora_limite: lim };
        }
        return item;
      });
      return { ...prev, horarios_semanales: updated };
    });
  };

  const handleHoraFinalizacionDiaChange = (diaKey: string, hora: string) => {
    setForm((prev) => {
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) => {
        if (item.dia === diaKey) {
          return { ...item, hora_finalizacion: hora };
        }
        return item;
      });
      return { ...prev, horarios_semanales: updated };
    });
  };

  const handleToleranciaDiaChange = (diaKey: string, tol: number) => {
    setForm((prev) => {
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) => {
        if (item.dia === diaKey) {
          const lim = calcularHoraLimite(item.hora_entrada, tol);
          return { ...item, minutos_tolerancia: tol, hora_limite: lim };
        }
        return item;
      });
      return { ...prev, horarios_semanales: updated };
    });
  };

  const handleApplyPreset = (preset: 'lunes-jueves' | 'lunes-viernes' | 'lunes-miercoles-viernes' | 'todos') => {
    setForm((prev) => {
      const baseHora = prev.hora_entrada || '08:30';
      const baseTol = Number(prev.minutos_tolerancia) || 10;
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) => {
        let activo = false;
        let hora = item.hora_entrada || baseHora;
        let tol = item.minutos_tolerancia !== undefined ? item.minutos_tolerancia : baseTol;
        let horaFin = item.hora_finalizacion || '14:00';

        if (preset === 'lunes-jueves') {
          activo = item.dia === 'lunes' || item.dia === 'jueves';
          if (item.dia === 'lunes') hora = '08:30';
          if (item.dia === 'jueves') {
            hora = '10:00';
            horaFin = '16:00';
          }
        } else if (preset === 'lunes-viernes') {
          activo = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].includes(item.dia);
        } else if (preset === 'lunes-miercoles-viernes') {
          activo = ['lunes', 'miercoles', 'viernes'].includes(item.dia);
        } else if (preset === 'todos') {
          activo = true;
        }

        return {
          ...item,
          activo,
          hora_entrada: hora,
          minutos_tolerancia: tol,
          hora_limite: calcularHoraLimite(hora, tol),
          hora_finalizacion: horaFin
        };
      });
      return { ...prev, horarios_semanales: updated };
    });
  };

  const handleCopyBaseTimeToAll = () => {
    setForm((prev) => {
      const baseHora = prev.hora_entrada || '08:30';
      const baseTol = Number(prev.minutos_tolerancia) || 10;
      const baseLim = calcularHoraLimite(baseHora, baseTol);
      const baseFin = prev.hora_finalizacion || '14:00';
      const list = prev.horarios_semanales && prev.horarios_semanales.length > 0
        ? prev.horarios_semanales
        : DEFAULT_HORARIOS;
      const updated = list.map((item) => {
        if (!item.activo) return item;
        return {
          ...item,
          hora_entrada: baseHora,
          minutos_tolerancia: baseTol,
          hora_limite: baseLim,
          hora_finalizacion: baseFin
        };
      });
      return { ...prev, horarios_semanales: updated };
    });
  };

  // Handle Logo file selection
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setStatusMsg({ type: 'err', text: 'El archivo de logo no debe superar los 5MB.' });
        return;
      }
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  // Upload Logo
  const handleUploadLogo = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    setStatusMsg(null);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const res = await fetch('/api/app-config/logo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setLogoPreview(data.logo_url);
        setForm((prev) => ({ ...prev, logo_url: data.logo_url }));
        if (onLogoUploaded) onLogoUploaded(data.logo_url);
        setStatusMsg({ type: 'ok', text: '¡Logo institucional actualizado exitosamente!' });
        setLogoFile(null);
      } else {
        setStatusMsg({ type: 'err', text: data.error || 'Error al subir el logo.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Error de conexión al subir logo.' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Restore Default Logo
  const handleRestoreDefaultLogo = async () => {
    const defaultLogo = '/static/logo.svg';
    setLogoPreview(defaultLogo);
    setLogoFile(null);
    setForm((prev) => ({ ...prev, logo_url: defaultLogo }));
    try {
      await fetch('/api/app-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo_url: defaultLogo })
      });
      if (onLogoUploaded) onLogoUploaded(defaultLogo);
      setStatusMsg({ type: 'ok', text: 'Se ha restaurado el logo oficial institucional.' });
    } catch {}
  };

  // Save General Settings
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      // If there is an unsaved logo file, upload it first
      let currentLogo = form.logo_url;
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const logoRes = await fetch('/api/app-config/logo', { method: 'POST', body: formData });
        const logoData = await logoRes.json();
        if (logoRes.ok && logoData.ok) {
          currentLogo = logoData.logo_url;
          if (onLogoUploaded) onLogoUploaded(currentLogo);
        }
      }

      const settingsToSave: Partial<AppSettings> = {
        ...form,
        logo_url: currentLogo,
        minutos_tolerancia: Number(form.minutos_tolerancia)
      };

      const success = await onSaveSettings(settingsToSave);
      if (success) {
        setStatusMsg({ type: 'ok', text: '¡Todos los ajustes fueron guardados y aplicados exitosamente!' });
        // Refresh live Arduino code
        const codeRes = await fetch('/api/esp8266/arduino-code');
        const codeData = await codeRes.json();
        if (codeData?.code) setArduinoCode(codeData.code);
      } else {
        setStatusMsg({ type: 'err', text: 'Hubo un error al guardar los ajustes.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err.message || 'Error de conexión.' });
    } finally {
      setIsSaving(false);
    }
  };

  // Test Endpoint Live
  const handleTestEndpoint = async () => {
    const targetUrl = testEndpointUrl || form.esp_endpoint_url;
    if (!targetUrl) {
      setStatusMsg({ type: 'err', text: 'Por favor ingresa una URL de endpoint válida.' });
      return;
    }

    setIsTestingEndpoint(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: targetUrl,
          uid: '8B6FD934',
          salon: form.salon,
          asignatura: form.asignatura
        })
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        status: 0,
        latencyMs: 0,
        error: err.message || 'Fallo de red al probar endpoint'
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  // Change Admin Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
      setPassMsg({ type: 'err', text: 'Las nuevas contraseñas no coinciden.' });
      return;
    }
    setPassLoading(true);
    setPassMsg(null);

    try {
      const res = await fetch('/api/config/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setPassMsg({ type: 'ok', text: '¡Contraseña de administrador actualizada con éxito!' });
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
      } else {
        setPassMsg({ type: 'err', text: data.error || 'Error al cambiar contraseña' });
      }
    } catch {
      setPassMsg({ type: 'err', text: 'Error de conexión con el servidor.' });
    } finally {
      setPassLoading(false);
    }
  };

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-red-950 p-5 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-red-600/30 border border-red-500/40 flex items-center justify-center text-white shadow-inner">
              <Settings className="w-6 h-6 text-amber-400 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                  Panel de Control Maestro
                </span>
                <span className="text-xs text-slate-400 font-mono">Personalización Total</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                Ajustes y Configuración del Sistema
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Toast / Banner */}
        {statusMsg && (
          <div className={`px-5 py-3 text-xs font-bold flex items-center justify-between border-b ${
            statusMsg.type === 'ok' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {statusMsg.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('identidad')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'identidad'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <School className="w-4 h-4 text-red-600" />
            <span>Colegio & Logo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('horarios')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'horarios'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Horario & Tolerancia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('academico')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'academico'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>Salón, Materia & Docente</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('esp8266')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'esp8266'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-600" />
            <span>ESP8266 & Web Endpoint</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seguridad')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'seguridad'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Shield className="w-4 h-4 text-blue-600" />
            <span>Seguridad & Clave</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notificaciones')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'notificaciones'
                ? 'bg-white text-red-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Mail className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp y Correo</span>
          </button>
        </div>

        {/* Modal Body Forms */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* ============================================================ */}
          {/* TAB 1: IDENTIDAD INSTITUCIONAL Y LOGO                        */}
          {/* ============================================================ */}
          {activeTab === 'identidad' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <School className="w-5 h-5 text-red-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Identidad Institucional del Colegio
                  </h3>
                </div>

                {/* Nombre del Colegio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Nombre del Colegio / Institución Educativa *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nombre_colegio}
                    onChange={(e) => setForm({ ...form, nombre_colegio: e.target.value })}
                    placeholder="Ej. I.E. SAN NICOLÁS DE TOLENTINO"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 shadow-xs"
                  />
                  <p className="text-[11px] text-slate-400">
                    Aparecerá en el encabezado principal, correos a los padres, mensajes de WhatsApp y reportes.
                  </p>
                </div>

                {/* Lema Institucional */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Lema o Frase Institucional *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.lema_colegio}
                    onChange={(e) => setForm({ ...form, lema_colegio: e.target.value })}
                    placeholder="Ej. Interioridad • Amor • Trascendencia"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 shadow-xs"
                  />
                </div>

                {/* Logo Uploader & Preview */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Escudo / Logo Oficial de la Institución
                  </label>

                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
                    {/* Logo Preview Box */}
                    <div className="relative w-24 h-24 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center p-2 shadow-inner overflow-hidden shrink-0">
                      <img
                        src={logoPreview}
                        alt="Escudo Institucional"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/static/logo.svg';
                        }}
                      />
                    </div>

                    {/* Logo Controls */}
                    <div className="flex-1 space-y-2.5 text-center sm:text-left">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Cambiar Escudo o Logo
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Soporta formatos PNG, JPG, SVG o WebP (con fondo transparente recomendado).
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-amber-400" />
                          <span>Seleccionar Imagen</span>
                        </button>

                        {logoFile && (
                          <button
                            type="button"
                            onClick={handleUploadLogo}
                            disabled={isUploadingLogo}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isUploadingLogo ? 'Subiendo...' : 'Guardar Logo'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleRestoreDefaultLogo}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                          title="Restaurar el escudo predeterminado de San Nicolás de Tolentino"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Restaurar Predeterminado</span>
                        </button>
                      </div>

                      {/* Manual Image URL (Optional) */}
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">O ingrese una URL de imagen web:</span>
                        <input
                          type="text"
                          value={form.logo_url}
                          onChange={(e) => {
                            setForm({ ...form, logo_url: e.target.value });
                            setLogoPreview(e.target.value);
                          }}
                          placeholder="https://mi-colegio.edu.co/logo.png"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-red-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando Ajustes...' : 'Guardar Cambios de Identidad'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* TAB 2: HORARIOS Y TOLERANCIA DE PUNTUALIDAD                  */}
          {/* ============================================================ */}
          {activeTab === 'horarios' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Status Banner for Today */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${
                horarioHoy.activo 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
                  : 'bg-slate-100 border-slate-300 text-slate-800'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl font-bold ${
                    horarioHoy.activo ? 'bg-emerald-600 text-white' : 'bg-slate-400 text-white'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider">
                        Estado de Hoy: {horarioHoy.nombreDia}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        horarioHoy.activo ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {horarioHoy.activo ? '🟢 Día de Clase Activo' : '⚪ Sin Clase Programada'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {horarioHoy.activo ? (
                        <>Hora de entrada hoy: <strong>{horarioHoy.hora_entrada}</strong> • Tolerancia hasta las <strong>{horarioHoy.hora_limite}</strong> ({horarioHoy.minutos_tolerancia} min)</>
                      ) : (
                        <>Hoy no está configurado como día de clase. Las lecturas se registrarán sin penalizar por retraso.</>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleDia(diaHoyKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    horarioHoy.activo
                      ? 'bg-rose-100 hover:bg-rose-200 text-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {horarioHoy.activo ? 'Desactivar clase hoy' : 'Activar clase hoy'}
                </button>
              </div>

              {/* Weekly Presets Section */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Configuraciones Rápidas de Horario Semanal
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Aplica combinaciones comunes en 1 clic
                  </span>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('lunes-jueves')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                    title="Ejemplo solicitado: Lunes a las 08:30 y Jueves a las 10:00"
                  >
                    <span>📌 Solo Lunes y Jueves (Ejemplo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('lunes-viernes')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>🏢 Lunes a Viernes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('lunes-miercoles-viernes')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>📅 Lunes, Miércoles y Viernes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('todos')}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <span>🌐 Todos los días (L-D)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyBaseTimeToAll}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
                    title="Aplica la hora oficial base a todos los días que tengan clase activa"
                  >
                    <span>⚡ Copiar hora base ({form.hora_entrada}) a días activos</span>
                  </button>
                </div>
              </div>

              {/* Base Default Schedule */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-200">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Horario Base Predeterminado
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Se utiliza como plantilla y para los días sin horario personalizado.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Hora Oficial Base */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Hora Base de Entrada (HH:MM) *
                    </label>
                    <input
                      type="time"
                      required
                      value={form.hora_entrada}
                      onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Hora estándar de entrada (ejemplo: <strong>08:30 AM</strong>).
                    </p>
                  </div>

                  {/* Hora de Finalización Base */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Hora de Finalización Base *
                    </label>
                    <input
                      type="time"
                      required
                      value={form.hora_finalizacion || '14:00'}
                      onChange={(e) => setForm({ ...form, hora_finalizacion: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-slate-400">
                      Hora estándar de finalización (ejemplo: <strong>14:00</strong>).
                    </p>
                  </div>

                  {/* Minutos de Tolerancia Base */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Minutos de Tolerancia Base *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="120"
                        required
                        value={form.minutos_tolerancia}
                        onChange={(e) => setForm({ ...form, minutos_tolerancia: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-slate-600 shrink-0">minutos</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Margen de gracia por defecto (ejemplo: <strong>10 minutos</strong>).
                    </p>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Weekly Schedule Editor */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                        Horario y Días de Clase en la Semana (Lunes a Domingo)
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Activa solo los días que se dicta clase y define una hora diferente para cada uno.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {horariosActuales.map((item) => {
                    const isToday = item.dia === diaHoyKey;
                    const limite = item.hora_limite || calcularHoraLimite(item.hora_entrada, item.minutos_tolerancia);

                    return (
                      <div
                        key={item.dia}
                        className={`p-4 rounded-2xl border transition-all ${
                          item.activo
                            ? isToday
                              ? 'bg-amber-50/80 border-amber-300 shadow-sm'
                              : 'bg-white border-slate-200/90 shadow-xs'
                            : 'bg-slate-100/70 border-slate-200 opacity-70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          {/* Day Header & Status */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleDia(item.dia)}
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                                item.activo 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-slate-300 text-slate-600'
                              }`}
                              title={item.activo ? 'Desactivar clase este día' : 'Activar clase este día'}
                            >
                              {item.activo ? '✓' : '—'}
                            </button>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-slate-900">
                                  {item.nombreDia}
                                </span>
                                {isToday && (
                                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded-md tracking-wider">
                                    HOY
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.activo
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {item.activo ? 'Clase programada' : 'Sin clase'}
                                </span>
                              </div>
                              {!item.activo && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  No se dicta clase este día. Las asistencias registradas no acumulan retraso.
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Time & Tolerance Inputs (If active) */}
                          {item.activo ? (
                            <div className="flex items-center flex-wrap gap-2.5 sm:ml-auto">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                  Hora Entrada:
                                </label>
                                <input
                                  type="time"
                                  value={item.hora_entrada}
                                  onChange={(e) => handleHoraDiaChange(item.dia, e.target.value)}
                                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                  Hora Salida:
                                </label>
                                <input
                                  type="time"
                                  value={item.hora_finalizacion || '14:00'}
                                  onChange={(e) => handleHoraFinalizacionDiaChange(item.dia, e.target.value)}
                                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                                  Tolerancia:
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={item.minutos_tolerancia}
                                    onChange={(e) => handleToleranciaDiaChange(item.dia, Number(e.target.value))}
                                    className="w-16 bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <span className="text-[11px] text-slate-500">min</span>
                                </div>
                              </div>

                              <div className="hidden md:block pl-2 border-l border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">
                                  Límite Puntual:
                                </span>
                                <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 block">
                                  Hasta {limite}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleDia(item.dia)}
                              className="px-3 py-1.5 bg-slate-200 hover:bg-emerald-600 hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer sm:ml-auto"
                            >
                              + Activar {item.nombreDia}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Logic Summary */}
              <div className="p-4 bg-linear-to-r from-amber-500/10 via-amber-500/20 to-teal-500/10 rounded-2xl border border-amber-300/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Resumen de la Regla de Puntualidad Semanal</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 text-emerald-900 shadow-xs">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" /> ASISTENCIA PUNTUAL
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      El sistema consulta la hora del día en que se pasa la tarjeta. Si el alumno llega antes de la hora de entrada + los minutos de tolerancia de ese día específico, se clasifica como <strong>PUNTUAL</strong>.
                    </p>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-rose-200 text-rose-900 shadow-xs">
                    <span className="font-bold flex items-center gap-1.5 text-rose-700">
                      <AlertTriangle className="w-4 h-4" /> ENTRADA TARDE (RETRASO)
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Si el alumno llega tras vencerse la tolerancia configurada para ese día, se registra automáticamente como <strong>ENTRADA TARDE</strong> con los minutos exactos de retraso acumulados.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando Ajustes...' : 'Guardar Horarios Semanales & Tolerancia'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* TAB 3: SALÓN, ASIGNATURA, GRADO Y PROFESOR                   */}
          {/* ============================================================ */}
          {activeTab === 'academico' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Salón, Grado, Asignatura y Docente Encargado
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nombre del Salón / Punto de Control */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Nombre del Salón / Punto de Control *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.salon}
                      onChange={(e) => setForm({ ...form, salon: e.target.value })}
                      placeholder="Ej. Salón de Informática, Laboratorio 1, Entrada Principal"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                    <p className="text-[11px] text-slate-400">
                      Ubicación física donde está instalado el lector RFID o quiosco de asistencia.
                    </p>
                  </div>

                  {/* Grado / Sección */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Grado / Curso Principal *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.grado}
                      onChange={(e) => setForm({ ...form, grado: e.target.value })}
                      placeholder="Ej. 6° - 1, 7° - A, Primaria, Bachillerato"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                  </div>

                  {/* Asignatura */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Asignatura / Materia *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.asignatura}
                      onChange={(e) => setForm({ ...form, asignatura: e.target.value })}
                      placeholder="Ej. Informática y Tecnología, Matemáticas, Robótica"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                  </div>

                  {/* Profesor / Docente */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Profesor / Docente Encargado *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.profesor}
                      onChange={(e) => setForm({ ...form, profesor: e.target.value })}
                      placeholder="Ej. Prof. Roberto Gómez"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Guardando Ajustes...' : 'Guardar Datos Académicos'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ============================================================ */}
          {/* TAB 4: ESP8266, ENDPOINT Y DESPLIEGUE EN LA WEB             */}
          {/* ============================================================ */}
          {activeTab === 'esp8266' && (
            <div className="space-y-6">
              {/* Solución al Error de Conexión en la Web */}
              <div className="bg-linear-to-r from-amber-500/10 via-amber-500/20 to-emerald-500/10 border-2 border-amber-400/80 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl font-bold shrink-0 mt-0.5 shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-amber-950">
                        ¿Por qué el Monitor Serial dice "Fallo de conexión" al publicar la página en la Web?
                      </h4>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                        Solución Incluida
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Al publicar la aplicación en internet (Google Cloud Run, Vercel, Render o un servidor web), la página exige conexiones <strong>HTTPS seguras con cifrado SSL/TLS (puerto 443)</strong>. Si el ESP8266 intenta conectarse mediante HTTP plano o sin optimizar la memoria de certificados, el monitor serial mostrará que la conexión no fue exitosa.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-black text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>1. Protocolo HTTPS y SSL</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      El nuevo código utiliza <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">WiFiClientSecure</code> con <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">setInsecure()</code> para validar el dominio en la nube sin cargar pesados certificados de autoridad en el ESP8266.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-black text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>2. Optimización de Memoria RAM</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Se aplicó <code className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded font-mono font-bold">client.setBufferSizes(2048, 1024)</code> para evitar que el ESP8266 agote su memoria RAM durante el apretón de manos (handshake) TLS.
                    </p>
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-black text-slate-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>3. Endpoint Exacto</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      La dirección debe comenzar con <strong>https://</strong> y terminar siempre en <strong>/api/lectura</strong>. Puedes copiarla con el botón rápido de abajo.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-white/90 border border-emerald-300 rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Tu URL pública web actual para el ESP8266:</span>
                    <code className="text-blue-700 font-mono text-[11px] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/lectura` : (networkInfo?.detectedWebUrl || 'https://.../api/lectura')}
                    </code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = typeof window !== 'undefined' ? `${window.location.origin}/api/lectura` : (networkInfo?.detectedWebUrl || '');
                      navigator.clipboard.writeText(url);
                      setCopiedEndpoint(true);
                      setTimeout(() => setCopiedEndpoint(false), 2000);
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedEndpoint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedEndpoint ? '¡Copiado!' : 'Copiar URL Exacta'}</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Config Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                      Endpoint / URL de Conexión para el ESP8266
                    </h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-mono">
                    Método: POST JSON
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    URL / Endpoint donde el ESP8266 enviará las lecturas RFID:
                  </label>

                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    <input
                      type="url"
                      required
                      value={form.esp_endpoint_url}
                      onChange={(e) => {
                        setForm({ ...form, esp_endpoint_url: e.target.value });
                        setTestEndpointUrl(e.target.value);
                      }}
                      placeholder="https://mi-dominio-colegio.com/api/lectura"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-blue-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-xs"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const webUrl = typeof window !== 'undefined'
                          ? `${window.location.origin}/api/lectura`
                          : networkInfo?.detectedWebUrl || '';
                        setForm({ ...form, esp_endpoint_url: webUrl });
                        setTestEndpointUrl(webUrl);
                      }}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      title="Usar la dirección web actual donde está abierta esta aplicación"
                    >
                      <Globe className="w-3.5 h-3.5 text-amber-400" />
                      <span>Usar URL Web Actual</span>
                    </button>

                    {networkInfo && networkInfo.localIps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const lanUrl = networkInfo.detectedLanUrl;
                          setForm({ ...form, esp_endpoint_url: lanUrl });
                          setTestEndpointUrl(lanUrl);
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                        title="Usar la IP local de tu computador Windows (red Wi-Fi LAN)"
                      >
                        <Laptop className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Usar IP Local ({networkInfo.localIps[0]})</span>
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500">
                    💡 Si vas a subir este sistema a una página web (Render, Vercel, Railway, VPS, Cloud Run), ingresa la URL de tu página seguida de <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-slate-800">/api/lectura</code>. El ESP8266 enviará los datos automáticamente por internet.
                  </p>
                </div>

                {/* Wi-Fi Defaults */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Nombre de Red Wi-Fi por Defecto (SSID)
                    </label>
                    <input
                      type="text"
                      value={form.wifi_ssid_default || ''}
                      onChange={(e) => setForm({ ...form, wifi_ssid_default: e.target.value })}
                      placeholder="Nombre de tu red Wi-Fi"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Contraseña Wi-Fi por Defecto
                    </label>
                    <input
                      type="text"
                      value={form.wifi_pass_default || ''}
                      onChange={(e) => setForm({ ...form, wifi_pass_default: e.target.value })}
                      placeholder="Clave de tu red Wi-Fi"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Save Endpoint Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSaving}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'Guardando...' : 'Guardar Endpoint y Wi-Fi'}</span>
                  </button>
                </div>
              </div>

              {/* Endpoint Live Tester Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-wider">
                    <Play className="w-4 h-4" />
                    <span>Probador en Vivo del Endpoint (Simulación ESP8266)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    POST {`{"uid": "8B6FD934", "salon": "${form.salon}"}`}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Prueba si la página web o servidor responde correctamente a las solicitudes del ESP8266:
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestEndpoint}
                    disabled={isTestingEndpoint}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer hover:scale-102"
                  >
                    {isTestingEndpoint ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{isTestingEndpoint ? 'Probando Conexión...' : 'Probar Endpoint Ahora'}</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-4 rounded-xl text-xs space-y-2 border ${
                    testResult.ok 
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' 
                      : 'bg-rose-950/80 border-rose-500/50 text-rose-200'
                  }`}>
                    <div className="flex items-center justify-between flex-wrap gap-2 font-bold">
                      <span className="flex items-center gap-1.5 text-sm">
                        {testResult.ok ? '✓ Conexión Exitosa con el Endpoint' : '⚠️ Fallo al Conectar con el Endpoint'}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 bg-black/40 rounded">
                        Estado HTTP: {testResult.status} • Latencia: {testResult.latencyMs} ms
                      </span>
                    </div>

                    {testResult.error && (
                      <div className="text-rose-300 font-mono text-[11px]">
                        Error: {testResult.error}
                      </div>
                    )}

                    {testResult.response && (
                      <pre className="bg-black/60 p-3 rounded-lg font-mono text-[11px] text-emerald-400 overflow-x-auto">
                        {typeof testResult.response === 'object' ? JSON.stringify(testResult.response, null, 2) : testResult.response}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic Arduino Code & Download */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-sm font-black text-slate-900">
                        Código Arduino C++ para ESP8266 (.ino)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Generado automáticamente con tu endpoint, salón y Wi-Fi
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => copyText(arduinoCode, setCopiedCode)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? '¡Copiado!' : 'Copiar Código'}</span>
                    </button>

                    <a
                      href="/api/esp8266/download-ino"
                      download="esp8266_rfid_asistencia.ino"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Descargar .ino</span>
                    </a>
                  </div>
                </div>

                <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[300px] leading-relaxed border border-slate-800">
                  {arduinoCode || '// Cargando código Arduino...'}
                </pre>
              </div>

              {/* Web Deployment Guide */}
              <div className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl text-xs text-slate-700 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Server className="w-4 h-4 text-blue-600" />
                  <span>Guía para Subir la Página Web a Internet</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                  <li><strong>Subir repositorio:</strong> Sube este proyecto a tu GitHub personal o corporativo.</li>
                  <li><strong>Desplegar:</strong> Conecta tu repositorio en <strong>Render.com</strong>, <strong>Railway.app</strong>, <strong>Vercel</strong> o tu propio servidor VPS.</li>
                  <li><strong>Copiar URL pública:</strong> Copia el dominio generado (ej. <code>https://colegio-asistencia.onrender.com</code>).</li>
                  <li><strong>Pegar en Ajustes:</strong> Pega tu dominio en el campo de endpoint de esta pestaña (<code className="text-blue-700 font-bold font-mono">https://tu-dominio.com/api/lectura</code>).</li>
                  <li><strong>Cargar firmware al ESP8266:</strong> Abre el archivo <code>.ino</code> en Arduino IDE y súbelo por cable USB a tu ESP8266. ¡Listo! El lector registrará asistencias en tu página desde cualquier lugar.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: SEGURIDAD Y CLAVE DE ADMINISTRADOR                    */}
          {/* ============================================================ */}
          {activeTab === 'seguridad' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <KeyRound className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Cambiar Contraseña de Administración
                  </h3>
                </div>

                <p className="text-xs text-slate-500">
                  Esta contraseña protege el acceso a los módulos administrativos, gestión de estudiantes y este panel de ajustes.
                </p>

                {passMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold ${
                    passMsg.type === 'ok' 
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {passMsg.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Contraseña Actual *
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                      placeholder="Por defecto: admin123"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nueva Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="Mínimo 3 caracteres"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Confirmar Nueva Contraseña *
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      placeholder="Repita la nueva contraseña"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passLoading || !currentPass || !newPass || !confirmPass}
                      className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer flex items-center gap-2"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>{passLoading ? 'Actualizando...' : 'Actualizar Contraseña'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: NOTIFICACIONES (WHATSAPP)                             */}
          {/* ============================================================ */}
          {activeTab === 'notificaciones' && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                    Centro de Notificaciones por WhatsApp
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  El sistema utiliza notificaciones directas por WhatsApp (mediante enlaces universales <code className="font-mono bg-slate-200 px-1 py-0.5 rounded text-slate-800">wa.me</code>) para informar a los acudientes sobre el ingreso, salida o inasistencia de las estudiantes de forma rápida, segura y sin bloqueos de servidor.
                </p>

                {/* WhatsApp Config Card */}
                <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-black text-sm text-emerald-700">
                      <MessageSquare className="w-5 h-5 text-emerald-600" />
                      <span>Panel de Envíos y Avisos a Padres</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Abre el panel interactivo para seleccionar estudiantes, simular mensajes de puntualidad, retraso o inasistencia y enviarlos con un solo clic.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenParentNotifications) onOpenParentNotifications();
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-300" />
                    <span>Abrir Panel de WhatsApp y Simulador</span>
                  </button>
                </div>

                {/* Paso a paso y explicación sobre Render */}
                <div className="p-4 bg-linear-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl text-xs text-slate-700 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-black text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>¿Por qué se eliminó el correo y por qué WhatsApp es la mejor opción en Render?</span>
                  </div>
                  
                  <div className="space-y-2 text-[11px] leading-relaxed text-slate-600">
                    <p>
                      <strong>1. Restricción en Render Gratis (SMTP):</strong> Los servidores gratuitos de Render bloquean por completo los puertos de correo saliente estándar (puertos 465 y 587) como medida contra el spam. Esto hacía que el envío automático de correos fallara constantemente con errores de conexión (<code className="font-mono">ETIMEDOUT</code>).
                    </p>
                    <p>
                      <strong>2. Confiabilidad de WhatsApp (<code className="font-mono">wa.me</code>):</strong> Al usar enlaces directos de WhatsApp, la aplicación abre el chat oficial con el número del acudiente y el mensaje preformateado (indicando nombre, hora de entrada/salida y estado). Funciona al 100% en cualquier dispositivo (computador, tablet o celular) sin depender de servidores SMTP externos.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-amber-200/60">
                    <h5 className="font-black text-amber-950 text-xs mb-1.5">
                      Paso a paso para configurar y usar las notificaciones:
                    </h5>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-700">
                      <li><strong>Registrar Teléfono:</strong> Asegúrate de que cada estudiante tenga el número de teléfono del acudiente guardado en su perfil (pestaña <em>Estudiantes</em> ➔ <em>Editar</em>).</li>
                      <li><strong>Escanear o Revisar:</strong> Al escanear la tarjeta en el Kiosco o al revisar la tabla de asistencia diaria, haz clic en el botón verde <strong>"WhatsApp"</strong> o <strong>"Avisar Falta"</strong>.</li>
                      <li><strong>Enviar:</strong> Se abrirá la aplicación de WhatsApp con el mensaje listo para enviar de manera inmediata al padre o acudiente.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium truncate max-w-sm hidden sm:inline">
            {form.nombre_colegio} • {form.grado} ({form.salon})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-auto"
          >
            Cerrar Ajustes
          </button>
        </div>
      </div>
    </div>
  );
};
