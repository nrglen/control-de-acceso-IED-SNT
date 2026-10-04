import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import {
  initDatabase,
  queryAll,
  queryOne,
  run,
  normalizeUid,
  getLocalDateTime,
  calcularRetraso,
  calcularPuntualidad,
  getAppSettings,
  updateAppSettings,
  HORA_OFICIAL_ENTRADA,
  HORA_LIMITE_PUNTUALIDAD,
  GRADO_OFICIAL,
  SALON_OFICIAL,
  ASIGNATURA_OFICIAL,
  Estudiante,
  ClaseHorario,
  AppSettings
} from './src/server/db.ts';
import {
  sendGuardianAttendanceEmail,
  sendGuardianAbsenceEmail,
  testSmtpConnection,
  generateAttendanceEmailHtml,
  generateAbsenceEmailHtml
} from './src/server/emailService.ts';

const app = express();
app.set('trust proxy', true);
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure static directories exist
const staticDir = path.join(process.cwd(), 'static');
const fotosDir = path.join(staticDir, 'fotos');
const logosDir = path.join(staticDir, 'logos');
if (!fs.existsSync(staticDir)) fs.mkdirSync(staticDir, { recursive: true });
if (!fs.existsSync(fotosDir)) fs.mkdirSync(fotosDir, { recursive: true });
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

// Serve static assets
app.use('/static', express.static(staticDir));

// Multer storage for uploaded photos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, fotosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `foto_${Date.now()}_${cleanName.slice(0, 15)}${ext}`;
    cb(null, filename);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Multer storage for uploaded logo
const logoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, logosDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const filename = `logo_${Date.now()}${ext}`;
    cb(null, filename);
  }
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Helper to save base64 photo (e.g. from camera)
function saveBase64Photo(dataUrl: string): string | null {
  try {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `cam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    fs.writeFileSync(path.join(fotosDir, filename), buffer);
    return `/static/fotos/${filename}`;
  } catch (err) {
    console.error('Error saving base64 photo:', err);
    return null;
  }
}

// Global System Modes
let currentMode: 'asistencia' | 'registro' = 'asistencia';
let modoRegistroExpiry: number | null = null;
let tarjetaPendiente: string | null = null;
let estudianteObjetivoId: number | null = null;

function updateModoState() {
  if (currentMode === 'registro') {
    const now = Date.now();
    if (modoRegistroExpiry && now >= modoRegistroExpiry) {
      currentMode = 'asistencia';
      modoRegistroExpiry = null;
      tarjetaPendiente = null;
      estudianteObjetivoId = null;
    }
  }
}

function getModoInfo() {
  updateModoState();
  let segundos_restantes = 0;
  if (currentMode === 'registro' && modoRegistroExpiry) {
    segundos_restantes = Math.max(0, Math.ceil((modoRegistroExpiry - Date.now()) / 1000));
  }
  return {
    modo: currentMode,
    segundos_restantes,
    estudiante_id: estudianteObjetivoId
  };
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/lectura
 * Status and diagnostic check for the RFID endpoint
 */
app.get('/api/lectura', (_req: Request, res: Response): any => {
  const settings = getAppSettings();
  const { fecha_hora } = getLocalDateTime();
  return res.json({
    ok: true,
    status: 'online',
    servicio: 'Endpoint de Control de Asistencia RFID',
    colegio: settings.nombre_colegio,
    salon: settings.salon,
    asignatura: settings.asignatura,
    profesor: settings.profesor,
    metodo_requerido: 'POST',
    mensaje: 'Servidor activo y listo para recibir lecturas RFID del módulo ESP8266.',
    instrucciones: 'Envía una petición POST con Content-Type: application/json',
    ejemplo_payload: {
      uid: '8B6FD934',
      salon: settings.salon,
      asignatura: settings.asignatura
    },
    fecha_hora
  });
});

/**
 * POST /api/lectura
 * Used by ESP8266 or Simulator
 * Body JSON: {"uid": "A34F129C", "salon": "Salon-101"}
 * Response ALWAYS: {"ok": true, "estado": "<estado>", "nombre": "<nombre o null>"}
 */
app.post('/api/lectura', (req: Request, res: Response): any => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, estado: 'error' });
    }

    const rawUid = body.uid;
    const normalizedUid = normalizeUid(rawUid);
    const appSettings = getAppSettings();
    const salon = (body.salon && typeof body.salon === 'string' && body.salon.trim()) 
      ? body.salon.trim() 
      : (appSettings.salon || SALON_OFICIAL);
    const asignatura = (body.asignatura && typeof body.asignatura === 'string' && body.asignatura.trim())
      ? body.asignatura.trim()
      : (appSettings.asignatura || ASIGNATURA_OFICIAL);

    if (!normalizedUid) {
      return res.status(400).json({ ok: false, estado: 'error' });
    }

    const { fecha, hora, fecha_hora } = getLocalDateTime();
    const modoInfo = getModoInfo();

    // Check if card belongs to a registered student
    const estudiante = queryOne<Estudiante>(
      'SELECT id, codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto FROM estudiantes WHERE uid = ?',
      [normalizedUid]
    );

    // MODE 1: ASISTENCIA (Default)
    if (modoInfo.modo === 'asistencia') {
      if (estudiante) {
        // Class schedule
        const clase = queryOne<ClaseHorario>(
          'SELECT profesor, hora_ingreso FROM clases WHERE salon = ? OR grado = ? LIMIT 1',
          [salon, estudiante.grado]
        );

        const profesor = clase ? clase.profesor : (appSettings.profesor || 'Prof. Roberto Gómez');
        const horaProgramada = appSettings.hora_entrada || HORA_OFICIAL_ENTRADA;
        const puntualidad = calcularPuntualidad(hora, horaProgramada, appSettings.hora_limite);
        const minutosRetraso = puntualidad.minutosRetraso;

        // Check if attendance already recorded today in this salon
        const asistenciaHoy = queryOne(
          'SELECT id, hora FROM asistencias WHERE estudiante_id = ? AND salon = ? AND fecha = ?',
          [estudiante.id, salon, fecha]
        );

        if (asistenciaHoy) {
          // Already registered today in this salon -> do NOT duplicate
          run(
            `INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [normalizedUid, estudiante.id, salon, asignatura, profesor, horaProgramada, minutosRetraso, 'rfid', 'ya_registrada_hoy', fecha_hora]
          );
          return res.json({
            ok: true,
            estado: 'ya_registrada_hoy',
            nombre: estudiante.nombre,
            codigo: estudiante.codigo,
            grado: estudiante.grado,
            asignatura,
            profesor,
            hora_programada: horaProgramada,
            minutos_retraso: minutosRetraso
          });
        } else {
          // Record attendance
          run(
            `INSERT INTO asistencias (estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, observacion, fecha, hora) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [estudiante.id, salon, asignatura, profesor, horaProgramada, minutosRetraso, 'rfid', 'Escaneo RFID', fecha, hora]
          );
          run(
            `INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [normalizedUid, estudiante.id, salon, asignatura, profesor, horaProgramada, minutosRetraso, 'rfid', 'asistencia_registrada', fecha_hora]
          );

          // Auto-dispatch email notification to guardian in background
          if (estudiante.acudiente_correo) {
            sendGuardianAttendanceEmail({
              estudianteNombre: estudiante.nombre,
              estudianteCodigo: estudiante.codigo || `EST-${estudiante.id}`,
              grado: estudiante.grado,
              salon,
              asignatura,
              profesor,
              fecha,
              hora,
              esTarde: minutosRetraso > 0,
              minutosRetraso,
              acudienteNombre: estudiante.acudiente_nombre || 'Acudiente',
              acudienteCorreo: estudiante.acudiente_correo
            }).catch((e) => console.error('Error auto-dispatching attendance email:', e));
          }

          return res.json({
            ok: true,
            estado: 'asistencia_registrada',
            nombre: estudiante.nombre,
            codigo: estudiante.codigo,
            grado: estudiante.grado,
            asignatura,
            profesor,
            hora_programada: horaProgramada,
            minutos_retraso: minutosRetraso
          });
        }
      } else {
        // Unregistered card
        run(
          'INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, estado, fecha_hora) VALUES (?, NULL, ?, ?, ?, ?)',
          [normalizedUid, salon, asignatura, 'tarjeta_no_registrada', fecha_hora]
        );
        return res.json({
          ok: true,
          estado: 'tarjeta_no_registrada',
          nombre: null
        });
      }
    }

    // MODE 2: REGISTRO (Vincular o cambiar tarjeta directamente con el sensor)
    if (modoInfo.modo === 'registro') {
      // Caso A: Asignación a estudiante específico seleccionado
      if (estudianteObjetivoId) {
        // Verificar si la tarjeta ya está en poder de OTRO estudiante
        const otroEstudiante = queryOne<Estudiante>(
          'SELECT id, nombre, codigo FROM estudiantes WHERE uid = ? AND id != ?',
          [normalizedUid, estudianteObjetivoId]
        );

        if (otroEstudiante) {
          run(
            'INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, estado, fecha_hora) VALUES (?, ?, ?, ?, ?, ?)',
            [normalizedUid, estudianteObjetivoId, salon, asignatura, 'tarjeta_ya_asignada', fecha_hora]
          );
          return res.json({
            ok: false,
            estado: 'tarjeta_ya_asignada',
            error: `La tarjeta ${normalizedUid} ya está asignada a ${otroEstudiante.nombre}`,
            nombre: otroEstudiante.nombre
          });
        }

        // Asociar la nueva tarjeta directamente al estudiante en la base de datos
        run('UPDATE estudiantes SET uid = ? WHERE id = ?', [normalizedUid, estudianteObjetivoId]);
        const estudianteActualizado = queryOne<Estudiante>('SELECT * FROM estudiantes WHERE id = ?', [estudianteObjetivoId]);

        tarjetaPendiente = normalizedUid;
        run(
          'INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, estado, fecha_hora) VALUES (?, ?, ?, ?, ?, ?)',
          [normalizedUid, estudianteObjetivoId, salon, asignatura, 'tarjeta_asignada', fecha_hora]
        );

        console.log(`\n[RFID] 💳 ¡Tarjeta ${normalizedUid} vinculada automáticamente a ${estudianteActualizado?.nombre}!\n`);

        // Regresar inmediatamente al modo asistencia
        currentMode = 'asistencia';
        modoRegistroExpiry = null;
        const targetId = estudianteObjetivoId;
        estudianteObjetivoId = null;

        return res.json({
          ok: true,
          estado: 'tarjeta_asignada',
          uid: normalizedUid,
          estudiante_id: targetId,
          nombre: estudianteActualizado?.nombre
        });
      }

      // Caso B: Captura general para formulario de nuevo estudiante
      if (estudiante) {
        run(
          'INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, estado, fecha_hora) VALUES (?, ?, ?, ?, ?, ?)',
          [normalizedUid, estudiante.id, salon, asignatura, 'tarjeta_ya_asignada', fecha_hora]
        );
        return res.json({
          ok: true,
          estado: 'tarjeta_ya_asignada',
          nombre: estudiante.nombre
        });
      } else {
        tarjetaPendiente = normalizedUid;
        run(
          'INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, estado, fecha_hora) VALUES (?, NULL, ?, ?, ?, ?)',
          [normalizedUid, salon, asignatura, 'tarjeta_capturada', fecha_hora]
        );
        return res.json({
          ok: true,
          estado: 'tarjeta_capturada',
          uid: normalizedUid,
          nombre: null
        });
      }
    }

    return res.status(400).json({ ok: false, estado: 'error' });
  } catch (error) {
    console.error('Error in /api/lectura:', error);
    return res.status(400).json({ ok: false, estado: 'error' });
  }
});

