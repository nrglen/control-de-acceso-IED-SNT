import { getWhatsAppConfig } from './db';

export interface SendWhatsAppOptions {
  to: string;
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateComponents?: any[];
}

export interface SendAttendanceWhatsAppParams {
  acudienteNombre: string;
  acudienteContacto: string;
  estudianteNombre: string;
  estudianteCodigo?: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  hora: string;
  esTarde?: boolean;
  minutosRetraso?: number;
  isSalida?: boolean;
  nombreColegio?: string;
}

/**
 * Normaliza número de teléfono al formato internacional requerido por Meta
 * Ej: "3135710894" -> "573135710894"
 */
export function normalizePhoneNumber(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  // Si tiene 10 dígitos y empieza por 3 (celulares Colombia)
  if (digits.length === 10 && digits.startsWith('3')) {
    return `57${digits}`;
  }
  // Si ya tiene código de país (57...)
  if (digits.startsWith('57') && digits.length === 12) {
    return digits;
  }
  return digits;
}

/**
 * Envía un mensaje directo a través de la API oficial de WhatsApp Cloud de Meta
 */
export async function sendMetaWhatsAppMessage(options: SendWhatsAppOptions): Promise<{
  success: boolean;
  messageId?: string;
  status?: number;
  error?: string;
  details?: any;
}> {
  const config = getWhatsAppConfig();
  const phone = normalizePhoneNumber(options.to);

  if (!phone) {
    return {
      success: false,
      error: 'El número de teléfono del destinatario está vacío o no es válido.'
    };
  }

  if (!config.phone_number_id || !config.access_token) {
    return {
      success: false,
      error: 'Credenciales incompletas de WhatsApp en el servidor. Debe configurar el "Phone Number ID" y el "Access Token" de Meta.'
    };
  }

  const cleanPhoneId = config.phone_number_id.trim();
  const cleanToken = config.access_token.trim();
  const url = `https://graph.facebook.com/v21.0/${cleanPhoneId}/messages`;

  const payload: any = options.templateName
    ? {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: options.templateName,
          language: { code: options.templateLanguage || 'es_CO' },
          ...(options.templateComponents && options.templateComponents.length > 0
            ? { components: options.templateComponents }
            : {})
        }
      }
    : {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: {
          preview_url: false,
          body: options.text || ''
        }
      };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const errCode = data.error?.code;
      const errMsg = data.error?.message || `Error HTTP ${res.status}`;
      const errDetails = data.error?.error_data?.details || data.error?.error_user_msg || data.error?.type || '';
      
      const safeDetails = {
        code: errCode || res.status,
        message: errMsg,
        info: errDetails || 'Respuesta de Meta Cloud API',
        fbtrace_id: data.error?.fbtrace_id || undefined
      };

      if (errCode === 190) {
        console.info('[Meta WhatsApp API]: Token de acceso expirado (Código 190). Renovar token en developers.facebook.com.');
      } else {
        console.info(`[Meta WhatsApp API]: Respuesta de Meta código ${errCode || res.status}: ${errMsg}`);
      }

      let helpfulAdvice = '';
      if (errCode === 131037 || (errMsg && errMsg.includes('display name approval'))) {
        helpfulAdvice = ' ⚠️ Meta requiere aprobación del nombre ("Display Name"): El número virtual de Meta asignado a "IED San Nicolas De Tolentino" se encuentra en revisión automática por Meta (código 131037). Una vez completada la revisión por Meta o activado tu número con SMS, los mensajes se enviarán automáticamente.';
      } else if (errCode === 131058 || (errMsg && errMsg.includes('Public Test Numbers'))) {
        helpfulAdvice = ' ⚠️ La plantilla "hello_world" de prueba solo funciona con el número de prueba genérico de Meta. Para tu número personalizado usa una plantilla aprobada de tu cuenta o un mensaje de texto.';
      } else if (errCode === 131030 || (errMsg && errMsg.includes('not in allowed list'))) {
        helpfulAdvice = ' 💡 Tip: En el modo de prueba, Meta exige que agregues el número destinatario en la lista "Para" (To) en developers.facebook.com ➔ WhatsApp ➔ Configuración de la API (Administrar lista de números de teléfono).';
      } else if (errCode === 131047 || (errMsg && errMsg.includes('24 hours'))) {
        helpfulAdvice = ' 💡 Tip: Han pasado más de 24 horas sin conversación previa. Puedes enviar una plantilla oficial aprobada o escribir primero desde el celular al número para abrir la ventana de 24 horas.';
      } else if (errCode === 190) {
        helpfulAdvice = ' ⚠️ Token de Meta expirado: Los tokens temporales caducan tras 24 horas. Genera un nuevo token o usa un token de usuario del sistema permanente.';
      }

      return {
        success: false,
        status: res.status,
        error: `${errMsg}${errDetails ? ` (${errDetails})` : ''}.${helpfulAdvice}`,
        details: safeDetails
      };
    }

    const messageId = data.messages?.[0]?.id;
    return {
      success: true,
      messageId,
      status: res.status,
      details: data
    };
  } catch (err: any) {
    console.warn('[WhatsApp Network Issue]:', err.message || err);
    return {
      success: false,
      error: err.message || 'Error de red al comunicarse con graph.facebook.com'
    };
  }
}

/**
 * Verifica el estado del token actual de WhatsApp con Meta Cloud API
 * e inspecciona las plantillas disponibles en la WABA
 */
