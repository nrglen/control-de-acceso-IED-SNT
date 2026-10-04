import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Eye, 
  EyeOff, 
  HelpCircle,
  Clock,
  History,
  Check,
  RefreshCw
} from 'lucide-react';
import { EmailConfig, EmailLog } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'preview' | 'logs'>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<EmailConfig>({
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: 'notificaciones.sannicolas@gmail.com',
    smtp_pass: 'sannicolas2026demo',
    sender_name: 'I.E. San Nicolás de Tolentino',
    sender_email: 'notificaciones.sannicolas@gmail.com',
    auto_notify_scan: true,
    notify_on_tardy_only: false,
    configured: true
  });
  const [showPassword, setShowPassword] = useState(false);

  // Test send state
  const [testEmail, setTestEmail] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Logs state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Load Config
  useEffect(() => {
    if (!isOpen) return;
    const fetchConfig = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/email/config');
        if (res.ok) {
          const data = await res.json();
          setFormData(data);
          if (data.smtp_user && !testEmail) {
            setTestEmail(data.smtp_user);
          }
        }
      } catch (err) {
        console.error('Error fetching email config:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen]);

  // Load logs
  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/email/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Error fetching email logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && isOpen) {
      fetchLogs();
    }
  }, [activeTab, isOpen]);

  // Handle Preset Selection
  const applyPreset = (preset: 'gmail' | 'outlook' | 'custom') => {
    if (preset === 'gmail') {
      setFormData(prev => ({
        ...prev,
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_secure: false,
        sender_name: 'Colegio San Nicolás de Tolentino'
      }));
    } else if (preset === 'outlook') {
      setFormData(prev => ({
        ...prev,
        smtp_host: 'smtp.office365.com',
        smtp_port: 587,
        smtp_secure: false,
        sender_name: 'Colegio San Nicolás de Tolentino'
      }));
    }
  };

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3500);
      } else {
        setErrorMessage(data.error || 'Error al guardar la configuración.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  // Run Test Email
  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      setTestResult({ ok: false, message: 'Por favor ingresa un correo de destino válido.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_recipient: testEmail,
          config: formData
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({ ok: true, message: data.message || '¡Correo de prueba enviado con éxito!' });
      } else {
        setTestResult({ ok: false, message: data.message || 'No se pudo enviar el correo de prueba.' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Error al conectar con el servidor.' });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="p-5 bg-linear-to-r from-red-700 via-red-800 to-slate-950 text-white flex items-center justify-between shrink-0 border-b-4 border-amber-400">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl bg-white p-1 shrink-0 shadow-md border border-amber-300">
              <img
                src="/static/logo.svg"
                alt="Escudo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/logo.svg';
                }}
              />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                I.E. SAN NICOLÁS DE TOLENTINO • NOTIFICACIONES OFICIALES
              </span>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                Módulo de Notificación por Correo a Padres
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 shrink-0 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-red-600 text-red-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>1. Servidor SMTP</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'test'
                ? 'border-red-600 text-red-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>2. Probar Envío en Vivo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'preview'
                ? 'border-red-600 text-red-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Vista Previa Plantilla HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`pb-2.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-red-600 text-red-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>4. Historial de Envíos</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: CONFIGURACIÓN SMTP */}
          {activeTab === 'config' && (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Notice Banner */}
              <div className="p-3.5 bg-amber-50 border-2 border-amber-300/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 shadow-xs">
                <Sparkles className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-black text-red-900 block text-xs">
                    Credenciales genéricas activas para pruebas inmediatas
                  </strong>
                  <span className="text-[11px] text-amber-900 leading-relaxed block mt-0.5">
                    El sistema cuenta con un correo y contraseña provisionales (<strong>notificaciones.sannicolas@gmail.com</strong>) para que puedas probar el registro y despacho de avisos ya mismo. Cuando tengas la cuenta definitiva del colegio, solo reemplázala aquí.
                  </span>
                </div>
              </div>

              {/* Presets */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  Seleccionar Proveedor Rápido:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('gmail')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      formData.smtp_host === 'smtp.gmail.com'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>Gmail Escolar</span>
                      {formData.smtp_host === 'smtp.gmail.com' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">smtp.gmail.com : 587</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('outlook')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      formData.smtp_host === 'smtp.office365.com'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>Outlook / Office 365</span>
                      {formData.smtp_host === 'smtp.office365.com' && <Check className="w-3.5 h-3.5 text-blue-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">smtp.office365.com : 587</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPreset('custom')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                      formData.smtp_host !== 'smtp.gmail.com' && formData.smtp_host !== 'smtp.office365.com'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>Servidor Propio</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">cPanel / SendGrid / etc.</span>
                  </button>
                </div>
              </div>

              {/* SMTP Credentials Form */}
              <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 block mb-1">
                      Servidor SMTP (Host):
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_host}
                      onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                      placeholder="smtp.gmail.com"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Puerto SMTP:
                    </label>
                    <input
                      type="number"
                      value={formData.smtp_port}
                      onChange={(e) => setFormData({ ...formData, smtp_port: Number(e.target.value) })}
                      placeholder="587"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Usuario / Correo Remitente:
                    </label>
                    <input
                      type="email"
                      value={formData.smtp_user}
                      onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                      placeholder="asistencia.sannicolas@gmail.com"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Cuenta desde la que se enviarán las notificaciones.
                    </span>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Contraseña de Aplicación:
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.smtp_pass}
                        onChange={(e) => setFormData({ ...formData, smtp_pass: e.target.value })}
                        placeholder="16 caracteres (ej: abcd efgh ijkl mnop)"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-800 focus:outline-hidden focus:border-blue-500 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      En Gmail: Cuenta Google &gt; Seguridad &gt; Contraseñas de aplicaciones.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Nombre que Verá el Acudiente:
                    </label>
                    <input
                      type="text"
                      value={formData.sender_name}
                      onChange={(e) => setFormData({ ...formData, sender_name: e.target.value })}
                      placeholder="Colegio San Nicolás de Tolentino"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Correo de Respuesta (Reply-To):
                    </label>
                    <input
                      type="email"
                      value={formData.sender_email}
                      onChange={(e) => setFormData({ ...formData, sender_email: e.target.value })}
                      placeholder="coordinacion@sannicolas.edu.co"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Automation Switches */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  Reglas de Automatización
                </h4>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.auto_notify_scan}
                    onChange={(e) => setFormData({ ...formData, auto_notify_scan: e.target.checked })}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <strong className="text-slate-900 block">
                      Enviar correo automáticamente en tiempo real al pasar la tarjeta RFID
                    </strong>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      El servidor despachará el correo de inmediato cuando el ESP8266 detecte la tarjeta física.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer pt-1 border-t border-slate-100">
                  <input
                    type="checkbox"
                    checked={formData.notify_on_tardy_only}
                    onChange={(e) => setFormData({ ...formData, notify_on_tardy_only: e.target.checked })}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <strong className="text-slate-900 block">
                      Notificar únicamente cuando el estudiante ingrese con retraso (después de las 08:40 AM)
                    </strong>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Si está desactivado, se enviará confirmación tanto en entradas puntuales como en tardanzas.
                    </span>
                  </div>
                </label>
              </div>

              {/* Alerts */}
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ ¡Configuración SMTP guardada exitosamente en la base de datos!</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Las credenciales se guardan de forma segura en la base de datos local.
                </span>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-2 hover:scale-102"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Configuración SMTP'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PROBAR ENVÍO EN VIVO */}
          {activeTab === 'test' && (
            <div className="space-y-5">
              <div className="p-4 bg-linear-to-br from-red-50 to-amber-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5">
                  <Send className="w-4 h-4" />
                </div>
                <div className="text-xs text-slate-700">
                  <h4 className="font-black text-red-950 text-sm">
                    Prueba de Notificación en Vivo
                  </h4>
                  <p className="mt-1 leading-relaxed text-slate-600">
                    Ingresa tu correo personal o institucional para recibir el correo de prueba formal con el escudo oficial del colegio.
                  </p>
                </div>
              </div>

              <form onSubmit={handleTestEmail} className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Correo Electrónico de Destino para la Prueba:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="tu_correo@gmail.com"
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-hidden focus:border-red-500"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isTesting}
                      className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-all shadow-md cursor-pointer flex items-center gap-2"
                    >
                      {isTesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Prueba</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Feedback Result */}
                {testResult && (
                  <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                    testResult.ok 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}>
                    {testResult.ok ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="font-black block text-sm">
                        {testResult.ok ? '¡Conexión Exitosa!' : 'Fallo en la prueba'}
                      </strong>
                      <p className="mt-0.5 leading-relaxed">
                        {testResult.message}
                      </p>
                    </div>
                  </div>
                )}
              </form>

              {/* Tips for Gmail App Passwords */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  <span>¿Cómo obtener la contraseña de aplicación en Gmail?</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-amber-900/90 font-medium">
                  <li>Ingresa a tu cuenta de Google en <strong>myaccount.google.com</strong>.</li>
                  <li>Ve a la pestaña <strong>Seguridad</strong> y asegúrate de tener activada la <strong>Verificación en 2 pasos</strong>.</li>
                  <li>Busca la opción <strong>Contraseñas de aplicaciones</strong>.</li>
                  <li>Genera una nueva contraseña llamada <em>"Asistencia RFID Colegio"</em> y copia los 16 caracteres.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 3: VISTA PREVIA DE PLANTILLA HTML */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Así le llega el correo oficial al celular del acudiente:
                </span>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Formato HTML Adaptable (Móvil / PC)
                </span>
              </div>

              {/* Mock email client container */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-slate-100">
                {/* Mock email subject bar */}
                <div className="bg-slate-200 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between text-xs">
                  <div className="truncate">
                    <span className="text-slate-500 font-bold">De: </span>
                    <strong className="text-slate-900">I.E. San Nicolás de Tolentino &lt;notificaciones.sannicolas@gmail.com&gt;</strong>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">Hoy 08:32 AM</span>
                </div>

                <div className="p-4 sm:p-6 bg-slate-100 flex justify-center">
                  <div className="max-w-xl w-full bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden text-xs">
                    {/* Institutional Header */}
                    <div className="bg-linear-to-r from-red-700 via-red-800 to-slate-900 p-5 text-center text-white border-b-4 border-amber-400">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 block">
                        INSTITUCIÓN EDUCATIVA
                      </span>
                      <h3 className="text-base font-black text-white mt-1 uppercase">
                        SAN NICOLÁS DE TOLENTINO
                      </h3>
                      <p className="text-[11px] text-amber-200 font-bold mt-0.5">
                        Interioridad • Amor • Trascendencia
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="bg-emerald-50 border-b border-emerald-100 py-2.5 text-center">
                      <span className="text-xs font-black text-emerald-800 tracking-wide">
                        ✓ INGRESO PUNTUAL A TIEMPO
                      </span>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-3.5 text-slate-800">
                      <p className="text-xs leading-relaxed">
                        Estimado(a) <strong>Patricia Reyes Mendoza</strong>,
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Le informamos que su acudido(a) <strong>Sofía Martínez Reyes</strong> ha registrado su asistencia física mediante tarjeta RFID en la institución:
                      </p>

                      <div className="bg-amber-50/60 rounded-xl border border-amber-200/80 p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-amber-100">
                          <span className="text-amber-900 font-medium">Estudiante:</span>
                          <strong className="text-slate-900">Sofía Martínez Reyes (EST-601-001)</strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-amber-100">
                          <span className="text-amber-900 font-medium">Grado / Grupo:</span>
                          <strong className="text-red-700 font-black">6° - 1</strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-amber-100">
                          <span className="text-amber-900 font-medium">Ubicación / Salón:</span>
                          <strong className="text-slate-800">📍 Salón de Informática • Informática y Tecnología</strong>
                        </div>
                        <div className="flex justify-between py-1 border-b border-amber-100">
                          <span className="text-amber-900 font-medium">Docente a Cargo:</span>
                          <span className="text-slate-800 font-bold">Prof. Roberto Gómez</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-amber-900 font-medium">Fecha y Hora de Registro:</span>
                          <strong className="font-mono text-slate-900 font-bold">04/10/2026 — 08:32:15 AM</strong>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-r-xl text-[11px] text-emerald-950">
                        <strong>Detalle de puntualidad:</strong> El estudiante ingresó puntualmente a su jornada académica programada.
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-900 p-4 text-center text-[10px] text-amber-200 font-bold">
                      I.E. SAN NICOLÁS DE TOLENTINO • Sistema Automatizado de Asistencia RFID
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: HISTORIAL DE ENVÍOS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Últimos Correos Notificados por el Sistema</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchLogs}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>

              {logs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-2xl bg-slate-50">
                  No hay registros de correos enviados recientemente. Pasa una tarjeta por el sensor para generar el primer despacho.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Estudiante</th>
                        <th className="py-2.5 px-3">Correo Acudiente</th>
                        <th className="py-2.5 px-3">Fecha y Hora</th>
                        <th className="py-2.5 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((lg) => (
                        <tr key={lg.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {lg.estudiante_nombre}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {lg.acudiente_correo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {lg.fecha_hora}
                          </td>
                          <td className="py-2.5 px-3">
                            {lg.estado === 'enviado' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Enviado SMTP</span>
                              </span>
                            ) : lg.estado === 'simulado' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                <span>Listo (Simulado)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                                <AlertCircle className="w-3 h-3" />
                                <span>Fallo</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <span className="text-xs text-slate-500 font-medium">
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