/**
 * GET /api/modo
 * Returns {"modo": "asistencia" | "registro", "segundos_restantes": n, "estudiante_id": n | null}
 */
app.get('/api/modo', (_req: Request, res: Response) => {
  res.json(getModoInfo());
});

/**
 * POST /api/modo/registro
 * Activates registration mode for 60 seconds (optionally targeting a student)
 */
app.post('/api/modo/registro', (req: Request, res: Response) => {
  currentMode = 'registro';
  modoRegistroExpiry = Date.now() + 60 * 1000;
  tarjetaPendiente = null;
  estudianteObjetivoId = req.body?.estudiante_id ? Number(req.body.estudiante_id) : null;
  res.json({
    ok: true,
    modo: 'registro',
    segundos_restantes: 60,
    estudiante_id: estudianteObjetivoId
  });
});

/**
 * POST /api/modo/asistencia
 * Cancels registration mode and returns immediately to attendance mode
 */
app.post('/api/modo/asistencia', (_req: Request, res: Response) => {
  currentMode = 'asistencia';
  modoRegistroExpiry = null;
  tarjetaPendiente = null;
  estudianteObjetivoId = null;
  res.json({
    ok: true,
    modo: 'asistencia',
    segundos_restantes: 0
  });
});

/**
 * GET /api/tarjeta-pendiente
 * Returns {"uid": "..."} or {"uid": null}
 */
app.get('/api/tarjeta-pendiente', (_req: Request, res: Response) => {
  updateModoState();
  res.json({ uid: tarjetaPendiente });
});

/**
 * POST /api/tarjeta-pendiente/limpiar
 * Clears pending card
 */
app.post('/api/tarjeta-pendiente/limpiar', (_req: Request, res: Response) => {
  tarjetaPendiente = null;
  res.json({ ok: true });
});

/**
 * GET /api/ultima-lectura
 * Frontend polls this every ~1.5s
 */
app.get('/api/ultima-lectura', (_req: Request, res: Response) => {
  const row = queryOne(`
    SELECT 
      l.id, 
      l.uid, 
      l.estado, 
      l.salon, 
      COALESCE(l.asignatura, 'Informática y Tecnología') as asignatura,
      COALESCE(l.profesor, 'Prof. Roberto Gómez') as profesor,
      COALESCE(l.hora_programada, '08:30') as hora_programada,
      COALESCE(l.minutos_retraso, 0) as minutos_retraso,
      COALESCE(l.metodo, 'rfid') as metodo,
      l.fecha_hora,
      e.id as estudiante_id,
      e.codigo,
      e.nombre, 
      COALESCE(e.grado, '6° - 1') as grado, 
      e.correo,
      e.acudiente_nombre,
      e.acudiente_contacto,
      e.acudiente_correo,
      e.foto
    FROM lecturas l
    LEFT JOIN estudiantes e ON l.estudiante_id = e.id
    ORDER BY l.id DESC
    LIMIT 1
  `);

  res.json(row || null);
});

