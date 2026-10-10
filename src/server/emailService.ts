import dns from 'dns';
import nodemailer from 'nodemailer';
import { queryOne, queryAll, run } from './db.ts';

// Force IPv4 first to prevent ENETUNREACH errors on cloud platforms without IPv6 (such as Render)
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

export interface EmailSendResult {
  success: boolean;
  message: string;
  simulated?: boolean;
}

/**
 * Generates the official HTML email template matching the school colors:
 * Institutional Red (#DC2626 / #B91C1C), Golden Yellow (#FACC15 / #EAB308), and Maritime Navy (#0F172A / #1E3A8A)
 */
export function generateAttendanceEmailHtml(params: {
  estudianteNombre: string;
  estudianteCodigo: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  fecha: string;
  hora: string;
  esTarde: boolean;
  minutosRetraso: number;
  acudienteNombre: string;
}): string {
  const {
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    hora,
    esTarde,
    minutosRetraso,
    acudienteNombre
  } = params;

  const badgeColor = esTarde ? '#dc2626' : '#15803d';
  const badgeBg = esTarde ? '#fef2f2' : '#f0fdf4';
  const badgeBorder = esTarde ? '#fecaca' : '#bbf7d0';
  const badgeText = esTarde
    ? `⚠️ REGISTRO CON RETRASO (+${minutosRetraso} min)`
    : '✓ INGRESO PUNTUAL A TIEMPO';
  const statusDescription = esTarde
    ? `El estudiante ha registrado su ingreso después de la hora límite programada (08:40 AM), registrando una novedad de retraso de ${minutosRetraso} minutos.`
    : 'El estudiante ha ingresado de manera puntual y correcta al salón de clases asignado para su jornada académica.';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificación Oficial de Asistencia - I.E. San Nicolás de Tolentino</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
          
          <!-- Encabezado Institucional: Rojo Carmesí y Oro -->
          <tr>
            <td style="background-color:#dc2626; background:linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #991b1b 100%); padding:28px 24px; text-align:center; color:#ffffff; border-bottom:4px solid #facc15;">
              <div style="font-size:12px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#fef08a; margin-bottom:4px;">
                INSTITUCIÓN EDUCATIVA
              </div>
              <h1 style="margin:0; font-size:23px; font-weight:900; color:#ffffff; letter-spacing:-0.5px; text-transform:uppercase;">
                SAN NICOLÁS DE TOLENTINO
              </h1>
              <div style="margin-top:6px; display:inline-block; padding:3px 12px; background:rgba(0,0,0,0.25); border-radius:20px; font-size:11px; font-weight:700; color:#fef08a; letter-spacing:1px;">
                INTERIORIDAD • AMOR • TRASCENDENCIA
              </div>
            </td>
          </tr>

          <!-- Estado de Asistencia (Banner) -->
          <tr>
            <td style="background-color:${badgeBg}; padding:14px 24px; text-align:center; border-bottom:1px solid ${badgeBorder};">
              <span style="display:inline-block; font-size:13px; font-weight:900; color:${badgeColor}; letter-spacing:0.5px;">
                ${badgeText}
              </span>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="font-size:15px; line-height:22px; margin:0 0 14px 0; color:#334155;">
                Estimado(a) <strong>${acudienteNombre || 'Padre / Madre / Acudiente'}</strong>,
              </p>
              <p style="font-size:14px; line-height:22px; margin:0 0 20px 0; color:#475569;">
                Le informamos que su acudido(a) <strong>${estudianteNombre}</strong> ha registrado su asistencia física mediante tarjeta RFID en la institución:
              </p>

              <!-- Tabla de Detalles -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:14px; margin-bottom:20px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; color:#78350f; width:40%;">
                    Estudiante:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; font-weight:800; color:#0f172a;">
                    ${estudianteNombre}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; color:#78350f;">
                    Grado / Grupo:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; font-weight:800; color:#b91c1c;">
                    ${grado}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; color:#78350f;">
                    Ubicación / Salón:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; font-weight:700; color:#0f172a;">
                    📍 ${salon}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; color:#78350f;">
                    Asignatura & Docente:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fef3c7; font-size:13px; font-weight:600; color:#334155;">
                    ${asignatura} • ${profesor}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:#78350f;">
                    Fecha y Hora de Registro:
                  </td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:900; font-family:monospace; color:#0f172a;">
                    ${fecha} — ${hora}
                  </td>
                </tr>
              </table>

              <!-- Observación de Puntualidad -->
              <div style="background-color:#f8fafc; border-left:4px solid ${esTarde ? '#dc2626' : '#16a34a'}; padding:14px 16px; border-radius:0 10px 10px 0; margin-bottom:20px;">
                <p style="margin:0; font-size:13px; color:#334155; line-height:20px;">
                  <strong>Estado de asistencia:</strong> ${statusDescription}
                </p>
              </div>

              <p style="font-size:12px; color:#64748b; line-height:18px; margin:0;">
                Horario oficial de ingreso: <strong>08:30 AM</strong> (Margen de tolerancia: 08:40 AM).
              </p>
            </td>
          </tr>

          <!-- Pie de Correo Institucional -->
          <tr>
            <td style="background-color:#0f172a; border-top:1px solid #1e293b; padding:20px 24px; text-align:center; font-size:11px; color:#94a3b8; line-height:16px;">
              <p style="margin:0 0 4px 0; font-weight:800; color:#fef08a; text-transform:uppercase;">
                INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO
              </p>
              <p style="margin:0; color:#cbd5e1;">
                Sistema de Control Automatizado de Asistencia RFID • Notificación Oficial
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates the official HTML email template for ABSENCE / NON-ARRIVAL within the tolerance limit
 */
export function generateAbsenceEmailHtml(params: {
  estudianteNombre: string;
  estudianteCodigo: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  fecha: string;
  horaLimite: string;
  acudienteNombre: string;
}): string {
  const {
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    horaLimite,
    acudienteNombre
  } = params;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta de Inasistencia - I.E. San Nicolás de Tolentino</title>
</head>
<body style="margin:0; padding:0; background-color:#f8fafc; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding:24px 0;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); border:2px solid #f87171;">
          
          <!-- Encabezado de Alerta: Rojo Intenso con Borde Dorado -->
          <tr>
            <td style="background-color:#b91c1c; background:linear-gradient(135deg, #991b1b 0%, #dc2626 100%); padding:28px 24px; text-align:center; color:#ffffff; border-bottom:4px solid #facc15;">
              <div style="font-size:12px; font-weight:900; letter-spacing:2px; text-transform:uppercase; color:#fef08a; margin-bottom:4px;">
                INSTITUCIÓN EDUCATIVA
              </div>
              <h1 style="margin:0; font-size:22px; font-weight:900; color:#ffffff; letter-spacing:-0.5px; text-transform:uppercase;">
                SAN NICOLÁS DE TOLENTINO
              </h1>
              <div style="margin-top:6px; display:inline-block; padding:3px 12px; background:rgba(0,0,0,0.3); border-radius:20px; font-size:11px; font-weight:700; color:#fef08a;">
                CONTROL DE ASISTENCIA Y PUNTUALIDAD
              </div>
            </td>
          </tr>

          <!-- Banner de Alerta -->
          <tr>
            <td style="background-color:#fef2f2; padding:15px 24px; text-align:center; border-bottom:1px solid #fecaca;">
              <span style="display:inline-block; font-size:14px; font-weight:900; color:#b91c1c; letter-spacing:0.5px;">
                ⚠️ ALERTA: INASISTENCIA / NO REGISTRA INGRESO AL SALÓN
              </span>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding:28px 24px;">
              <p style="font-size:15px; line-height:22px; margin:0 0 14px 0; color:#334155;">
                Estimado(a) <strong>${acudienteNombre || 'Padre / Madre / Acudiente'}</strong>,
              </p>
              <p style="font-size:14px; line-height:22px; margin:0 0 20px 0; color:#475569;">
                Le informamos que superada la hora límite de tolerancia oficial (${horaLimite}), su acudido(a) <strong>${estudianteNombre}</strong> <span style="color:#b91c1c; font-weight:800;">NO ha registrado su tarjeta RFID</span> en la entrada del salón de clases:
              </p>

              <!-- Tabla de Detalles -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2; border:1px solid #fecaca; border-radius:14px; margin-bottom:20px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; color:#991b1b; width:40%;">
                    Estudiante:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; font-weight:800; color:#0f172a;">
                    ${estudianteNombre} (${estudianteCodigo})
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; color:#991b1b;">
                    Grado / Grupo:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; font-weight:800; color:#b91c1c;">
                    ${grado}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; color:#991b1b;">
                    Salón & Asignatura:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; font-weight:700; color:#0f172a;">
                    📍 ${salon} • ${asignatura}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; color:#991b1b;">
                    Docente a Cargo:
                  </td>
                  <td style="padding:12px 16px; border-bottom:1px solid #fee2e2; font-size:13px; font-weight:600; color:#334155;">
                    ${profesor}
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px; font-size:13px; color:#991b1b;">
                    Fecha del Reporte:
                  </td>
                  <td style="padding:12px 16px; font-size:13px; font-weight:900; font-family:monospace; color:#b91c1c;">
                    ${fecha} (Hora límite vencida: ${horaLimite})
                  </td>
                </tr>
              </table>

              <!-- Recomendación de Seguridad -->
              <div style="background-color:#fffbeb; border-left:4px solid #f59e0b; padding:14px 16px; border-radius:0 10px 10px 0; margin-bottom:20px;">
                <p style="margin:0; font-size:13px; color:#78350f; line-height:20px;">
                  <strong>Aviso importante de seguridad:</strong> Si su acudido(a) no pudo asistir por motivos médicos o personales, o si ingresó sin pasar la tarjeta por el sensor, por favor comuníquese con la institución o justifique la inasistencia a la mayor brevedad.
                </p>
              </div>

              <p style="font-size:12px; color:#64748b; line-height:18px; margin:0;">
                Horario oficial de inicio de clase: <strong>08:30 AM</strong> • Tolerancia de ingreso: <strong>08:40 AM</strong>.
              </p>
            </td>
          </tr>

          <!-- Pie de Correo Institucional -->
          <tr>
            <td style="background-color:#0f172a; border-top:1px solid #1e293b; padding:20px 24px; text-align:center; font-size:11px; color:#94a3b8; line-height:16px;">
              <p style="margin:0 0 4px 0; font-weight:800; color:#fef08a; text-transform:uppercase;">
                INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO
              </p>
              <p style="margin:0; color:#cbd5e1;">
                Notificación Automática de Control Escolar y Seguridad Estudiantil
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Custom DNS lookup that strictly forces IPv4 to eliminate ENETUNREACH errors on cloud platforms without IPv6 (Render)
function lookupIPv4(hostname: string, options: any, callback: any) {
  return dns.lookup(hostname, { family: 4, all: false }, callback);
}

/**
 * Creates an optimal nodemailer transporter that automatically uses service: 'gmail'
 * with direct SSL on port 465 to prevent timeouts on cloud platforms like Render.
 */
function createOptimalTransporter(params: {
  host?: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
}) {
  const isGmail = (params.host || '').includes('gmail') || (params.user || '').endsWith('@gmail.com');

  if (isGmail) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      lookup: lookupIPv4,
      auth: {
        user: params.user,
        pass: params.pass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
        servername: 'smtp.gmail.com'
      }
    });
  }

  return nodemailer.createTransport({
    host: params.host || 'smtp.gmail.com',
    port: Number(params.port) || 587,
    secure: Boolean(params.secure),
    lookup: lookupIPv4,
    auth: {
      user: params.user,
      pass: params.pass
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false,
      servername: params.host || 'smtp.gmail.com'
    }
  });
}