export async function checkWhatsAppTokenStatus(): Promise<{
  valid: boolean;
  status: 'valid' | 'expired' | 'missing' | 'error';
  message: string;
  phoneInfo?: any;
  templates?: any[];
  hasPendingApproval?: boolean;
}> {
  const config = getWhatsAppConfig();
  if (!config.access_token || !config.phone_number_id) {
    return {
      valid: false,
      status: 'missing',
      message: 'No hay credenciales de WhatsApp configuradas en el servidor.'
    };
  }

  const phoneId = config.phone_number_id.trim();
  const token = config.access_token.trim();
  const wabaId = (config.waba_id || '').trim();

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}?fields=verified_name,display_phone_number,quality_rating,code_verification_status,name_status,status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const code = data.error?.code;
      if (code === 190) {
        return {
          valid: false,
          status: 'expired',
          message: 'El Token de acceso de Meta ha expirado (duró 24h). Copia el nuevo token desde developers.facebook.com y pégalo aquí para continuar.'
        };
      }
      return {
        valid: false,
        status: 'error',
        message: data.error?.message || `Error HTTP ${res.status}`
      };
    }

    // Try fetching WABA templates
    let templates: any[] = [];
    if (wabaId) {
      try {
        const tplRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language,category`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const tplData = await tplRes.json().catch(() => ({}));
        if (tplData.data && Array.isArray(tplData.data)) {
          templates = tplData.data;
        }
      } catch (e) {
        // non-fatal
      }
    }

    const isNamePending = data.name_status === 'PENDING_REVIEW' || data.name_status === 'MANUAL_REVIEW';
    const hasPendingTemplates = templates.some(t => t.status === 'PENDING');
    const hasPendingApproval = isNamePending || hasPendingTemplates;

    return {
      valid: true,
      status: 'valid',
      message: 'Token de Meta válido y conectado.',
      phoneInfo: data,
      templates,
      hasPendingApproval
    };
  } catch (err: any) {
    return {
      valid: false,
      status: 'error',
      message: err.message || 'Error de red al verificar token con Meta'
    };
  }
}

export interface RecentWhatsAppDispatch {
  id: string;
  timestamp: string;
  estudianteNombre: string;
  acudienteContacto: string;
  tipo: 'entrada' | 'salida' | 'prueba';
  success: boolean;
  messageId?: string;
  metaCode?: number;
  note?: string;
}

const recentDispatches: RecentWhatsAppDispatch[] = [];

export function recordRecentDispatch(dispatch: Omit<RecentWhatsAppDispatch, 'id' | 'timestamp'>): RecentWhatsAppDispatch {
  const item: RecentWhatsAppDispatch = {
    id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ...dispatch
  };
  recentDispatches.unshift(item);
  if (recentDispatches.length > 25) {
    recentDispatches.pop();
  }
  return item;
}

export function getRecentWhatsAppDispatches(): RecentWhatsAppDispatch[] {
  return recentDispatches;
}

/**
 * Genera y envía la notificación automática de asistencia/salida por WhatsApp
 */
export async function sendGuardianWhatsAppAttendance(params: SendAttendanceWhatsAppParams) {
  const config = getWhatsAppConfig();
  if (!config.auto_notify_scan) {
    const reason = 'Envío automático desactivado en configuración de WhatsApp';
    recordRecentDispatch({
      estudianteNombre: params.estudianteNombre,
      acudienteContacto: params.acudienteContacto,
      tipo: params.isSalida ? 'salida' : 'entrada',
      success: false,
      note: reason
    });
    return { success: false, skipped: true, reason };
  }

  if (params.isSalida && config.notify_salida === false) {
    const reason = 'Notificación de salidas desactivada en configuración';
    recordRecentDispatch({
      estudianteNombre: params.estudianteNombre,
      acudienteContacto: params.acudienteContacto,
      tipo: 'salida',
      success: false,
      note: reason
    });
    return { success: false, skipped: true, reason };
  }

  const colegio = params.nombreColegio || 'I.E. SAN NICOLÁS DE TOLENTINO';
  let message = '';

  if (params.isSalida) {
    message = `🏫 *${colegio} - Control de Asistencia*\n` +
      `Estimado(a) *${params.acudienteNombre || 'Acudiente'}*,\n` +
      `Le confirmamos que su hijo(a) *${params.estudianteNombre}* (${params.grado}) registró su *SALIDA* de la institución hoy a las *${params.hora}*.\n` +
      `👋 ¡Que tenga un excelente resto de día!`;
  } else {
    const estadoStr = !params.esTarde
      ? '✅ Puntual (A tiempo)'
      : `⚠️ Entrada con retraso (+${params.minutosRetraso || 0} min)`;

    message = `🏫 *${colegio} - Control de Asistencia*\n` +
      `Estimado(a) *${params.acudienteNombre || 'Acudiente'}*,\n` +
      `Le confirmamos que su hijo(a) *${params.estudianteNombre}* (${params.grado}) ha ingresado al *${params.salon}* hoy a las *${params.hora}*.\n` +
      `📌 *Estado:* ${estadoStr}\n` +
      `👨‍🏫 *Docente:* ${params.profesor} - ${params.asignatura}`;
  }

  const result = await sendMetaWhatsAppMessage({
    to: params.acudienteContacto,
    text: message
  });

  recordRecentDispatch({
    estudianteNombre: params.estudianteNombre,
    acudienteContacto: params.acudienteContacto,
    tipo: params.isSalida ? 'salida' : 'entrada',
    success: result.success,
    messageId: result.messageId,
    metaCode: result.details?.code,
    note: result.success 
      ? 'Entregado a Meta Cloud API con éxito' 
      : (result.error || 'Rechazado por Meta API')
  });

  return result;
}