/**
 * PUT /api/estudiantes/:id/tarjeta
 * Registers or changes the RFID card assigned to a student
 */
app.put('/api/estudiantes/:id/tarjeta', (req: Request, res: Response): any => {
  try {
    const id = Number(req.params.id);
    const { uid: rawUid } = req.body;
    const uid = normalizeUid(rawUid);

    if (!uid) {
      return res.status(400).json({ ok: false, error: 'Debe ingresar o escanear un UID de tarjeta válido.' });
    }

    // Check if card is already registered to ANOTHER student
    const existing = queryOne<Estudiante>(
      'SELECT id, nombre, codigo FROM estudiantes WHERE uid = ? AND id != ?',
      [uid, id]
    );

    if (existing) {
      return res.status(400).json({
        ok: false,
        error: `La tarjeta ${uid} ya está asignada a otro estudiante: ${existing.nombre} (${existing.codigo || 'ID ' + existing.id}).`
      });
    }

    run('UPDATE estudiantes SET uid = ? WHERE id = ?', [uid, id]);
    const updated = queryOne('SELECT * FROM estudiantes WHERE id = ?', [id]);
    return res.json({ ok: true, mensaje: 'Tarjeta vinculada exitosamente.', estudiante: updated });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/asistencias?fecha=AAAA-MM-DD&salon=...&asignatura=...
 * Returns attendance list for given date, salon and asignatura
 */
app.get('/api/asistencias', (req: Request, res: Response) => {
  const today = getLocalDateTime().fecha;
  const fecha = (req.query.fecha as string) || today;
  const salon = req.query.salon as string;
  const asignatura = req.query.asignatura as string;

  let sql = `
    SELECT 
      a.id,
      a.estudiante_id,
      a.salon,
      COALESCE(a.asignatura, 'Matemáticas') as asignatura,
      COALESCE(a.profesor, 'Prof. Asignado') as profesor,
      COALESCE(a.hora_programada, '07:00') as hora_programada,
      COALESCE(a.minutos_retraso, 0) as minutos_retraso,
      COALESCE(a.metodo, 'rfid') as metodo,
      a.observacion,
      a.fecha,
      a.hora,
      e.codigo,
      e.nombre,
      e.grado,
      e.correo,
      e.acudiente_nombre,
      e.acudiente_contacto,
      e.acudiente_correo,
      e.foto,
      e.uid
    FROM asistencias a
    JOIN estudiantes e ON a.estudiante_id = e.id
    WHERE a.fecha = ?
  `;
  const params: any[] = [fecha];

  if (salon && salon !== 'todos' && salon !== 'Todos') {
    sql += ' AND a.salon = ?';
    params.push(salon);
  }

  if (asignatura && asignatura !== 'todas' && asignatura !== 'Todas') {
    sql += ' AND a.asignatura = ?';
    params.push(asignatura);
  }

  sql += ' ORDER BY a.hora DESC, a.id DESC';

  const rows = queryAll(sql, params);
  res.json(rows);
});

/**
 * POST /api/asistencias/manual
 * Allows a teacher to manually record student attendance if card is lost/forgotten
 */
app.post('/api/asistencias/manual', (req: Request, res: Response): any => {
  try {
    const { estudiante_id, salon, asignatura, observacion, hora: customHora } = req.body;
    if (!estudiante_id || !salon || !asignatura) {
      return res.status(400).json({ ok: false, error: 'Estudiante, salón y asignatura son obligatorios.' });
    }

    const estudiante = queryOne<Estudiante>(
      'SELECT id, codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, foto FROM estudiantes WHERE id = ?',
      [estudiante_id]
    );

    if (!estudiante) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });
    }

    const { fecha, hora: currentHora } = getLocalDateTime();
    const hora = customHora || currentHora;

    // Check if already registered today in this salon
    const asistenciaHoy = queryOne(
      'SELECT id, hora FROM asistencias WHERE estudiante_id = ? AND salon = ? AND fecha = ?',
      [estudiante.id, salon, fecha]
    );

    if (asistenciaHoy) {
      return res.status(400).json({
        ok: false,
        error: `El estudiante ${estudiante.nombre} ya tiene asistencia registrada hoy a las ${asistenciaHoy.hora}.`
      });
    }

    const clase = queryOne<ClaseHorario>(
      'SELECT profesor, hora_ingreso FROM clases WHERE (salon = ? OR grado = ?) AND asignatura = ? LIMIT 1',
      [salon, estudiante.grado, asignatura]
    ) || queryOne<ClaseHorario>(
      'SELECT profesor, hora_ingreso FROM clases WHERE asignatura = ? LIMIT 1',
      [asignatura]
    );

    const profesor = (req.body.profesor && req.body.profesor.trim()) || (clase ? clase.profesor : 'Prof. Autorizado');
    const horaProgramada = clase ? clase.hora_ingreso : '07:00';
    const minutosRetraso = calcularRetraso(hora, horaProgramada);

    const { lastInsertRowid } = run(
      `INSERT INTO asistencias (estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, observacion, fecha, hora) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estudiante.id,
        salon,
        asignatura,
        profesor,
        horaProgramada,
        minutosRetraso,
        'manual',
        observacion || 'Ingreso manual por profesor (sin tarjeta)',
        fecha,
        hora
      ]
    );

    run(
      `INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        estudiante.uid,
        estudiante.id,
        salon,
        asignatura,
        profesor,
        horaProgramada,
        minutosRetraso,
        'manual',
        'asistencia_registrada',
        `${fecha} ${hora}`
      ]
    );

    const nuevaAsistencia = queryOne(`
      SELECT 
        a.id, a.estudiante_id, a.salon, a.asignatura, a.profesor, a.hora_programada,
        a.minutos_retraso, a.metodo, a.observacion, a.fecha, a.hora,
        e.codigo, e.nombre, e.grado, e.correo, e.acudiente_nombre, e.acudiente_contacto, e.acudiente_correo, e.foto, e.uid
      FROM asistencias a
      JOIN estudiantes e ON a.estudiante_id = e.id
      WHERE a.id = ?
    `, [lastInsertRowid]);

    // Auto-dispatch email notification to guardian in background
    if (estudiante.acudiente_correo) {
      sendGuardianAttendanceEmail({
        estudianteNombre: estudiante.nombre,
        estudianteCodigo: estudiante.codigo || `EST-${estudiante.id}`,
        grado: estudiante.grado,
        salon,
        asignatura,
        profesor,
        fecha,
        hora,
        esTarde: minutosRetraso > 0,
        minutosRetraso,
        acudienteNombre: estudiante.acudiente_nombre || 'Acudiente',
        acudienteCorreo: estudiante.acudiente_correo
      }).catch((e) => console.error('Error auto-dispatching manual attendance email:', e));
    }

    return res.json({
      ok: true,
      mensaje: 'Ingreso manual registrado con éxito.',
      asistencia: nuevaAsistencia
    });
  } catch (err: any) {
    console.error('Error in /api/asistencias/manual:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error interno al registrar.' });
  }
});

/**
 * GET /api/clases
 * Returns school class schedules
 */
app.get('/api/clases', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT id, grado, salon, asignatura, profesor, hora_ingreso FROM clases ORDER BY grado, hora_ingreso');
  res.json(rows);
});

/**
 * GET /api/estudiantes/:id/historial
 * Returns full attendance history of a specific student
 */