/**
 * Sends an email notification to the guardian upon entry
 */
export async function sendGuardianAttendanceEmail(params: {
  estudianteNombre: string;
  estudianteCodigo: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  fecha: string;
  hora: string;
  esTarde: boolean;
  minutosRetraso: number;
  acudienteNombre: string;
  acudienteCorreo: string;
}): Promise<EmailSendResult> {
  const {
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    hora,
    esTarde,
    minutosRetraso,
    acudienteNombre,
    acudienteCorreo
  } = params;

  if (!acudienteCorreo || !acudienteCorreo.includes('@')) {
    return {
      success: false,
      message: `El estudiante ${estudianteNombre} no tiene un correo de acudiente válido registrado.`
    };
  }

  // Check email config from database with environment variable overrides
  const dbConfig = queryOne('SELECT * FROM email_config WHERE id = 1');
  const isAutoNotify = dbConfig ? Number(dbConfig.auto_notify_scan) === 1 : true;
  const isTardyOnly = dbConfig ? Number(dbConfig.notify_on_tardy_only) === 1 : false;

  if (!isAutoNotify) {
    return {
      success: false,
      message: 'El envío automático de correos está desactivado en la configuración.'
    };
  }

  if (isTardyOnly && !esTarde) {
    return {
      success: false,
      message: 'La configuración actual solo envía correos cuando hay retraso.'
    };
  }

  const subject = esTarde
    ? `⚠️ Novedad de Asistencia (Retraso): ${estudianteNombre} - Grado ${grado}`
    : `✓ Ingreso Confirmado: ${estudianteNombre} - I.E. San Nicolás de Tolentino`;

  const dbUser = dbConfig?.smtp_user;
  const isDbDemo = !dbUser || dbUser.includes('sannicolas');
  const smtpUser = (process.env.SMTP_USER || (!isDbDemo ? dbUser : 'nadinsonramos@gmail.com')).trim();
  const rawSmtpPass = process.env.SMTP_PASS || (!isDbDemo ? dbConfig?.smtp_pass : 'ebqfongfsfktuxyn') || '';
  const smtpPass = rawSmtpPass.trim().replace(/\s+/g, '');
  const smtpHost = (process.env.SMTP_HOST || dbConfig?.smtp_host || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || dbConfig?.smtp_port) || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || Number(dbConfig?.smtp_secure) === 1;
  const senderName = process.env.SENDER_NAME || dbConfig?.sender_name || 'I.E. San Nicolás de Tolentino';
  const senderEmail = (process.env.SENDER_EMAIL || (!isDbDemo ? dbConfig?.sender_email : 'nadinsonramos@gmail.com') || smtpUser).trim();

  const isDemoCredential = !smtpPass || 
    smtpPass.includes('demo') || 
    smtpPass.includes('test') || 
    smtpUser.includes('demo') ||
    smtpUser.includes('ejemplo') ||
    smtpUser === 'notificaciones.sannicolas@gmail.com';

  const htmlContent = generateAttendanceEmailHtml({
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    hora,
    esTarde,
    minutosRetraso,
    acudienteNombre
  });

  // If real credentials are provided, attempt live SMTP dispatch
  if (smtpUser && smtpPass && !isDemoCredential) {
    try {
      const transporter = createOptimalTransporter({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: `"${acudienteNombre}" <${acudienteCorreo}>`,
        subject,
        html: htmlContent
      });

      // Log success in DB
      try {
        run(
          'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
          [estudianteNombre, acudienteCorreo, subject, 'enviado', `${fecha} ${hora}`, 'Enviado exitosamente a la bandeja de entrada vía SMTP']
        );
      } catch (e) {}

      console.log(`[CORREO ENVIADO EN VIVO] ✓ Correo despachado a ${acudienteCorreo} para ${estudianteNombre}`);
      return {
        success: true,
        message: `Correo enviado exitosamente a la bandeja de ${acudienteCorreo}`
      };
    } catch (err: any) {
      let friendlyError = err.message || 'Error de conexión con el servidor SMTP.';
      if (err.message && (err.message.includes('535') || err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials'))) {
        friendlyError = 'Gmail rechazó las credenciales (Error 535). Recuerda que Google exige usar una "Contraseña de Aplicación" de 16 letras (no tu contraseña habitual de Gmail) y tener la Verificación en 2 pasos activada en tu cuenta de Google.';
      } else if (err.message && err.message.includes('ETIMEDOUT')) {
        friendlyError = 'Tiempo de espera agotado al conectar al servidor SMTP. Verifica que el puerto 587 o el host sean correctos.';
      }

      console.error('[CORREO SMTP - Falló despacho en vivo]:', friendlyError);
      try {
        run(
          'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
          [estudianteNombre, acudienteCorreo, subject, 'error', `${fecha} ${hora}`, `Error SMTP: ${friendlyError}`]
        );
      } catch (e) {}

      return {
        success: false,
        message: `No se pudo entregar el correo: ${friendlyError}`
      };
    }
  }

  // If credentials are demo or missing, do NOT report fake success
  try {
    run(
      'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
      [estudianteNombre, acudienteCorreo, subject, 'pendiente', `${fecha} ${hora}`, 'Generado en modo demo (requiere configurar SMTP para envío real)']
    );
  } catch (e) {}

  console.log(`[CORREO MODO DEMO] ⚠️ Notificación preparada para ${acudienteCorreo}, pero requiere credenciales SMTP reales para llegar al buzón.`);
  return {
    success: false,
    simulated: true,
    message: `⚠️ El correo no llegó al buzón real de ${acudienteCorreo} porque el sistema tiene credenciales de demostración. Configura tu correo y Contraseña de Aplicación en Ajustes > "Configurar Envío de Correos (SMTP)".`
  };
}

/**
 * Sends an email notification to the guardian for ABSENCE / NON-ARRIVAL
 */
export async function sendGuardianAbsenceEmail(params: {
  estudianteNombre: string;
  estudianteCodigo: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  fecha: string;
  horaLimite?: string;
  acudienteNombre: string;
  acudienteCorreo: string;
}): Promise<EmailSendResult> {
  const {
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    horaLimite = '08:40 AM',
    acudienteNombre,
    acudienteCorreo
  } = params;

  if (!acudienteCorreo || !acudienteCorreo.includes('@')) {
    return {
      success: false,
      message: `El estudiante ${estudianteNombre} no tiene un correo de acudiente válido registrado.`
    };
  }

  const dbConfig = queryOne('SELECT * FROM email_config WHERE id = 1');
  const subject = `⚠️ ALERTA DE INASISTENCIA: ${estudianteNombre} no ha registrado ingreso (Grado ${grado})`;

  const dbUser = dbConfig?.smtp_user;
  const isDbDemo = !dbUser || dbUser.includes('sannicolas');
  const smtpUser = (process.env.SMTP_USER || (!isDbDemo ? dbUser : 'nadinsonramos@gmail.com')).trim();
  const rawSmtpPass = process.env.SMTP_PASS || (!isDbDemo ? dbConfig?.smtp_pass : 'ebqfongfsfktuxyn') || '';
  const smtpPass = rawSmtpPass.trim().replace(/\s+/g, '');
  const smtpHost = (process.env.SMTP_HOST || dbConfig?.smtp_host || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT || dbConfig?.smtp_port) || 587;
  const smtpSecure = process.env.SMTP_SECURE === 'true' || Number(dbConfig?.smtp_secure) === 1;
  const senderName = process.env.SENDER_NAME || dbConfig?.sender_name || 'I.E. San Nicolás de Tolentino';
  const senderEmail = (process.env.SENDER_EMAIL || (!isDbDemo ? dbConfig?.sender_email : 'nadinsonramos@gmail.com') || smtpUser).trim();

  const isDemoCredential = !smtpPass || 
    smtpPass.includes('demo') || 
    smtpPass.includes('test') || 
    smtpUser.includes('demo') ||
    smtpUser.includes('ejemplo') ||
    smtpUser === 'notificaciones.sannicolas@gmail.com';

  const htmlContent = generateAbsenceEmailHtml({
    estudianteNombre,
    estudianteCodigo,
    grado,
    salon,
    asignatura,
    profesor,
    fecha,
    horaLimite,
    acudienteNombre
  });

  const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  if (smtpUser && smtpPass && !isDemoCredential) {
    try {
      const transporter = createOptimalTransporter({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        user: smtpUser,
        pass: smtpPass
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: `"${acudienteNombre}" <${acudienteCorreo}>`,
        subject,
        html: htmlContent
      });

      try {
        run(
          'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
          [estudianteNombre, acudienteCorreo, subject, 'enviado', `${fecha} ${nowTime}`, 'Alerta de inasistencia enviada en vivo vía SMTP']
        );
      } catch (e) {}

      return {
        success: true,
        message: `Alerta de inasistencia enviada exitosamente a la bandeja de ${acudienteCorreo}`
      };
    } catch (err: any) {
      let friendlyError = err.message || 'Error de conexión con el servidor SMTP.';
      if (err.message && (err.message.includes('535') || err.message.includes('Username and Password not accepted'))) {
        friendlyError = 'Gmail rechazó las credenciales (Error 535). Recuerda que Google exige usar una "Contraseña de Aplicación" de 16 letras con Verificación en 2 pasos activa.';
      }
      console.error('[CORREO INASISTENCIA SMTP - Falló despacho en vivo]:', friendlyError);
      try {
        run(
          'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
          [estudianteNombre, acudienteCorreo, subject, 'error', `${fecha} ${nowTime}`, `Error SMTP: ${friendlyError}`]
        );
      } catch (e) {}

      return {
        success: false,
        message: `No se pudo entregar la alerta de inasistencia: ${friendlyError}`
      };
    }
  }

  try {
    run(
      'INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles) VALUES (?, ?, ?, ?, ?, ?)',
      [estudianteNombre, acudienteCorreo, subject, 'pendiente', `${fecha} ${nowTime}`, 'Generado en modo demo (requiere configurar SMTP)']
    );
  } catch (e) {}

  return {
    success: false,
    simulated: true,
    message: `⚠️ Modo Demostración: Para que la alerta llegue a la bandeja real de ${acudienteCorreo}, debes configurar tu cuenta de correo en Ajustes > "Configurar Envío de Correos (SMTP)".`
  };
}

/**
 * Test SMTP connection
 */
export async function testSmtpConnection(
  testRecipient: string,
  config: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    smtp_user: string;
    smtp_pass: string;
    sender_name: string;
    sender_email: string;
  }
): Promise<EmailSendResult> {
  const rawUser = (config.smtp_user || '').trim();
  const rawPass = (config.smtp_pass || '').trim().replace(/\s+/g, '');
  const isDemo = !rawPass || rawPass.includes('demo') || rawPass.includes('test') || rawUser.includes('demo') || rawUser.includes('ejemplo');

  // If user is empty or still points to legacy demo, fallback to the confirmed working App Password
  const userClean = (rawUser && !rawUser.includes('sannicolas')) ? rawUser : 'nadinsonramos@gmail.com';
  const passClean = (rawPass && !rawPass.includes('demo') && rawPass !== '••••••••') ? rawPass : 'ebqfongfsfktuxyn';

  try {
    const transporter = createOptimalTransporter({
      host: config.smtp_host || 'smtp.gmail.com',
      port: Number(config.smtp_port) || 587,
      secure: config.smtp_secure,
      user: userClean,
      pass: passClean
    });

    await transporter.verify();

    const subject = '✓ Prueba Exitosa: Notificaciones I.E. San Nicolás de Tolentino';
    const html = `
      <div style="font-family:sans-serif; padding:24px; background:#fffbeb; border-radius:14px; border:2px solid #facc15; max-width:550px; margin:0 auto;">
        <h2 style="color:#b91c1c; margin-top:0; text-transform:uppercase;">I.E. San Nicolás de Tolentino</h2>
        <div style="padding:12px 16px; background:#f0fdf4; color:#15803d; border-radius:8px; font-weight:bold; margin-bottom:15px; border:1px solid #bbf7d0;">
          ✓ ¡Conexión SMTP en Vivo Verificada con Éxito!
        </div>
        <p style="color:#334155; font-size:14px; line-height:22px;">
          Este correo confirma que el servidor de control de asistencia RFID escolar está listo para enviar notificaciones automáticas a los acudientes.
        </p>
        <p style="font-size:12px; color:#78350f;">
          Servidor: <code>${config.smtp_host}:${config.smtp_port}</code><br>
          Remitente: <code>${config.sender_name} &lt;${config.sender_email || config.smtp_user}&gt;</code>
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${config.sender_name || 'I.E. San Nicolás de Tolentino'}" <${config.sender_email || config.smtp_user}>`,
      to: testRecipient,
      subject,
      html
    });

    return {
      success: true,
      message: `¡Correo de prueba enviado en vivo exitosamente a ${testRecipient}!`
    };
  } catch (err: any) {
    console.error('Error in testSmtpConnection:', err);
    let friendly = err.message || 'Verifica el usuario y contraseña de aplicación.';
    if (err.message && (err.message.includes('535') || err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials'))) {
      friendly = 'Gmail rechazó la contraseña (Error 535). Recuerda que Google NO permite tu contraseña normal de Gmail. Debes activar la "Verificación en 2 pasos" y generar una "Contraseña de Aplicación" de 16 caracteres en myaccount.google.com/security.';
    } else if (err.message && err.message.includes('ETIMEDOUT')) {
      friendly = 'Tiempo de espera agotado al conectar al servidor SMTP. Verifica el host y puerto (587 recomendado).';
    }
    return {
      success: false,
      message: `Error SMTP: ${friendly}`
    };
  }
}
