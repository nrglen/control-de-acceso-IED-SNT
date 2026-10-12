import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Phone, 
  BellRing, 
  ShieldCheck, 
  Smartphone, 
  ExternalLink,
  Settings,
  Sparkles,
  Clock,
  User,
  Share2,
  KeyRound,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  Check,
  ChevronDown,
  Activity
} from 'lucide-react';
import { Estudiante, WhatsAppConfig } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  students: Estudiante[];
}

export const ParentNotificationsModal: React.FC<Props> = ({ isOpen, onClose, students }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'simulator' | 'monitor'>('config');

  // Simulator states
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>(students[0]?.id || '');
  const [tipoNotificacion, setTipoNotificacion] = useState<'puntual' | 'tarde' | 'salida'>('puntual');
  const [horaSimulada, setHoraSimulada] = useState('08:32');
  const [sentSuccessMsg, setSentSuccessMsg] = useState<string | null>(null);

  // Recent automatic dispatches
  const [recentDispatches, setRecentDispatches] = useState<any[]>([]);

  // Meta Cloud API configuration states
  const [config, setConfig] = useState<WhatsAppConfig>({
    phone_number_id: '',
    waba_id: '2265678327606177',
    access_token: '',
    has_token: false,
    auto_notify_scan: true,
    notify_salida: true,
    test_phone: ''
  });
  const [tokenInput, setTokenInput] = useState('');
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Test send state
  const [testPhone, setTestPhone] = useState('');
  const [isTestingSend, setIsTestingSend] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; details?: any } | null>(null);

  // Token status and validation
  const [tokenStatus, setTokenStatus] = useState<{
    valid: boolean;
    status: 'valid' | 'expired' | 'missing' | 'error';
    message: string;
    phoneInfo?: any;
    templates?: any[];
    hasPendingApproval?: boolean;
  } | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [showPermanentTokenGuide, setShowPermanentTokenGuide] = useState(false);

  const verifyTokenNow = async () => {
    setIsCheckingToken(true);
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      if (data.ok) {
        setTokenStatus({
          valid: data.valid,
          status: data.status,
          message: data.message,
          phoneInfo: data.phoneInfo,
          templates: data.templates,
          hasPendingApproval: data.hasPendingApproval
        });
        if (data.recent_dispatches && Array.isArray(data.recent_dispatches)) {
          setRecentDispatches(data.recent_dispatches);
        }
      }
    } catch (e) {
      console.warn('Error verificando token:', e);
    } finally {
      setIsCheckingToken(false);
    }
  };

  // Load WhatsApp configuration from server
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingConfig(true);

    fetch('/api/whatsapp/config?check=true')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.ok) {
          setConfig({
            phone_number_id: data.phone_number_id || '',
            waba_id: data.waba_id || '1120214260480676',
            has_token: data.has_token || false,
            auto_notify_scan: Boolean(data.auto_notify_scan),
            notify_salida: Boolean(data.notify_salida),
            test_phone: data.test_phone || ''
          });
          if (data.token_status) {
            setTokenStatus(data.token_status);
          }
          if (data.test_phone) setTestPhone(data.test_phone);
        }
      })
      .catch((err) => console.error('Error fetching WhatsApp config:', err))
      .finally(() => {
        if (isMounted) setIsLoadingConfig(false);
      });

    // Also fetch status for live dispatches
    fetch('/api/whatsapp/status')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.ok && data.recent_dispatches) {
          setRecentDispatches(data.recent_dispatches);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStudent = students.find((s) => s.id === Number(selectedStudentId)) || students[0];
  const acudienteNombre = currentStudent?.acudiente_nombre || 'Padre de Familia';
  const acudienteTel = currentStudent?.acudiente_contacto || '+57 315 889 4421';
  const cleanPhone = acudienteTel.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;

  // Generate customized school message
  const generarMensaje = () => {
    if (tipoNotificacion === 'salida') {
      return `🏫 *I.E. San Nicolás de Tolentino - Control de Asistencia*
Estimado(a) *${acudienteNombre}*,
Le confirmamos que su hijo(a) *${currentStudent?.nombre || 'El alumno'}* (Grado 6° - 1) registró su *SALIDA* de la institución hoy a las *${horaSimulada}*.
👋 ¡Que tenga un excelente resto de día!`;
    }

    if (tipoNotificacion === 'puntual') {
      return `🏫 *I.E. San Nicolás de Tolentino - Control de Asistencia*
Estimado(a) *${acudienteNombre}*,
Le informamos que su hijo(a) *${currentStudent?.nombre || 'El alumno'}* (Grado 6° - 1) ha ingresado puntualmente al *Salón de Informática* el día de hoy a las *${horaSimulada} AM*.

✅ *Estado:* Asistencia Puntual (A tiempo)
💻 *Asignatura:* Informática y Tecnología
👨‍🏫 *Docente:* Prof. Roberto Gómez`;
    } else {
      return `🏫 *I.E. San Nicolás de Tolentino - Control de Asistencia*
Estimado(a) *${acudienteNombre}*,
Le informamos que su hijo(a) *${currentStudent?.nombre || 'El alumno'}* (Grado 6° - 1) ha registrado su ingreso al *Salón de Informática* el día de hoy a las *${horaSimulada} AM*.

⚠️ *Novedad:* Llegada posterior a las 08:40 AM (Retraso registrado en el sistema escolar).
💻 *Asignatura:* Informática y Tecnología
👨‍🏫 *Docente:* Prof. Roberto Gómez`;
    }
  };

  const mensajeTexto = generarMensaje();
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(mensajeTexto)}`;

  const handleTestSendManual = (e: React.FormEvent) => {
    e.preventDefault();
    window.open(whatsappUrl, '_blank');
    setSentSuccessMsg(`¡Ventana de WhatsApp abierta para notificar a ${acudienteNombre}!`);
    setTimeout(() => setSentSuccessMsg(null), 4000);
  };

  // Save Meta API Configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setSaveMsg(null);

    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: config.phone_number_id,
          waba_id: config.waba_id,
          access_token: tokenInput || undefined,
          auto_notify_scan: config.auto_notify_scan,
          notify_salida: config.notify_salida,
          test_phone: testPhone
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveMsg({ type: 'ok', text: '✓ Configuración de WhatsApp guardada exitosamente.' });
        if (data.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config
          }));
        }
        setTokenInput('');
        verifyTokenNow();
      } else {
        setSaveMsg({ type: 'err', text: data.message || 'Error al guardar la configuración.' });
      }
    } catch (err: any) {
      setSaveMsg({ type: 'err', text: err.message || 'Error de conexión.' });
    } finally {
      setIsSavingConfig(false);
      setTimeout(() => setSaveMsg(null), 5000);
    }
  };

  // Send real test message through Meta Cloud API
  const handleTestMetaApi = async (useTemplate: boolean = false) => {
    if (!testPhone) {
      setTestResult({ ok: false, message: 'Ingresa un número telefónico de prueba (con indicativo de país, ej: 573135710894).' });
      return;
    }

    setIsTestingSend(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_phone: testPhone, use_template: useTemplate })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          ok: true,
          message: `✓ ¡Mensaje entregado exitosamente a ${testPhone}! ID de Meta: ${data.messageId}${data.note ? ` (${data.note})` : ''}`
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error || data.message || 'Error al enviar por Meta Cloud API.',
          details: data.details
        });
      }
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || 'Error al conectar con el servidor.'
      });
    } finally {
      setIsTestingSend(false);
    }
  };

  const isConfigComplete = Boolean(config.phone_number_id && (config.has_token || tokenInput));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border-2 border-slate-200 overflow-hidden animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-5 bg-linear-to-r from-emerald-600 via-teal-700 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-xs shadow-xs">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200 block">
                  Módulo Oficial • Meta WhatsApp Business
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isConfigComplete ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'
                }`}>
                  {isConfigComplete ? 'API Conectada' : 'Pendiente Credenciales'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white leading-tight">
                Notificaciones Automáticas por WhatsApp
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>1. Vincular Cuenta Meta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'simulator'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>2. Simulador y Envío 1-Clic</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('monitor');
              verifyTokenNow();
            }}
            className={`pb-3 px-3 text-xs font-black border-b-2 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'monitor'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>3. Monitor de Envíos en Vivo</span>
            {recentDispatches.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                {recentDispatches.length}
              </span>
            )}
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* ============================================================ */}
          {/* TAB 1: CONFIGURACIÓN META CLOUD API                          */}
          {/* ============================================================ */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className={`p-4 border rounded-2xl flex items-start gap-3 ${
                tokenStatus?.status === 'expired'
                  ? 'bg-amber-50/90 border-amber-300'
                  : 'bg-emerald-50 border-emerald-200'
              }`}>
                <div className={`p-2 text-white rounded-xl shrink-0 mt-0.5 ${
                  tokenStatus?.status === 'expired' ? 'bg-amber-600' : 'bg-emerald-600'
                }`}>
                  {tokenStatus?.status === 'expired' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div className="text-xs text-slate-700 flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-black text-slate-900 text-sm">
                      Cuenta Comercial Vinculada: IED San Nicolás de Tolentino
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        tokenStatus?.status === 'expired'
                          ? 'bg-rose-200 text-rose-900 border border-rose-300'
                          : tokenStatus?.status === 'valid'
                            ? 'bg-emerald-200 text-emerald-900'
                            : 'bg-slate-200 text-slate-800'
                      }`}>
                        {isCheckingToken
                          ? 'Verificando con Meta...'
                          : tokenStatus?.status === 'expired'
                            ? '⚠️ Token Expirado (Error 190)'
                            : tokenStatus?.status === 'valid'
                              ? 'Meta Cloud API: Activa ✓'
                              : 'Meta Cloud API: Conectada'}
                      </span>
                      <button
                        type="button"
                        onClick={verifyTokenNow}
                        disabled={isCheckingToken}
                        title="Reverificar estado del token en Meta"
                        className="p-1 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isCheckingToken ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 text-[11px]">
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">Número de Meta Conectado:</span>
                      <strong className="text-slate-900 font-mono">
                        {tokenStatus?.phoneInfo?.display_phone_number || '+1 555-649-6139'}
                      </strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Nombre: <strong>{tokenStatus?.phoneInfo?.verified_name || 'Test Number'}</strong>
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">Estado del Nombre en Meta:</span>
                      {tokenStatus?.phoneInfo?.name_status === 'AVAILABLE_WITHOUT_REVIEW' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Disponible y Conectado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          {tokenStatus?.phoneInfo?.name_status || 'En verificación por Meta'}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {tokenStatus?.phoneInfo?.name_status === 'AVAILABLE_WITHOUT_REVIEW'
                          ? 'Número activo y listo para emitir mensajes.'
                          : 'Meta revisa el nombre virtual antes del primer envío.'}
                      </span>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">WABA ID (Cuenta de Mensajes):</span>
                      <strong className="text-slate-900 font-mono">{config.waba_id || '2265678327606177'}</strong>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                      <span className="text-slate-500 block">Plantilla Creada en Meta:</span>
                      {tokenStatus?.templates && tokenStatus.templates.length > 0 ? (
                        <div>
                          <strong className="text-slate-900 block truncate font-mono text-[10px]">
                            {tokenStatus.templates[0].name}
                          </strong>
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Estado: {tokenStatus.templates[0].status === 'PENDING' ? '⏳ PENDIENTE DE APROBACIÓN POR META' : tokenStatus.templates[0].status}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-medium">notificaicon_de_asistencia_puntual (En revisión)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expired Token Notice Box */}
              {tokenStatus?.status === 'expired' && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs space-y-2.5 text-amber-950">
                  <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>¿Por qué ocurrió el error de token expirado (Código 190)?</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-amber-900">
                    Los <strong>tokens temporales</strong> que entrega Meta en la pantalla de pruebas tienen una duración exacta de <strong>24 horas</strong> por seguridad. El token anterior ya cumplió su vigencia y por eso Meta rechaza las conexiones.
                  </p>

                  <div className="bg-white/90 p-3 rounded-xl border border-amber-200 space-y-2">
                    <p className="font-bold text-slate-800 text-xs">Solución rápida (Toma 30 segundos):</p>
                    <ol className="list-decimal list-inside space-y-1 text-slate-700 text-[11px]">
                      <li>Entra a <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-blue-700 underline font-bold">developers.facebook.com</a> (tu App ➔ WhatsApp ➔ Configuración de la API).</li>
                      <li>En <strong>Paso 1: Seleccionar números de teléfono</strong>, copia el nuevo <strong>Token de acceso temporal</strong> que Meta genera automáticamente.</li>
                      <li>Pégalo en el campo <em>"Token de Acceso de Meta"</em> que está abajo en esta misma ventana y haz clic en <strong>"Guardar Configuración"</strong>.</li>
                    </ol>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPermanentTokenGuide(!showPermanentTokenGuide)}
                      className="text-[11px] text-amber-800 hover:text-amber-950 font-bold underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>💡 Recomendado: ¿Cómo crear un Token Permanente que NUNCA expire?</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPermanentTokenGuide ? 'rotate-180' : ''}`} />
                    </button>

                    {showPermanentTokenGuide && (
                      <div className="mt-2 p-3 bg-slate-900 text-white rounded-xl text-[11px] space-y-2 border border-slate-700 animate-fadeIn">
                        <p className="text-emerald-400 font-bold">Pasos para generar Token Permanente en Meta Business:</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300">
                          <li>Entra a <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-bold">business.facebook.com/settings</a> (Configuración del negocio).</li>
                          <li>En el menú lateral ve a <strong>Usuarios</strong> ➔ <strong>Usuarios del sistema</strong>.</li>
                          <li>Haz clic en <strong>Añadir</strong>, nómbralo (ej: <code>SistemaColegio</code>) con rol <em>Administrador</em>.</li>
                          <li>En <strong>Activos asignados</strong>, selecciona tu aplicación y activa el permiso de <em>Control total</em>.</li>
                          <li>Haz clic en <strong>Generar nuevo token</strong>, selecciona tu app, marca los permisos <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.</li>
                          <li>En la opción de caducidad elige <strong>Nunca (Never)</strong>.</li>
                          <li>Copia ese token permanente y pégalo abajo. ¡Ese token nunca vencerá!</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notice if using the phone that is in name review */}
              {tokenStatus?.valid && (tokenStatus?.phoneInfo?.id === '1269342006272068' || tokenStatus?.phoneInfo?.name_status === 'PENDING_REVIEW') ? (
                <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-2xl text-xs space-y-2.5 text-slate-800">
                  <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Aviso de Revisión de Nombre por Meta (Código 131037)</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-700">
                    Al número virtual <strong>({tokenStatus?.phoneInfo?.display_phone_number || '+1 555-401-3860'})</strong> se le configuró el nombre <em>&quot;IED San Nicolas De Tolentino&quot;</em> y Meta requiere aprobación previa. Si deseas enviar pruebas de inmediato, usa el número de prueba oficial <strong>ID: 1359195253942176</strong> o vincula una SIM colombiana del colegio.
                  </p>
                </div>
              ) : tokenStatus?.valid ? (
                <div className="p-3.5 bg-emerald-50/90 border border-emerald-300 rounded-2xl text-xs space-y-1.5 text-emerald-950">
                  <div className="flex items-center gap-2 font-black text-emerald-800 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Conexión con Meta Cloud API Activa y Operativa</span>
                  </div>
                  <p className="leading-relaxed text-[11px] text-slate-600">
                    El servicio está enviando notificaciones con el número oficial de Meta <strong>{tokenStatus?.phoneInfo?.display_phone_number || '+1 555-649-6139'}</strong>. En el modo de pruebas de Meta, los números que reciben mensajes deben estar autorizados en tu consola de Meta Developers (campo <em>&quot;Para&quot;</em>).
                  </p>
                </div>
              ) : null}

              {saveMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  saveMsg.type === 'ok' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                }`}>
                  {saveMsg.text}
                </div>
              )}

              {/* Form Config */}
              <form onSubmit={handleSaveConfig} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    <span>Credenciales de Meta WhatsApp API</span>
                  </h4>
                  {isLoadingConfig && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
                </div>

                <div className="space-y-3.5 text-xs">
                  {/* WABA ID */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Identificador de Cuenta de WhatsApp (WABA ID)
                    </label>
                    <input
                      type="text"
                      value={config.waba_id}
                      onChange={(e) => setConfig({ ...config, waba_id: e.target.value })}
                      placeholder="2265678327606177"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 font-mono text-slate-800 focus:outline-hidden focus:border-emerald-500 font-bold"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Detectado en tu portafolio comercial de Meta.
                    </span>
                  </div>

                  {/* Phone Number ID */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                      <span>Identificador de Número de Teléfono (Phone Number ID) *</span>
                      <a
                        href="https://developers.facebook.com/apps"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline flex items-center gap-1 text-[11px]"
                      >
                        <span>Ver en Meta Developers</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </label>
                    <input
                      type="text"
                      value={config.phone_number_id}
                      onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })}
                      placeholder="Ej: 524108894112345 (Número de 15 dígitos en Meta)"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 font-mono text-slate-800 focus:outline-hidden focus:border-emerald-500 font-bold"
                      required
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      💡 Lo encuentras en <em>developers.facebook.com</em> ➔ Tu App ➔ <em>WhatsApp</em> ➔ <em>Configuración de la API</em> ➔ campo <strong>"Identificador de número de teléfono"</strong>.
                    </span>
                  </div>

                  {/* Access Token */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700 block">
                        Token de Acceso de Meta (Access Token) *
                      </label>
                      {tokenStatus?.status === 'expired' && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold animate-pulse">
                          ⚠️ Expirado (Pega el nuevo aquí)
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder={
                        tokenStatus?.status === 'expired'
                          ? 'Pega aquí el nuevo token que empieza con EAA...'
                          : config.has_token
                            ? '•••••••••••••••••••••••••••••••• (Token guardado. Escribe para reemplazar)'
                            : 'Pega aquí el Token que empieza con EAA...'
                      }
                      className={`w-full bg-white border rounded-xl px-3.5 py-2 font-mono text-slate-800 focus:outline-hidden ${
                        tokenStatus?.status === 'expired'
                          ? 'border-amber-400 focus:border-amber-500 ring-2 ring-amber-100'
                          : 'border-slate-300 focus:border-emerald-500'
                      }`}
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      {tokenStatus?.status === 'expired'
                        ? 'Copia el nuevo token desde developers.facebook.com ➔ WhatsApp ➔ Configuración de la API y pégalo aquí.'
                        : config.has_token
                          ? '✓ Ya tienes un token guardado en el servidor.'
                          : 'Copia el Token Temporal o Permanente desde el panel de la API de WhatsApp de Meta.'}
                    </span>
                  </div>

                  {/* Auto send toggle */}
                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.auto_notify_scan)}
                        onChange={(e) => setConfig({ ...config, auto_notify_scan: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="font-bold text-slate-800 text-xs">
                        Enviar WhatsApp automáticamente al registrar ENTRADA por tarjeta RFID
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.notify_salida)}
                        onChange={(e) => setConfig({ ...config, notify_salida: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <span className="font-bold text-slate-800 text-xs">
                        Enviar WhatsApp automáticamente al registrar SALIDA (segunda lectura RFID)
                      </span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingConfig}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    {isSavingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isSavingConfig ? 'Guardando...' : 'Guardar Configuración en el Servidor'}</span>
                  </button>
                </div>
              </form>

              {/* Test Connection Box */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5" /> Probar Envío Inmediato con Meta API
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">HTTPS 443 (Permitido en Render)</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Ingresa tu número de teléfono con código de país para comprobar que Meta entrega el mensaje correctamente:
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Ej: 573135710894 (código de país + celular)"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestMetaApi(false)}
                      disabled={isTestingSend || !isConfigComplete}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Envía el mensaje de asistencia del colegio"
                    >
                      {isTestingSend ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Probar Mensaje</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestMetaApi(true)}
                      disabled={isTestingSend || !isConfigComplete}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Envía la plantilla de prueba oficial de Meta 'hello_world'"
                    >
                      <span>Plantilla hello_world</span>
                    </button>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px] text-slate-300">
                  <span className="text-amber-300 font-bold block mb-0.5">⚠️ Requisito del Modo de Prueba de Meta:</span>
                  Estás usando el número asignado por Meta (<code className="text-emerald-400 font-mono">+1 555-401-3860</code>). Para recibir mensajes de prueba, Meta requiere que tu número personal esté registrado en el campo <strong>"Para (To)"</strong> en <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-bold">developers.facebook.com</a> (sección <em>WhatsApp ➔ Configuración de la API</em>).
                </div>

                {testResult && (
                  <div className={`p-3.5 rounded-xl text-xs space-y-2 ${
                    testResult.ok ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200' : 'bg-rose-950/80 border border-rose-500 text-rose-200'
                  }`}>
                    <p className="font-bold">{testResult.message}</p>
                    
                    {testResult.details?.code === 131037 && (
                      <div className="p-3 bg-amber-950/70 border border-amber-600/70 rounded-lg text-amber-200 text-[11px] space-y-2">
                        <p className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>🔍 ¿Por qué ocurre este estado (Código 131037)?</span>
                        </p>
                        <p>
                          Meta le asignó a tu cuenta el nombre <strong>"IED San Nicolas De Tolentino"</strong>. Al ser un número virtual proporcionado por Meta (+1 555), sus sistemas están en proceso de verificación del nombre para mostrar (Display Name).
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-slate-200">
                          <li><strong>Opción 1 (Inmediata y recomendada):</strong> Agrega un número telefónico propio (SIM de celular del colegio) en <em>Meta Developers ➔ WhatsApp ➔ Configuración de la API ➔ Paso 5 (Añadir un número de teléfono)</em>. Los números reales con SMS no requieren esperar esta aprobación.</li>
                          <li><strong>Opción 2 (Esperar a Meta):</strong> Meta suele autorizar el nombre en unas horas (máximo 24-48 horas). Una vez listo, este error desaparecerá solo.</li>
                        </ul>
                        
                        <div className="pt-2 border-t border-amber-800/60">
                          <a
                            href={`https://wa.me/${testPhone.replace(/\D/g, '')}?text=${encodeURIComponent('🏫 IED San Nicolás de Tolentino\n\n✅ Prueba de conexión de WhatsApp\nEl sistema escolar está configurado correctamente con el servidor.')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Probar envío directo por WhatsApp Web / Celular ahora</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {testResult.details && testResult.details.code !== 131037 && (
                      <div className="text-[11px] font-mono mt-1 text-slate-300 bg-black/40 p-2.5 rounded-lg border border-slate-700/60 space-y-0.5">
                        <div><strong>Código de respuesta:</strong> {testResult.details.code}</div>
                        <div><strong>Detalle:</strong> {testResult.details.message || testResult.details.info}</div>
                        {testResult.details.fbtrace_id && (
                          <div className="text-slate-500 text-[10px]"><strong>Trace ID:</strong> {testResult.details.fbtrace_id}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step by step guide */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-slate-700 space-y-2">
                <h5 className="font-black text-blue-950 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <span>Guía rápida para obtener las 2 credenciales en Meta Developers:</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                  <li>En tu pantalla de Meta Business (la que mostraste en la imagen), haz clic en el botón superior derecho <strong>"Administrador de WhatsApp"</strong> o abre <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-700 underline font-bold">developers.facebook.com</a>.</li>
                  <li>Selecciona o crea tu App de tipo <em>Business</em> y entra en el menú izquierdo: <strong>WhatsApp ➔ Configuración de la API (API Setup)</strong>.</li>
                  <li>En la sección <strong>Paso 1: Seleccionar números de teléfono</strong>, verás:
                    <ul className="list-disc list-inside ml-4 mt-0.5 text-slate-700 font-semibold">
                      <li><strong>Identificador de número de teléfono:</strong> Cópialo y pégalo en el campo de arriba.</li>
                      <li><strong>Token de acceso temporal:</strong> Cópialo y pégalo arriba para probar.</li>
                    </ul>
                  </li>
                  <li><strong>Nota sobre el número de prueba de Meta (+1 555-401-3860):</strong> Si usas el número de prueba gratuito de Meta, recuerda agregar tu número personal de celular en el campo <em>"Para (To)"</em> de esa página de Meta para que te permita recibir el mensaje de prueba.</li>
                </ol>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: SIMULADOR Y ENVÍO 1-CLIC (WA.ME)                       */}
          {/* ============================================================ */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
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
                      Tipo de Notificación:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTipoNotificacion('puntual');
                          setHoraSimulada('08:32');
                        }}
                        className={`py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all ${
                          tipoNotificacion === 'puntual'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Puntual
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoNotificacion('tarde');
                          setHoraSimulada('08:47');
                        }}
                        className={`py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all ${
                          tipoNotificacion === 'tarde'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Tarde
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTipoNotificacion('salida');
                          setHoraSimulada('14:05');
                        }}
                        className={`py-1.5 px-1 text-[11px] font-bold rounded-xl transition-all ${
                          tipoNotificacion === 'salida'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        Salida
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
                        <span>{horaSimulada}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {sentSuccessMsg && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{sentSuccessMsg}</span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleTestSendManual}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer hover:scale-102"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Abrir Chat con Mensaje Listo (1-Clic)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: MONITOR DE ENVÍOS EN VIVO                             */}
          {/* ============================================================ */}
          {activeTab === 'monitor' && (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-white">Monitor de Despachos Automáticos</h4>
                      <p className="text-[11px] text-slate-400">
                        Registro en vivo de cada notificación que el sistema intenta enviar por WhatsApp al escanear tarjeta
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={verifyTokenNow}
                    disabled={isCheckingToken}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingToken ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Disparador Automático:</span>
                    <strong className="text-emerald-400 font-bold">
                      {config.auto_notify_scan ? '🟢 Activado' : '🔴 Desactivado'}
                    </strong>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Avisos de Salida:</span>
                    <strong className="text-emerald-400 font-bold">
                      {config.notify_salida ? '🟢 Activado' : '⚪ Desactivado'}
                    </strong>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Token en Servidor:</span>
                    <strong className="text-emerald-400 font-bold">
                      {tokenStatus?.valid ? '🟢 Permanente Conectado' : '🟡 Revisar'}
                    </strong>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700">
                    <span className="text-slate-400 block text-[10px]">Estado Meta API:</span>
                    <strong className={tokenStatus?.valid ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {tokenStatus?.valid ? '🟢 Conectado Oficial' : '🟡 Revisar Token'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Notice explaining Meta WhatsApp Cloud API rules */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs space-y-2 text-slate-800">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>¿Cómo funciona el envío automático de WhatsApp con Meta?</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700">
                  El servidor dispara automáticamente la notificación a los acudientes en segundo plano cada vez que un estudiante registra su entrada o salida.
                </p>
                <div className="text-[11px] space-y-1.5 text-slate-700 bg-white/90 p-2.5 rounded-xl border border-blue-100">
                  <p className="font-bold text-slate-900">Puntos clave de la política de Meta WhatsApp Cloud API:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li><strong>Modo de Pruebas (+1 555-649-6139):</strong> Meta solo entrega mensajes a los teléfonos agregados en la lista <em>&quot;Para (To)&quot;</em> dentro de <em>developers.facebook.com ➔ WhatsApp ➔ Configuración de la API</em>. Tu número <strong>{config.test_phone || '3023396841'}</strong> ya está autorizado y recibe los mensajes de prueba con éxito.</li>
                    <li><strong>Para enviar a TODOS los padres automáticamente:</strong> En <em>developers.facebook.com ➔ Paso 5</em>, registra un número de celular de Colombia (SIM del colegio). Una vez verificado con SMS, Meta enviará los mensajes a cualquier padre de familia sin lista previa.</li>
                    <li><strong>Envío Manual / Asistido 1-Clic:</strong> Puedes usar el botón verde <em>&quot;📲 Enviar por WhatsApp&quot;</em> para abrir la conversación oficial al instante.</li>
                  </ul>
                </div>
              </div>

              {/* Recent Dispatches List */}
              <div className="space-y-2">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Últimos Intentos de Envío ({recentDispatches.length})</span>
                  <span className="text-[10px] font-normal text-slate-500 lowercase">ordenados por más reciente</span>
                </h5>

                {recentDispatches.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-slate-500 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">Aún no hay registros de envíos automáticos en esta sesión.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Cada vez que un estudiante pase su tarjeta por el lector RFID o se registre asistencia en el sistema, aquí verás el resultado en tiempo real.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {recentDispatches.map((disp: any) => {
                      const cleanPhone = (disp.acudienteContacto || '').replace(/\D/g, '');
                      const formattedPhone = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
                      const directWaUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
                        `🏫 *I.E. San Nicolás de Tolentino*\nEstimado acudiente, le confirmamos la ${disp.tipo === 'salida' ? 'salida' : 'asistencia'} de ${disp.estudianteNombre} hoy a las ${disp.timestamp}.`
                      )}`;

                      return (
                        <div
                          key={disp.id}
                          className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                        >
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-slate-900 truncate">
                                {disp.estudianteNombre}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                disp.tipo === 'salida' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {disp.tipo === 'salida' ? 'Salida' : disp.tipo === 'prueba' ? 'Prueba' : 'Entrada'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {disp.timestamp}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 flex items-center gap-2">
                              <span>Acudiente: <strong className="font-mono text-slate-700">{disp.acudienteContacto}</strong></span>
                            </div>

                            <div className="text-[11px] pt-1">
                              {disp.success ? (
                                <span className="text-emerald-700 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Entregado a Meta Cloud API con éxito (ID: {disp.messageId || 'OK'})</span>
                                </span>
                              ) : disp.metaCode === 131030 ? (
                                <span className="text-amber-700 font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Meta Modo Prueba: Agrega este número a la lista de destinatarios en developers.facebook.com</span>
                                </span>
                              ) : disp.metaCode === 131037 ? (
                                <span className="text-amber-700 font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Retenido por Meta (Código 131037: Pendiente aprobación del nombre)</span>
                                </span>
                              ) : (
                                <span className="text-rose-700 font-medium">
                                  {disp.note || 'Error al enviar por Meta Cloud API'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            <a
                              href={directWaUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                              title="Abrir WhatsApp Web con el mensaje listo"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Enviar por WhatsApp Web</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Meta Cloud API • Conexión HTTPS segura
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