app.get('/api/estudiantes/:id/historial', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const rows = queryAll(`
    SELECT a.id, a.salon, COALESCE(a.asignatura, 'Matemáticas') as asignatura,
           COALESCE(a.profesor, 'Prof. Asignado') as profesor,
           COALESCE(a.hora_programada, '07:00') as hora_programada,
           COALESCE(a.minutos_retraso, 0) as minutos_retraso,
           COALESCE(a.metodo, 'rfid') as metodo,
           a.observacion,
           a.fecha, a.hora
    FROM asistencias a
    WHERE a.estudiante_id = ?
    ORDER BY a.fecha DESC, a.hora DESC
  `, [id]);
  res.json(rows);
});

/**
 * GET /api/estudiantes
 * Lists all registered students
 */
app.get('/api/estudiantes', (_req: Request, res: Response) => {
  const rows = queryAll(`
    SELECT id, codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto 
    FROM estudiantes 
    ORDER BY nombre ASC
  `);
  res.json(rows);
});

/**
 * POST /api/estudiantes
 * Supports multipart/form-data or json
 */
app.post('/api/estudiantes', upload.single('foto'), (req: Request, res: Response): any => {
  try {
    const rawUid = req.body.uid;
    const nombre = (req.body.nombre || '').trim();
    const grado = (req.body.grado || '').trim();
    const codigo = (req.body.codigo || '').trim();
    const correo = (req.body.correo || '').trim();
    const acudiente_nombre = (req.body.acudiente_nombre || '').trim();
    const acudiente_contacto = (req.body.acudiente_contacto || '').trim();
    const acudiente_correo = (req.body.acudiente_correo || '').trim();
    const uid = normalizeUid(rawUid);

    if (!uid || !nombre || !grado) {
      return res.status(400).json({
        ok: false,
        error: 'UID, nombre y grado son obligatorios.'
      });
    }

    // Check if UID is already in use
    const existing = queryOne('SELECT id, nombre FROM estudiantes WHERE uid = ?', [uid]);
    if (existing) {
      return res.status(400).json({
        ok: false,
        error: `La tarjeta ${uid} ya está asignada al estudiante "${existing.nombre}".`
      });
    }

    let fotoUrl: string | null = null;
    if (req.file) {
      fotoUrl = `/static/fotos/${req.file.filename}`;
    } else if (req.body.foto_base64) {
      fotoUrl = saveBase64Photo(req.body.foto_base64);
    } else if (req.body.foto && typeof req.body.foto === 'string') {
      fotoUrl = req.body.foto;
    }

    const { lastInsertRowid } = run(
      `INSERT INTO estudiantes (codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo || `EST-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        uid,
        nombre,
        grado,
        correo || null,
        acudiente_nombre || null,
        acudiente_contacto || null,
        acudiente_correo || null,
        fotoUrl
      ]
    );

    // Rule: "vuelve SOLO a 'asistencia' después de 60 segundos o cuando se guarda el estudiante"
    currentMode = 'asistencia';
    modoRegistroExpiry = null;
    tarjetaPendiente = null;

    const newStudent = queryOne('SELECT * FROM estudiantes WHERE id = ?', [lastInsertRowid]);

    return res.json({
      ok: true,
      mensaje: 'Estudiante registrado exitosamente.',
      estudiante: newStudent
    });
  } catch (error: any) {
    console.error('Error saving student:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/estudiantes/:id
 * Updates student information
 */
app.put('/api/estudiantes/:id', upload.single('foto'), (req: Request, res: Response): any => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne<Estudiante>('SELECT * FROM estudiantes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });
    }

    const rawUid = req.body.uid;
    const uid = rawUid ? normalizeUid(rawUid) : existing.uid;
    const nombre = req.body.nombre !== undefined ? req.body.nombre.trim() : existing.nombre;
    const grado = req.body.grado !== undefined ? req.body.grado.trim() : existing.grado;
    const codigo = req.body.codigo !== undefined ? req.body.codigo.trim() : existing.codigo;
    const correo = req.body.correo !== undefined ? req.body.correo.trim() : existing.correo;
    const acudiente_nombre = req.body.acudiente_nombre !== undefined ? req.body.acudiente_nombre.trim() : existing.acudiente_nombre;
    const acudiente_contacto = req.body.acudiente_contacto !== undefined ? req.body.acudiente_contacto.trim() : existing.acudiente_contacto;
    const acudiente_correo = req.body.acudiente_correo !== undefined ? req.body.acudiente_correo.trim() : existing.acudiente_correo;

    // Check if new UID is in use by someone else
    if (uid !== existing.uid) {
      const duplicate = queryOne('SELECT id, nombre FROM estudiantes WHERE uid = ? AND id != ?', [
        uid,
        id
      ]);
      if (duplicate) {
        return res.status(400).json({
          ok: false,
          error: `La tarjeta ${uid} ya está asignada al estudiante "${duplicate.nombre}".`
        });
      }
    }

    let fotoUrl = existing.foto;
    if (req.file) {
      fotoUrl = `/static/fotos/${req.file.filename}`;
    } else if (req.body.foto_base64) {
      fotoUrl = saveBase64Photo(req.body.foto_base64);
    } else if (req.body.foto !== undefined) {
      fotoUrl = req.body.foto || null;
    }

    run(
      `UPDATE estudiantes 
       SET codigo = ?, uid = ?, nombre = ?, grado = ?, correo = ?, acudiente_nombre = ?, acudiente_contacto = ?, acudiente_correo = ?, foto = ? 
       WHERE id = ?`,
      [codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, fotoUrl, id]
    );

    // If card was pending, clear
    if (tarjetaPendiente === uid) {
      tarjetaPendiente = null;
    }

    const updated = queryOne('SELECT * FROM estudiantes WHERE id = ?', [id]);
    return res.json({ ok: true, estudiante: updated });
  } catch (error: any) {
    console.error('Error updating student:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * DELETE /api/estudiantes/:id
 * Deletes student and cascade removes their attendances
 */
app.delete('/api/estudiantes/:id', (req: Request, res: Response): any => {
  try {
    const id = Number(req.params.id);
    const existing = queryOne('SELECT id, nombre FROM estudiantes WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Estudiante no encontrado.' });
    }

    run('DELETE FROM asistencias WHERE estudiante_id = ?', [id]);
    run('UPDATE lecturas SET estudiante_id = NULL WHERE estudiante_id = ?', [id]);
    run('DELETE FROM estudiantes WHERE id = ?', [id]);

    return res.json({ ok: true, mensaje: `Estudiante "${existing.nombre}" eliminado.` });
  } catch (error: any) {
    console.error('Error deleting student:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

/**
 * GET /api/salones
 * Returns distinct salons seen in database or standard suggestions
 */
app.get('/api/salones', (_req: Request, res: Response) => {
  const fromAsistencias = queryAll<{ salon: string }>(
    'SELECT DISTINCT salon FROM asistencias WHERE salon IS NOT NULL'
  );
  const fromLecturas = queryAll<{ salon: string }>(
    'SELECT DISTINCT salon FROM lecturas WHERE salon IS NOT NULL'
  );
  const set = new Set<string>(['Salon-101', 'Salon-102', 'Laboratorio', 'Biblioteca', 'Entrada Principal']);
  fromAsistencias.forEach(r => r.salon && set.add(r.salon));
  fromLecturas.forEach(r => r.salon && set.add(r.salon));
  res.json(Array.from(set));
});

/**
 * GET /api/stats
 * Dashboard summary counts
 */
app.get('/api/stats', (_req: Request, res: Response) => {
  const today = getLocalDateTime().fecha;
  const totalEstudiantes = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM estudiantes')?.count || 0;
  const asistenciasHoy = queryOne<{ count: number }>(
    'SELECT COUNT(DISTINCT estudiante_id) as count FROM asistencias WHERE fecha = ?',
    [today]
  )?.count || 0;
  const totalLecturasHoy = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM lecturas WHERE fecha_hora LIKE ?',
    [`${today}%`]
  )?.count || 0;

  res.json({
    totalEstudiantes,
    asistenciasHoy,
    totalLecturasHoy,
    fecha: today
  });
});

/**
 * POST /api/auth/verify
 * Verifies admin password
 */
app.post('/api/auth/verify', (req: Request, res: Response): any => {
  const password = req.body.password;
  const row = queryOne<{ value: string }>('SELECT value FROM config WHERE key = ?', ['admin_password']);
  const actualPassword = row?.value || 'admin123';

  if (password === actualPassword) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Contraseña incorrecta.' });
});

/**
 * POST /api/config/password
 * Changes admin password
 */
app.post('/api/config/password', (req: Request, res: Response): any => {
  const { currentPassword, newPassword } = req.body;
  const row = queryOne<{ value: string }>('SELECT value FROM config WHERE key = ?', ['admin_password']);
  const actualPassword = row?.value || 'admin123';

  if (currentPassword !== actualPassword) {
    return res.status(401).json({ ok: false, error: 'Contraseña actual incorrecta.' });
  }
  if (!newPassword || newPassword.length < 3) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 3 caracteres.' });
  }

  run('UPDATE config SET value = ? WHERE key = ?', [newPassword, 'admin_password']);
  return res.json({ ok: true, mensaje: 'Contraseña actualizada exitosamente.' });
});

/**
 * Helper to build dynamic Arduino .ino firmware
 */
function buildEsp8266InoCode(settings: AppSettings, defaultUrl: string): string {
  let endpoint = settings.esp_endpoint_url || defaultUrl;
  endpoint = endpoint.trim();
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    endpoint = 'https://' + endpoint;
  }
  if (!endpoint.endsWith('/api/lectura') && !endpoint.endsWith('/api/lectura/')) {
    endpoint = endpoint.replace(/\/+$/, '') + '/api/lectura';
  }

  const salon = settings.salon || 'Salón de Informática';
  const ssid = settings.wifi_ssid_default || 'TU_NOMBRE_WIFI';
  const pass = settings.wifi_pass_default || 'TU_CONTRASENA_WIFI';

  return `/*
  ===================================================================
  SISTEMA DE ASISTENCIA ESCOLAR RFID - FIRMWARE ESP8266 + RC522
  Institución: ${settings.nombre_colegio}
  Salón / Punto: ${salon}
  Asignatura: ${settings.asignatura}
  ===================================================================
  
  Placas soportadas: NodeMCU v2/v3, Wemos D1 Mini, ESP8266 ESP-12E
  Lector RFID: RC522 (13.56 MHz Mifare)
  
  Librerías necesarias en Arduino IDE (Gestor de Librerías):
  1. "MFRC522" por GithubCommunity
  2. "ArduinoJson" por Benoit Blanchon (versión 6.x o 7.x)
  3. "ESP8266HTTPClient" y "ESP8266WiFi" (vienen con el paquete ESP8266)

  Conexión de Pines (ESP8266 <-> RC522):
  -------------------------------------------------------------
  RC522 PIN    | ESP8266 NodeMCU | Wemos D1 Mini | Descripción
  -------------------------------------------------------------
  3.3V (VCC)   | 3.3V            | 3.3V          | ¡NUNCA 5V!
  RST (Reset)  | D3 (GPIO 0)     | D3            | Reset
  GND          | GND             | GND           | Tierra
  MISO         | D6 (GPIO 12)    | D6            | SPI MISO
  MOSI         | D7 (GPIO 13)    | D7            | SPI MOSI
  SCK          | D5 (GPIO 14)    | D5            | SPI Clock
  SDA (SS)     | D4 (GPIO 2)     | D4            | SPI Slave Select
  Buzzer (Opt) | D1 (GPIO 5)     | D1            | Sonido confirmación
  LED (Opt)    | D2 (GPIO 4)     | D2            | LED Verde indicador
  -------------------------------------------------------------
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// 1. CONFIGURACIÓN DE RED WI-FI
const char* WIFI_SSID     = "${ssid}";
const char* WIFI_PASSWORD = "${pass}";

// 2. ENDPOINT / URL DE LA PÁGINA WEB O SERVIDOR
// Este endpoint fue configurado en Ajustes de la Aplicación:
const char* SERVER_ENDPOINT = "${endpoint}";
const char* SALON_NAME      = "${salon}";
const char* ASIGNATURA_NAME = "${settings.asignatura}";

// PINES HARDWARE (ESP8266)
#ifndef D0
  #define D0 16
  #define D1 5
  #define D2 4
  #define D3 0
  #define D4 2
  #define D5 14
  #define D6 12
  #define D7 13
  #define D8 15
#endif

#define SS_PIN     D4 // GPIO 2
#define RST_PIN    D3 // GPIO 0
#define BUZZER_PIN D1 // GPIO 5 (Opcional)
#define LED_PIN    D2 // GPIO 4 (Opcional)

MFRC522 rfid(SS_PIN, RST_PIN);
String ultimaTarjetaLeida = "";
unsigned long tiempoUltimaLectura = 0;
const unsigned long COOLDOWN_MS = 2500; // 2.5s entre lecturas de la misma tarjeta

// Declaraciones previas de funciones
void emitirBeep(int duracionMs, int veces = 1);
String extraerHost(String url);
void ejecutarPeticionHttp(HTTPClient &http, String uid);
void enviarLecturaAlServidor(String uid);

void emitirBeep(int duracionMs, int veces) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duracionMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (veces > 1) delay(80);
  }
}

String extraerHost(String url) {
  int inicio = 0;
  if (url.startsWith("https://")) inicio = 8;
  else if (url.startsWith("http://")) inicio = 7;
  int fin = url.indexOf('/', inicio);
  if (fin == -1) fin = url.indexOf(':', inicio);
  if (fin == -1) fin = url.length();
  return url.substring(inicio, fin);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\\n\\n==========================================");
  Serial.println("  SISTEMA DE ASISTENCIA ESCOLAR RFID");
  Serial.println("  Colegio: ${settings.nombre_colegio}");
  Serial.println("==========================================");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Iniciar Bus SPI y Lector RFID RC522
  SPI.begin();
  rfid.PCD_Init();
  delay(100);
  Serial.println("[RFID] Lector MFRC522 inicializado correctamente.");

  // Conectar a Wi-Fi
  Serial.printf("[WIFI] Conectando a %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n[WIFI] ¡Conectado con éxito!");
    Serial.print("[WIFI] IP asignada al ESP8266: ");
    Serial.println(WiFi.localIP());
    Serial.printf("[WIFI] Potencia señal (RSSI): %d dBm\\n", WiFi.RSSI());
    Serial.printf("[ENDPOINT] %s\\n", SERVER_ENDPOINT);
    Serial.printf("[SALON] %s | [ASIGNATURA] %s\\n", SALON_NAME, ASIGNATURA_NAME);

    // Test DNS
    String host = extraerHost(String(SERVER_ENDPOINT));
    IPAddress testIp;
    if (WiFi.hostByName(host.c_str(), testIp)) {
      Serial.printf("[DNS] Dominio resuelto a IP: %s\\n", testIp.toString().c_str());
    } else {
      Serial.println("[DNS] Advertencia: No se pudo resolver el host aún. Verifica salida a internet.");
    }

    emitirBeep(100, 2); // Confirmación sonora de inicio
  } else {
    Serial.println("\\n[WIFI ERROR] No se pudo conectar a la red Wi-Fi.");
    emitirBeep(400, 2);
  }
}

void loop() {
  // Ceder tiempo a tareas Wi-Fi en segundo plano del ESP8266 y evitar Soft Watchdog Reset (WDT)
  yield();
  delay(10);

  // Verificar presencia de tarjeta
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  // Leer y normalizar UID (ej: "8B6FD934")
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  // Filtrar lecturas repetidas continuas de la misma tarjeta
  if (uidString == ultimaTarjetaLeida && (millis() - tiempoUltimaLectura) < COOLDOWN_MS) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  ultimaTarjetaLeida = uidString;
  tiempoUltimaLectura = millis();

  Serial.println("\\n------------------------------------------");
  Serial.print("[LECTURA] Tarjeta RFID detectada UID: ");
  Serial.println(uidString);

  // Enviar lectura por HTTP/HTTPS POST a la página web
  enviarLecturaAlServidor(uidString);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void ejecutarPeticionHttp(HTTPClient &http, String uid) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("User-Agent", "ESP8266-RFID-Attendance/2.0");

  // Construir JSON payload
  String payload = "{\\"uid\\":\\"" + uid + "\\",\\"salon\\":\\"" + String(SALON_NAME) + "\\",\\"asignatura\\":\\"" + String(ASIGNATURA_NAME) + "\\"}";
  Serial.print("[PAYLOAD] ");
  Serial.println(payload);

  unsigned long t0 = millis();
  int httpCode = http.POST(payload);
  unsigned long ms = millis() - t0;

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[HTTP] Código respuesta: %d (%lu ms)\\n", httpCode, ms);
    Serial.print("[HTTP] Respuesta: ");
    Serial.println(response);

    #if defined(ARDUINOJSON_VERSION_MAJOR) && ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
    #else
      StaticJsonDocument<512> doc;
    #endif
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      const char* estado = doc["estado"] | "desconocido";
      const char* nombre = doc["nombre"] | "";
      Serial.printf("[PROCESO] Estado: %s | Alumno: %s\\n", estado, (strlen(nombre) > 0 ? nombre : "N/A"));

      if (strcmp(estado, "asistencia_registrada") == 0) {
        digitalWrite(LED_PIN, HIGH);
        emitirBeep(120, 1);
        delay(250);
        digitalWrite(LED_PIN, LOW);
      } else if (strcmp(estado, "ya_registrada_hoy") == 0) {
        emitirBeep(80, 2);
      } else if (strcmp(estado, "tarjeta_capturada") == 0 || strcmp(estado, "tarjeta_asignada") == 0) {
        emitirBeep(60, 3);
      } else if (strcmp(estado, "tarjeta_no_registrada") == 0) {
        emitirBeep(400, 1);
      }
    }
  } else {
    Serial.printf("[ERROR] Fallo de conexión: %s (código: %d)\\n", http.errorToString(httpCode).c_str(), httpCode);
    Serial.println("Sugerencia: Si usas una página en la nube, verifica que la URL comience con https:// y termine en /api/lectura.");
    emitirBeep(350, 2);
  }
}

void enviarLecturaAlServidor(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] Wi-Fi desconectado. Reconectando...");
    WiFi.reconnect();
    return;
  }

  String endpoint = String(SERVER_ENDPOINT);
  endpoint.trim();
  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    endpoint = "https://" + endpoint;
  }
  if (!endpoint.endsWith("/api/lectura")) {
    endpoint += "/api/lectura";
  }

  bool isHttps = endpoint.startsWith("https://");
  Serial.printf("[CONEXIÓN] Destino: %s (%s)\\n", endpoint.c_str(), isHttps ? "HTTPS SSL/TLS" : "HTTP");

  HTTPClient http;
  http.setTimeout(15000);
  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  http.setReuse(false);

  if (isHttps) {
    WiFiClientSecure client;
    client.setInsecure(); // Acepta conexiones SSL HTTPS en la nube
    client.setBufferSizes(1024, 1024); // Evita error de memoria RAM en ESP8266
    client.setTimeout(12000);
    http.begin(client, endpoint);
    ejecutarPeticionHttp(http, uid);
  } else {
    WiFiClient client;
    client.setTimeout(10000);
    http.begin(client, endpoint);
    ejecutarPeticionHttp(http, uid);
  }

  http.end();
}
`;
}

/**
 * GET /api/app-config
 * Returns current general settings
 */
app.get('/api/app-config', (req: Request, res: Response) => {
  const settings = getAppSettings();
  
  // Detect local IP
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  const hostHeader = req.get('host') || `localhost:${PORT}`;
  const isCloudRun = Boolean(process.env.APP_URL) || req.get('x-forwarded-proto') === 'https';
  const proto = req.get('x-forwarded-proto') || (isCloudRun ? 'https' : req.protocol) || 'http';
  
  let detectedWebUrl = `${proto}://${hostHeader}/api/lectura`;
  if (process.env.APP_URL) {
    const cleanAppUrl = process.env.APP_URL.replace(/\/+$/, '');
    detectedWebUrl = `${cleanAppUrl}/api/lectura`;
  }
  const detectedLanUrl = ips.length > 0 ? `http://${ips[0]}:${PORT}/api/lectura` : detectedWebUrl;

  res.json({
    settings,
    detectedWebUrl,
    detectedLanUrl,
    localIps: ips,
    port: PORT
  });
});

/**
 * POST /api/app-config
 * Updates general application settings
 */
app.post('/api/app-config', (req: Request, res: Response): any => {
  try {
    const updated = updateAppSettings(req.body);
    return res.json({
      ok: true,
      mensaje: 'Configuración general guardada exitosamente.',
      settings: updated
    });
  } catch (err: any) {
    console.error('Error saving app-config:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error guardando ajustes.' });
  }
});

/**
 * POST /api/app-config/logo
 * Uploads a new logo image file
 */
app.post('/api/app-config/logo', logoUpload.single('logo'), (req: Request, res: Response): any => {
  try {
    let logoUrl: string | null = null;
    if (req.file) {
      logoUrl = `/static/logos/${req.file.filename}`;
    } else if (req.body.logo_base64) {
      const matches = req.body.logo_base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `logo_${Date.now()}.png`;
        fs.writeFileSync(path.join(logosDir, filename), buffer);
        logoUrl = `/static/logos/${filename}`;
      }
    } else if (req.body.logo_url) {
      logoUrl = req.body.logo_url;
    }

    if (!logoUrl) {
      return res.status(400).json({ ok: false, error: 'No se recibió ningún archivo o URL de logo válido.' });
    }

    const updated = updateAppSettings({ logo_url: logoUrl });
    return res.json({
      ok: true,
      mensaje: 'Logo institucional actualizado con éxito.',
      logo_url: logoUrl,
      settings: updated
    });
  } catch (err: any) {
    console.error('Error in /api/app-config/logo:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error al procesar el logo.' });
  }
});

/**
 * POST /api/test-endpoint
 * Live tester for custom ESP8266 endpoints
 */
app.post('/api/test-endpoint', async (req: Request, res: Response): Promise<any> => {
  const { endpointUrl, uid, salon, asignatura } = req.body;
  if (!endpointUrl || !endpointUrl.startsWith('http')) {
    return res.status(400).json({ ok: false, error: 'Debes ingresar una URL válida (iniciando con http:// o https://)' });
  }

  const testUid = uid ? normalizeUid(uid) : '8B6FD934';
  const testSalon = salon || 'Salón de Informática';
  const testAsignatura = asignatura || 'Informática y Tecnología';

  const startTime = Date.now();

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: testUid,
        salon: testSalon,
        asignatura: testAsignatura
      })
    });

    const latencyMs = Date.now() - startTime;
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    return res.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      response: data,
      endpointTested: endpointUrl
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return res.json({
      ok: false,
      status: 0,
      statusText: 'Error de Red / Conexión',
      latencyMs,
      error: err.message || 'No se pudo conectar al endpoint especificado.',
      endpointTested: endpointUrl
    });
  }
});

/**
 * GET /api/esp8266/arduino-code
 * Returns customized Arduino code as plain text / json
 */
app.get('/api/esp8266/arduino-code', (req: Request, res: Response) => {
  const settings = getAppSettings();
  const hostHeader = req.get('host') || `localhost:${PORT}`;
  const isCloudRun = Boolean(process.env.APP_URL) || req.get('x-forwarded-proto') === 'https';
  const proto = req.get('x-forwarded-proto') || (isCloudRun ? 'https' : req.protocol) || 'http';
  let defaultUrl = `${proto}://${hostHeader}/api/lectura`;
  if (process.env.APP_URL) {
    defaultUrl = `${process.env.APP_URL.replace(/\/+$/, '')}/api/lectura`;
  }
  const code = buildEsp8266InoCode(settings, defaultUrl);

  if (req.query.format === 'text') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(code);
  }

  return res.json({ code, endpoint: settings.esp_endpoint_url || defaultUrl });
});

/**
 * GET /api/esp8266/download-ino
 * Direct download of .ino file
 */
app.get('/api/esp8266/download-ino', (req: Request, res: Response) => {
  const settings = getAppSettings();
  const hostHeader = req.get('host') || `localhost:${PORT}`;
  const isCloudRun = Boolean(process.env.APP_URL) || req.get('x-forwarded-proto') === 'https';
  const proto = req.get('x-forwarded-proto') || (isCloudRun ? 'https' : req.protocol) || 'http';
  let defaultUrl = `${proto}://${hostHeader}/api/lectura`;
  if (process.env.APP_URL) {
    defaultUrl = `${process.env.APP_URL.replace(/\/+$/, '')}/api/lectura`;
  }
  const code = buildEsp8266InoCode(settings, defaultUrl);

  res.setHeader('Content-Disposition', 'attachment; filename="esp8266_rfid_asistencia.ino"');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.send(code);
});

/**
 * GET /api/email/config
 * Returns current SMTP and notification configuration
 */
app.get('/api/email/config', (_req: Request, res: Response) => {
  const config = queryOne('SELECT * FROM email_config WHERE id = 1');
  if (!config) {
    return res.json({
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_secure: false,
      smtp_user: '',
      smtp_pass: '',
      sender_name: 'Colegio San Nicolás de Tolentino',
      sender_email: 'asistencia@sannicolas.edu.co',
      auto_notify_scan: true,
      notify_on_tardy_only: false,
      configured: false
    });
  }

  return res.json({
    smtp_host: config.smtp_host || 'smtp.gmail.com',
    smtp_port: Number(config.smtp_port) || 587,
    smtp_secure: Number(config.smtp_secure) === 1,
    smtp_user: config.smtp_user || '',
    smtp_pass: config.smtp_pass ? '••••••••' : '',
    has_pass: Boolean(config.smtp_pass),
    sender_name: config.sender_name || 'Colegio San Nicolás de Tolentino',
    sender_email: config.sender_email || '',
    auto_notify_scan: Number(config.auto_notify_scan) === 1,
    notify_on_tardy_only: Number(config.notify_on_tardy_only) === 1,
    configured: Boolean(config.smtp_user && config.smtp_pass)
  });
});

/**
 * POST /api/email/config
 * Updates SMTP and notification settings
 */
app.post('/api/email/config', (req: Request, res: Response): any => {
  try {
    const {
      smtp_host,
      smtp_port,
      smtp_secure,
      smtp_user,
      smtp_pass,
      sender_name,
      sender_email,
      auto_notify_scan,
      notify_on_tardy_only
    } = req.body;

    const existing = queryOne('SELECT smtp_pass FROM email_config WHERE id = 1');
    const finalPass = (smtp_pass && smtp_pass !== '••••••••') ? smtp_pass : (existing ? existing.smtp_pass : '');

    run(
      `INSERT OR REPLACE INTO email_config 
       (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name, sender_email, auto_notify_scan, notify_on_tardy_only)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        (smtp_host || 'smtp.gmail.com').trim(),
        Number(smtp_port) || 587,
        smtp_secure ? 1 : 0,
        (smtp_user || '').trim(),
        finalPass,
        (sender_name || 'Colegio San Nicolás de Tolentino').trim(),
        (sender_email || '').trim(),
        auto_notify_scan ? 1 : 0,
        notify_on_tardy_only ? 1 : 0
      ]
    );

    return res.json({ ok: true, mensaje: 'Configuración de correo guardada con éxito.' });
  } catch (err: any) {
    console.error('Error saving email config:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Error guardando configuración.' });
  }
});

/**
 * POST /api/email/test
 * Tests SMTP credentials by sending a live test email
 */
app.post('/api/email/test', async (req: Request, res: Response): Promise<any> => {
  try {
    const { test_recipient, config } = req.body;
    if (!test_recipient || !test_recipient.includes('@')) {
      return res.status(400).json({ ok: false, error: 'Ingresa un correo destinatario de prueba válido.' });
    }

    const currentConfig = queryOne('SELECT * FROM email_config WHERE id = 1') || {};
    const effectiveConfig = {
      smtp_host: config?.smtp_host || currentConfig.smtp_host || 'smtp.gmail.com',
      smtp_port: Number(config?.smtp_port || currentConfig.smtp_port) || 587,
      smtp_secure: Boolean(config?.smtp_secure !== undefined ? config.smtp_secure : currentConfig.smtp_secure),
      smtp_user: config?.smtp_user || currentConfig.smtp_user || '',
      smtp_pass: (config?.smtp_pass && config.smtp_pass !== '••••••••') ? config.smtp_pass : (currentConfig.smtp_pass || ''),
      sender_name: config?.sender_name || currentConfig.sender_name || 'Colegio San Nicolás de Tolentino',
      sender_email: config?.sender_email || currentConfig.sender_email || ''
    };

    const result = await testSmtpConnection(test_recipient, effectiveConfig);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/email/test:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Error probando servidor SMTP.' });
  }
});

/**
 * GET /api/email/logs
 * Returns recent email notifications dispatch history
 */
app.get('/api/email/logs', (_req: Request, res: Response) => {
  const rows = queryAll('SELECT * FROM email_logs ORDER BY id DESC LIMIT 50');
  res.json(rows);
});

/**
 * POST /api/email/send-manual
 * Manually sends an attendance email for a specific student/attendance
 */
app.post('/api/email/send-manual', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      estudiante_id,
      estudiante_nombre,
      estudiante_codigo,
      grado,
      salon,
      asignatura,
      profesor,
      fecha,
      hora,
      minutos_retraso,
      acudiente_nombre,
      acudiente_correo
    } = req.body;

    let targetStudent: any = null;
    if (estudiante_id) {
      targetStudent = queryOne('SELECT * FROM estudiantes WHERE id = ?', [estudiante_id]);
    }

    const emailToSend = acudiente_correo || targetStudent?.acudiente_correo;
    const guardianName = acudiente_nombre || targetStudent?.acudiente_nombre || 'Acudiente';
    const studentName = estudiante_nombre || targetStudent?.nombre || 'El alumno';
    const studentCode = estudiante_codigo || targetStudent?.codigo || `EST-${estudiante_id}`;
    const studentGrade = grado || targetStudent?.grado || '6° - 1';
    const delay = Number(minutos_retraso) || 0;

    const result = await sendGuardianAttendanceEmail({
      estudianteNombre: studentName,
      estudianteCodigo: studentCode,
      grado: studentGrade,
      salon: salon || 'Salón de Informática',
      asignatura: asignatura || 'Informática y Tecnología',
      profesor: profesor || 'Prof. Roberto Gómez',
      fecha: fecha || getLocalDateTime().fecha,
      hora: hora || getLocalDateTime().hora,
      esTarde: delay > 0,
      minutosRetraso: delay,
      acudienteNombre: guardianName,
      acudienteCorreo: emailToSend
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/email/send-manual:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error despachando correo.' });
  }
});

/**
 * POST /api/email/send-absence-single
 * Sends an absence alert to a specific student's guardian
 */
app.post('/api/email/send-absence-single', async (req: Request, res: Response): Promise<any> => {
  try {
    const { estudiante_id, fecha, hora_limite, salon, asignatura, profesor } = req.body;
    const student = queryOne<Estudiante>('SELECT * FROM estudiantes WHERE id = ?', [estudiante_id]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Estudiante no encontrado.' });
    }

    if (!student.acudiente_correo) {
      return res.status(400).json({ success: false, message: `El estudiante ${student.nombre} no tiene correo de acudiente registrado.` });
    }

    const { fecha: todayDate } = getLocalDateTime();
    const result = await sendGuardianAbsenceEmail({
      estudianteNombre: student.nombre,
      estudianteCodigo: student.codigo || `EST-${student.id}`,
      grado: student.grado || '6° - 1',
      salon: salon || 'Salón de Informática',
      asignatura: asignatura || 'Informática y Tecnología',
      profesor: profesor || 'Prof. Roberto Gómez',
      fecha: fecha || todayDate,
      horaLimite: hora_limite || '08:40 AM',
      acudienteNombre: student.acudiente_nombre || 'Padre / Acudiente',
      acudienteCorreo: student.acudiente_correo
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/email/send-absence-single:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error al enviar alerta de inasistencia.' });
  }
});

/**
 * POST /api/email/notify-absences
 * Sends absence notifications in bulk to all students of 6° - 1 who have NOT registered entry today past tolerance
 */
app.post('/api/email/notify-absences', async (req: Request, res: Response): Promise<any> => {
  try {
    const { fecha: customFecha, hora_limite, salon, asignatura, profesor } = req.body;
    const { fecha: todayDate } = getLocalDateTime();
    const targetFecha = customFecha || todayDate;

    // Get all students in Grade 6° - 1
    const allStudents = queryAll<Estudiante>('SELECT * FROM estudiantes ORDER BY nombre ASC');
    
    // Get all attendances for the given date
    const attendancesToday = queryAll<{ estudiante_id: number }>(
      'SELECT DISTINCT estudiante_id FROM asistencias WHERE fecha = ?',
      [targetFecha]
    );
    const presentIds = new Set(attendancesToday.map(a => a.estudiante_id));

    // Find absent students
    const absentStudents = allStudents.filter(st => !presentIds.has(st.id));

    if (absentStudents.length === 0) {
      return res.json({
        success: true,
        notifiedCount: 0,
        message: '¡Excelente! Todos los estudiantes registrados ya tienen su ingreso confirmado hoy.'
      });
    }

    const results = [];
    let successCount = 0;

    for (const student of absentStudents) {
      if (student.acudiente_correo && student.acudiente_correo.includes('@')) {
        const sendRes = await sendGuardianAbsenceEmail({
          estudianteNombre: student.nombre,
          estudianteCodigo: student.codigo || `EST-${student.id}`,
          grado: student.grado || '6° - 1',
          salon: salon || 'Salón de Informática',
          asignatura: asignatura || 'Informática y Tecnología',
          profesor: profesor || 'Prof. Roberto Gómez',
          fecha: targetFecha,
          horaLimite: hora_limite || '08:40 AM',
          acudienteNombre: student.acudiente_nombre || 'Padre / Acudiente',
          acudienteCorreo: student.acudiente_correo
        });

        if (sendRes.success) {
          successCount++;
        }
        results.push({
          student: student.nombre,
          email: student.acudiente_correo,
          result: sendRes
        });
      } else {
        results.push({
          student: student.nombre,
          email: null,
          result: { success: false, message: 'Sin correo de acudiente registrado' }
        });
      }
    }

    return res.json({
      success: true,
      totalAbsent: absentStudents.length,
      notifiedCount: successCount,
      results,
      message: `Se enviaron alertas de inasistencia a los acudientes de ${successCount} de ${absentStudents.length} estudiantes ausentes.`
    });
  } catch (err: any) {
    console.error('Error in /api/email/notify-absences:', err);
    return res.status(500).json({ success: false, message: err.message || 'Error enviando alertas masivas de inasistencia.' });
  }
});

/**
 * GET /api/network-ips
 * Returns local machine IP addresses to help configure the ESP8266
 */
app.get('/api/network-ips', (_req: Request, res: Response) => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  res.json({
    ips,
    port: PORT,
    sampleEndpoint: ips.length > 0 ? `http://${ips[0]}:${PORT}/api/lectura` : `http://192.168.1.X:${PORT}/api/lectura`
  });
});

// -------------------------------------------------------------
// Vite or Production Static Serving
// -------------------------------------------------------------
async function startServer() {
  await initDatabase();

  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(distPath);

  if ((process.env.NODE_ENV === 'production' || process.env.SERVE_DIST === 'true') && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    try {
      // In dev: mount Vite middlewares
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch (viteError) {
      if (hasDist) {
        console.log('⚠️ Vite en modo dev no disponible. Sirviendo archivos compilados desde dist/.');
        app.use(express.static(distPath));
        app.get('*', (_req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        throw viteError;
      }
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor RFID Asistencia Escolar activo`);
    console.log(`📍 Escuchando en 0.0.0.0:${PORT}`);
    console.log(`🌐 Acceso local: http://localhost:${PORT}`);
    console.log(`📡 Endpoint ESP8266: POST http://<IP_LOCAL>:${PORT}/api/lectura`);
    console.log(`====================================================`);
  });
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
