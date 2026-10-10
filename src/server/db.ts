import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Client } = pg;

let db: Database;
const DB_PATH = path.join(process.cwd(), 'asistencia.db');

async function loadFromPostgres(): Promise<Buffer | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('[PG Sync] DATABASE_URL no encontrada. Se usará el almacenamiento local únicamente.');
    return null;
  }
  
  console.log('[PG Sync] Conexión DATABASE_URL detectada. Sincronizando copia de seguridad en la nube...');
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sqlite_backup (
        id INT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    const res = await client.query('SELECT data FROM sqlite_backup WHERE id = 1');
    if (res.rows.length > 0) {
      const base64Data = res.rows[0].data;
      console.log('[PG Sync] Copia de seguridad encontrada en la nube, tamaño:', base64Data.length, 'caracteres.');
      return Buffer.from(base64Data, 'base64');
    } else {
      console.log('[PG Sync] No se encontró copia de seguridad previa en la nube (instalación nueva).');
    }
  } catch (err) {
    console.error('[PG Sync] Error al descargar base de datos de Postgres:', err);
  } finally {
    try { await client.end(); } catch (e) {}
  }
  return null;
}

let isSavingToPg = false;
let pendingSaveToPg = false;

async function saveToPostgresAsync(buffer: Buffer) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;
  
  if (isSavingToPg) {
    pendingSaveToPg = true;
    return;
  }
  
  isSavingToPg = true;
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    const base64Data = buffer.toString('base64');
    
    await client.query(`
      INSERT INTO sqlite_backup (id, data, updated_at)
      VALUES (1, $1, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;
    `, [base64Data]);
    
    console.log('[PG Sync] Base de datos guardada y respaldada exitosamente en la nube (Postgres).');
  } catch (err) {
    console.error('[PG Sync] Error al subir copia de seguridad a Postgres:', err);
  } finally {
    try { await client.end(); } catch (e) {}
    isSavingToPg = false;
    if (pendingSaveToPg) {
      pendingSaveToPg = false;
      try {
        if (fs.existsSync(DB_PATH)) {
          const freshBuffer = fs.readFileSync(DB_PATH);
          saveToPostgresAsync(freshBuffer);
        }
      } catch (e) {}
    }
  }
}

export const HORA_OFICIAL_ENTRADA = '08:30';
export const HORA_LIMITE_PUNTUALIDAD = '08:40';
export const GRADO_OFICIAL = '6° - 1';
export const SALON_OFICIAL = 'Salón de Informática';
export const ASIGNATURA_OFICIAL = 'Informática y Tecnología';

export interface DiaHorario {
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  nombreDia: string;
  activo: boolean;
  hora_entrada: string;
  minutos_tolerancia: number;
  hora_limite?: string;
  hora_finalizacion?: string;
}

export const HORARIOS_SEMANALES_DEFAULT: DiaHorario[] = [
  { dia: 'lunes', nombreDia: 'Lunes', activo: true, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' },
  { dia: 'martes', nombreDia: 'Martes', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' },
  { dia: 'miercoles', nombreDia: 'Miércoles', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' },
  { dia: 'jueves', nombreDia: 'Jueves', activo: true, hora_entrada: '10:00', minutos_tolerancia: 10, hora_limite: '10:10', hora_finalizacion: '14:00' },
  { dia: 'viernes', nombreDia: 'Viernes', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' },
  { dia: 'sabado', nombreDia: 'Sábado', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' },
  { dia: 'domingo', nombreDia: 'Domingo', activo: false, hora_entrada: '08:30', minutos_tolerancia: 10, hora_limite: '08:40', hora_finalizacion: '14:00' }
];

export interface AppSettings {
  nombre_colegio: string;
  lema_colegio: string;
  logo_url: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  hora_entrada: string;
  minutos_tolerancia: number;
  hora_limite?: string;
  esp_endpoint_url: string;
  wifi_ssid_default?: string;
  wifi_pass_default?: string;
  horarios_semanales?: DiaHorario[];
  hora_finalizacion?: string;
}

export interface Estudiante {
  id: number;
  codigo?: string | null;
  uid: string;
  nombre: string;
  grado: string;
  correo?: string | null;
  acudiente_nombre?: string | null;
  acudiente_contacto?: string | null;
  acudiente_correo?: string | null;
  foto?: string | null;
}

export interface ClaseHorario {
  id?: number;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  hora_ingreso: string;
}

export interface Asistencia {
  id: number;
  estudiante_id: number;
  codigo?: string | null;
  nombre?: string;
  grado?: string;
  correo?: string | null;
  acudiente_nombre?: string | null;
  acudiente_contacto?: string | null;
  acudiente_correo?: string | null;
  foto?: string | null;
  uid?: string;
  salon: string;
  asignatura?: string | null;
  profesor?: string | null;
  hora_programada?: string | null;
  minutos_retraso?: number;
  metodo?: 'rfid' | 'manual';
  observacion?: string | null;
  fecha: string;
  hora: string;
  hora_salida?: string | null;
}

export interface Lectura {
  id: number;
  uid: string;
  estudiante_id?: number | null;
  codigo?: string | null;
  nombre?: string | null;
  grado?: string | null;
  correo?: string | null;
  acudiente_nombre?: string | null;
  acudiente_contacto?: string | null;
  acudiente_correo?: string | null;
  foto?: string | null;
  salon: string;
  asignatura?: string | null;
  profesor?: string | null;
  hora_programada?: string | null;
  minutos_retraso?: number;
  metodo?: string;
  estado: string;
  fecha_hora: string;
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  // Descargar base de datos más reciente de Postgres cloud si existe
  try {
    const pgBackup = await loadFromPostgres();
    if (pgBackup) {
      fs.writeFileSync(DB_PATH, pgBackup);
      console.log('[PG Sync] Restaurado local db desde copia de seguridad de Postgres en la nube.');
    }
  } catch (err) {
    console.error('[PG Sync] Error al guardar el backup descargado de Postgres:', err);
  }

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error loading asistencia.db, creating new database:', err);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  // Schema creation
  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      nombre_colegio TEXT DEFAULT 'I.E. SAN NICOLÁS DE TOLENTINO',
      lema_colegio TEXT DEFAULT 'Interioridad • Amor • Trascendencia',
      logo_url TEXT DEFAULT '/static/logo.svg',
      grado TEXT DEFAULT '6° - 1',
      salon TEXT DEFAULT 'Salón de Informática',
      asignatura TEXT DEFAULT 'Informática y Tecnología',
      profesor TEXT DEFAULT 'Prof. Roberto Gómez',
      hora_entrada TEXT DEFAULT '08:30',
      minutos_tolerancia INTEGER DEFAULT 10,
      esp_endpoint_url TEXT DEFAULT '',
      wifi_ssid_default TEXT DEFAULT 'TU_NOMBRE_WIFI',
      wifi_pass_default TEXT DEFAULT 'TU_CONTRASENA_WIFI',
      horario_semanal TEXT,
      hora_finalizacion TEXT DEFAULT '14:00'
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS estudiantes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT,
      uid TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      grado TEXT NOT NULL DEFAULT '6° - 1',
      correo TEXT,
      acudiente_nombre TEXT,
      acudiente_contacto TEXT,
      acudiente_correo TEXT,
      foto TEXT
    );

    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      smtp_host TEXT DEFAULT 'smtp.gmail.com',
      smtp_port INTEGER DEFAULT 587,
      smtp_secure INTEGER DEFAULT 0,
      smtp_user TEXT DEFAULT '',
      smtp_pass TEXT DEFAULT '',
      sender_name TEXT DEFAULT 'Colegio San Nicolás de Tolentino',
      sender_email TEXT DEFAULT '',
      auto_notify_scan INTEGER DEFAULT 1,
      notify_on_tardy_only INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_nombre TEXT NOT NULL,
      acudiente_correo TEXT NOT NULL,
      asunto TEXT NOT NULL,
      estado TEXT NOT NULL,
      fecha_hora TEXT NOT NULL,
      detalles TEXT
    );

    CREATE TABLE IF NOT EXISTS clases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grado TEXT NOT NULL,
      salon TEXT NOT NULL,
      asignatura TEXT NOT NULL,
      profesor TEXT NOT NULL,
      hora_ingreso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estudiante_id INTEGER NOT NULL,
      salon TEXT NOT NULL,
      asignatura TEXT,
      profesor TEXT,
      hora_programada TEXT,
      minutos_retraso INTEGER DEFAULT 0,
      metodo TEXT DEFAULT 'rfid',
      observacion TEXT,
      fecha TEXT NOT NULL,
      hora TEXT NOT NULL,
      hora_salida TEXT,
      FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    );

    CREATE TABLE IF NOT EXISTS lecturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      estudiante_id INTEGER,
      salon TEXT NOT NULL,
      asignatura TEXT,
      profesor TEXT,
      hora_programada TEXT,
      minutos_retraso INTEGER DEFAULT 0,
      metodo TEXT DEFAULT 'rfid',
      estado TEXT NOT NULL,
      fecha_hora TEXT NOT NULL
    );
  `);

  // Safe migrations
  try { db.run("ALTER TABLE estudiantes ADD COLUMN codigo TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE estudiantes ADD COLUMN correo TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE estudiantes ADD COLUMN acudiente_nombre TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE estudiantes ADD COLUMN acudiente_contacto TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE estudiantes ADD COLUMN acudiente_correo TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN asignatura TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN profesor TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN hora_programada TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN minutos_retraso INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN metodo TEXT DEFAULT 'rfid';"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN observacion TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE lecturas ADD COLUMN asignatura TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE lecturas ADD COLUMN profesor TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE lecturas ADD COLUMN hora_programada TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE lecturas ADD COLUMN minutos_retraso INTEGER DEFAULT 0;"); } catch (e) {}
  try { db.run("ALTER TABLE lecturas ADD COLUMN metodo TEXT DEFAULT 'rfid';"); } catch (e) {}
  try { db.run("ALTER TABLE app_settings ADD COLUMN horario_semanal TEXT;"); } catch (e) {}
  try { db.run("ALTER TABLE app_settings ADD COLUMN hora_finalizacion TEXT DEFAULT '14:00';"); } catch (e) {}
  try { db.run("ALTER TABLE asistencias ADD COLUMN hora_salida TEXT;"); } catch (e) {}

  // Populate sample guardian emails if null
  try {
    db.run("UPDATE estudiantes SET acudiente_correo = 'patricia.reyes.mendoza@gmail.com' WHERE id = 1 AND (acudiente_correo IS NULL OR acudiente_correo = '');");
    db.run("UPDATE estudiantes SET acudiente_correo = 'roberto.mendoza.soler@gmail.com' WHERE id = 2 AND (acudiente_correo IS NULL OR acudiente_correo = '');");
    db.run("UPDATE estudiantes SET acudiente_correo = 'elena.pena.vargas@gmail.com' WHERE id = 3 AND (acudiente_correo IS NULL OR acudiente_correo = '');");
    db.run("UPDATE estudiantes SET acudiente_correo = 'jorge.silva.duarte@gmail.com' WHERE id = 4 AND (acudiente_correo IS NULL OR acudiente_correo = '');");
    db.run("UPDATE estudiantes SET acudiente_correo = 'carmen.castillo.romero@gmail.com' WHERE id = 5 AND (acudiente_correo IS NULL OR acudiente_correo = '');");
  } catch (e) {}

  // Initialize email config table if empty or migrate from legacy demo
  try {
    const emailCfg = queryOne('SELECT id, smtp_user, smtp_pass FROM email_config WHERE id = 1');
    if (!emailCfg) {
      run(`INSERT INTO email_config (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name, sender_email, auto_notify_scan, notify_on_tardy_only)
           VALUES (1, 'smtp.gmail.com', 587, 0, 'nadinsonramos@gmail.com', 'ebqfongfsfktuxyn', 'I.E. San Nicolás de Tolentino', 'nadinsonramos@gmail.com', 1, 0)`);
    } else if (!emailCfg.smtp_user || emailCfg.smtp_user.includes('sannicolas') || !emailCfg.smtp_pass || emailCfg.smtp_pass.includes('demo')) {
      run(`UPDATE email_config SET 
           smtp_user = 'nadinsonramos@gmail.com',
           smtp_pass = 'ebqfongfsfktuxyn',
           sender_name = 'I.E. San Nicolás de Tolentino',
           sender_email = 'nadinsonramos@gmail.com'
           WHERE id = 1`);
    }
  } catch (e) {}

  // Initialize app settings table if empty
  try {
    const settingsRow = queryOne('SELECT id FROM app_settings WHERE id = 1');
    if (!settingsRow) {
      run(`INSERT INTO app_settings (id, nombre_colegio, lema_colegio, logo_url, grado, salon, asignatura, profesor, hora_entrada, minutos_tolerancia, esp_endpoint_url, wifi_ssid_default, wifi_pass_default)
           VALUES (1, 'I.E. SAN NICOLÁS DE TOLENTINO', 'Interioridad • Amor • Trascendencia', '/static/logo.svg', '6° - 1', 'Salón de Informática', 'Informática y Tecnología', 'Prof. Roberto Gómez', '08:30', 10, '', 'TU_NOMBRE_WIFI', 'TU_CONTRASENA_WIFI')`);
    }
  } catch (e) {}

  // Update existing students to grade 6° - 1 if desired
  try {
    db.run("UPDATE estudiantes SET grado = '6° - 1' WHERE grado != '6° - 1';");
  } catch (e) {}

  // Ensure default class schedule for 6° - 1 in Salón de Informática
  const defaultClass = queryOne('SELECT id FROM clases WHERE grado = ? AND salon = ?', [GRADO_OFICIAL, SALON_OFICIAL]);
  if (!defaultClass) {
    run(
      'INSERT INTO clases (grado, salon, asignatura, profesor, hora_ingreso) VALUES (?, ?, ?, ?, ?)',
      [GRADO_OFICIAL, SALON_OFICIAL, ASIGNATURA_OFICIAL, 'Prof. Roberto Gómez', HORA_OFICIAL_ENTRADA]
    );
  }

  // Asegurar las 8 estudiantes oficiales sin borrar registros ni fotos existentes
  try {
    const defaultStudents = [
      {
        uid: 'B4C91305',
        codigo: 'EST-601-001',
        nombre: 'Victoria Santiago Morron',
        grado: '6° - 1',
        correo: 'victoria.santiago@sannicolas.edu.co',
        acudiente_nombre: 'Marla Morron',
        acudiente_contacto: '3135710894',
        acudiente_correo: 'Marlamorron2018@gmail.com'
      },
      {
        uid: 'D9E04A07',
        codigo: 'EST-601-002',
        nombre: 'Evangelyn Blanco Gonzalez',
        grado: '6° - 1',
        correo: 'evangelyn.blanco@sannicolas.edu.co',
        acudiente_nombre: 'Katherine Gonzalez',
        acudiente_contacto: '3043894541',
        acudiente_correo: 'kate.30.gonzalezbarreto@gmail.com'
      },
      {
        uid: 'D3AD4B07',
        codigo: 'EST-601-003',
        nombre: 'Shadia Hernandez Martinez',
        grado: '6° - 1',
        correo: 'shadia.hernandez@sannicolas.edu.co',
        acudiente_nombre: 'ARILEDYS MARTINEZ HERNANDEZ',
        acudiente_contacto: '3013012510',
        acudiente_correo: 'ariledysmartinez@hotmail.com'
      },
      {
        uid: 'A39A4B07',
        codigo: 'EST-601-004',
        nombre: 'Angelina Hernández Hernández',
        grado: '6° - 1',
        correo: 'angelina.hernandez@sannicolas.edu.co',
        acudiente_nombre: 'Fairuth Hernandez Correa',
        acudiente_contacto: '3154261103',
        acudiente_correo: 'fairuthhernandez8@gmail.com'
      },
      {
        uid: '3C2E4807',
        codigo: 'EST-601-005',
        nombre: 'Ángeles Herrera Rodelo',
        grado: '6° - 1',
        correo: 'angeles.herrera@sannicolas.edu.co',
        acudiente_nombre: 'Luz Rodelo',
        acudiente_contacto: '3217208933',
        acudiente_correo: 'Luzmerylu@gmail.com'
      },
      {
        uid: 'F4244B07',
        codigo: 'EST-601-006',
        nombre: 'Isabel Acevedo Martínez',
        grado: '6° - 1',
        correo: 'isabel.acevedo@sannicolas.edu.co',
        acudiente_nombre: 'María Camila Serje Maury',
        acudiente_contacto: '3014878651',
        acudiente_correo: 'serjemaurycamila@gmail.com'
      },
      {
        uid: 'B5554B07',
        codigo: 'EST-601-007',
        nombre: 'Luna shairet polo bolivar',
        grado: '6° - 1',
        correo: 'luna.polo@sannicolas.edu.co',
        acudiente_nombre: 'Kandy Patricia bolivar Fajardo',
        acudiente_contacto: '3015956179',
        acudiente_correo: 'kandy0612@hotmail.com'
      },
      {
        uid: 'AC9B4B07',
        codigo: 'EST-601-008',
        nombre: 'Maria José Hernández Valest',
        grado: '6° - 1',
        correo: 'maria.hernandez@sannicolas.edu.co',
        acudiente_nombre: 'Lenny Valest',
        acudiente_contacto: '3188335000',
        acudiente_correo: 'lennyvalest@gmail.com'
      }
    ];

    let inserted = 0;
    for (const est of defaultStudents) {
      const existing = queryOne('SELECT id FROM estudiantes WHERE uid = ?', [est.uid]);
      if (!existing) {
        run(
          `INSERT INTO estudiantes (codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [est.codigo, est.uid, est.nombre, est.grado, est.correo, est.acudiente_nombre, est.acudiente_contacto, est.acudiente_correo]
        );
        inserted++;
      }
    }
    if (inserted > 0) {
      console.log(`[Migration] Insertadas ${inserted} estudiantes que faltaban sin tocar las existentes.`);
      saveDb();
    }
  } catch (err) {
    console.error('Error al verificar estudiantes:', err);
  }

  return db;
}

export function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    // Realizar copia de seguridad asíncrona en la nube de Postgres de fondo
    saveToPostgresAsync(buffer).catch(err => {
      console.error('[PG Sync] Error en el guardado asíncrono en la nube:', err);
    });
  } catch (err) {
    console.error('Error saving database to file:', err);
  }
}

export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!db) throw new Error('Database not initialized');
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const all = queryAll<T>(sql, params);
  return all.length > 0 ? all[0] : null;
}

export function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  
  const row = queryOne('SELECT last_insert_rowid() as id');
  const lastInsertRowid = row ? Number(row.id) : 0;
  
  saveDb();
  return { changes: 1, lastInsertRowid };
}

export function normalizeUid(rawUid: string | null | undefined): string {
  if (!rawUid) return '';
  return rawUid.toString().replace(/[:\s]/g, '').trim().toUpperCase();
}

export function getLocalDateTime() {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const fecha_hora = `${fecha} ${hora}`;
  return { fecha, hora, fecha_hora };
}

/**
 * Regla de Asistencia y Puntualidad Dinámica:
 * Utiliza los ajustes guardados de hora oficial de entrada, minutos de tolerancia
 * y el horario semanal día por día.
 */
export function getDiaSemana(fechaStr?: string): 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo' {
  let d: Date;
  if (fechaStr && typeof fechaStr === 'string' && fechaStr.includes('-')) {
    const [year, month, day] = fechaStr.split('-').map(Number);
    d = new Date(year, month - 1, day, 12, 0, 0);
  } else {
    d = new Date();
  }
  const dayIndex = d.getDay(); // 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles, 4 = Jueves, 5 = Viernes, 6 = Sábado
  const diasMap: ('domingo' | 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado')[] = [
    'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'
  ];
  return diasMap[dayIndex] || 'lunes';
}

export function getAppSettings(): AppSettings {
  const row = queryOne<any>('SELECT * FROM app_settings WHERE id = 1');
  const defaults: AppSettings = {
    nombre_colegio: 'I.E. SAN NICOLÁS DE TOLENTINO',
    lema_colegio: 'Interioridad • Amor • Trascendencia',
    logo_url: '/static/logo.svg',
    grado: '6° - 1',
    salon: 'Salón de Informática',
    asignatura: 'Informática y Tecnología',
    profesor: 'Prof. Roberto Gómez',
    hora_entrada: '08:30',
    minutos_tolerancia: 10,
    esp_endpoint_url: '',
    wifi_ssid_default: 'TU_NOMBRE_WIFI',
    wifi_pass_default: 'TU_CONTRASENA_WIFI',
    horarios_semanales: HORARIOS_SEMANALES_DEFAULT,
    hora_finalizacion: '14:00'
  };

  const current: AppSettings = row ? {
    nombre_colegio: row.nombre_colegio || defaults.nombre_colegio,
    lema_colegio: row.lema_colegio || defaults.lema_colegio,
    logo_url: row.logo_url || defaults.logo_url,
    grado: row.grado || defaults.grado,
    salon: row.salon || defaults.salon,
    asignatura: row.asignatura || defaults.asignatura,
    profesor: row.profesor || defaults.profesor,
    hora_entrada: row.hora_entrada || defaults.hora_entrada,
    minutos_tolerancia: Number(row.minutos_tolerancia) || defaults.minutos_tolerancia,
    esp_endpoint_url: row.esp_endpoint_url || '',
    wifi_ssid_default: row.wifi_ssid_default || defaults.wifi_ssid_default,
    wifi_pass_default: row.wifi_pass_default || defaults.wifi_pass_default,
    hora_finalizacion: row.hora_finalizacion || defaults.hora_finalizacion
  } : defaults;

  // Parse or initialize weekly schedule
  let parsedHorarios: DiaHorario[] = [...HORARIOS_SEMANALES_DEFAULT];
  if (row?.horario_semanal) {
    try {
      const dbHorarios = JSON.parse(row.horario_semanal);
      if (Array.isArray(dbHorarios) && dbHorarios.length > 0) {
        parsedHorarios = HORARIOS_SEMANALES_DEFAULT.map(def => {
          const match = dbHorarios.find((h: any) => h.dia === def.dia);
          if (!match) return def;
          const hEntrada = match.hora_entrada || def.hora_entrada;
          const hFinalizacion = match.hora_finalizacion || def.hora_finalizacion || '14:00';
          const tol = match.minutos_tolerancia !== undefined ? Number(match.minutos_tolerancia) : def.minutos_tolerancia;
          
          let lim = match.hora_limite;
          try {
            const [h, m] = hEntrada.split(':').map(Number);
            const total = h * 60 + m + tol;
            const limH = Math.floor(total / 60) % 24;
            const limM = total % 60;
            const pad = (n: number) => n.toString().padStart(2, '0');
            lim = `${pad(limH)}:${pad(limM)}`;
          } catch {}

          return {
            dia: def.dia,
            nombreDia: def.nombreDia,
            activo: Boolean(match.activo),
            hora_entrada: hEntrada,
            minutos_tolerancia: tol,
            hora_limite: lim,
            hora_finalizacion: hFinalizacion
          };
        });
      }
    } catch (e) {
      console.error('Error parsing horario_semanal from db:', e);
    }
  }

  current.horarios_semanales = parsedHorarios;

  // Base hora_limite based on hora_entrada + minutos_tolerancia
  const horaEntrada = current.hora_entrada || '08:30';
  const tolerancia = Number(current.minutos_tolerancia) || 10;
  try {
    const [h, m] = horaEntrada.split(':').map(Number);
    const totalMin = h * 60 + m + tolerancia;
    const limH = Math.floor(totalMin / 60) % 24;
    const limM = totalMin % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    current.hora_limite = `${pad(limH)}:${pad(limM)}`;
  } catch {
    current.hora_limite = '08:40';
  }

  return current;
}

export function getHorarioDia(fechaStr?: string, settings?: AppSettings): DiaHorario {
  const s = settings || getAppSettings();
  const diaKey = getDiaSemana(fechaStr);
  const horarios = s.horarios_semanales || HORARIOS_SEMANALES_DEFAULT;
  const match = horarios.find(h => h.dia === diaKey);
  if (match) return match;

  return {
    dia: diaKey,
    nombreDia: diaKey.charAt(0).toUpperCase() + diaKey.slice(1),
    activo: true,
    hora_entrada: s.hora_entrada || '08:30',
    minutos_tolerancia: s.minutos_tolerancia || 10,
    hora_limite: s.hora_limite || '08:40',
    hora_finalizacion: s.hora_finalizacion || '14:00'
  };
}

export function updateAppSettings(settings: Partial<AppSettings>) {
  const current = getAppSettings();
  
  let horarioSemanalJson: string | null = null;
  if (settings.horarios_semanales && Array.isArray(settings.horarios_semanales)) {
    horarioSemanalJson = JSON.stringify(settings.horarios_semanales);
  } else if (current.horarios_semanales) {
    horarioSemanalJson = JSON.stringify(current.horarios_semanales);
  }

  const updated: AppSettings = {
    nombre_colegio: (settings.nombre_colegio !== undefined ? settings.nombre_colegio : current.nombre_colegio).trim(),
    lema_colegio: (settings.lema_colegio !== undefined ? settings.lema_colegio : current.lema_colegio).trim(),
    logo_url: (settings.logo_url !== undefined ? settings.logo_url : current.logo_url).trim(),
    grado: (settings.grado !== undefined ? settings.grado : current.grado).trim(),
    salon: (settings.salon !== undefined ? settings.salon : current.salon).trim(),
    asignatura: (settings.asignatura !== undefined ? settings.asignatura : current.asignatura).trim(),
    profesor: (settings.profesor !== undefined ? settings.profesor : current.profesor).trim(),
    hora_entrada: (settings.hora_entrada !== undefined ? settings.hora_entrada : current.hora_entrada).trim(),
    minutos_tolerancia: settings.minutos_tolerancia !== undefined ? Number(settings.minutos_tolerancia) : current.minutos_tolerancia,
    esp_endpoint_url: (settings.esp_endpoint_url !== undefined ? settings.esp_endpoint_url : current.esp_endpoint_url).trim(),
    wifi_ssid_default: (settings.wifi_ssid_default !== undefined ? settings.wifi_ssid_default : current.wifi_ssid_default || 'TU_NOMBRE_WIFI').trim(),
    wifi_pass_default: (settings.wifi_pass_default !== undefined ? settings.wifi_pass_default : current.wifi_pass_default || 'TU_CONTRASENA_WIFI').trim(),
    horarios_semanales: settings.horarios_semanales || current.horarios_semanales,
    hora_finalizacion: (settings.hora_finalizacion !== undefined ? settings.hora_finalizacion : current.hora_finalizacion || '14:00').trim()
  };

  run(
    `INSERT OR REPLACE INTO app_settings (
      id, nombre_colegio, lema_colegio, logo_url, grado, salon, asignatura, profesor,
      hora_entrada, minutos_tolerancia, esp_endpoint_url, wifi_ssid_default, wifi_pass_default, horario_semanal, hora_finalizacion
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      updated.nombre_colegio,
      updated.lema_colegio,
      updated.logo_url,
      updated.grado,
      updated.salon,
      updated.asignatura,
      updated.profesor,
      updated.hora_entrada,
      updated.minutos_tolerancia,
      updated.esp_endpoint_url,
      updated.wifi_ssid_default,
      updated.wifi_pass_default,
      horarioSemanalJson,
      updated.hora_finalizacion
    ]
  );

  return getAppSettings();
}

/**
 * Regla de Puntualidad y Retraso Semanal:
 * Evalúa el horario específico del día correspondiente o el horario configurado
 * 
 * @param horaLlegada ej: "08:35:12" o "08:45:00"
 * @param horaOficial hora de entrada programada para este escaneo
 * @param horaLimite hora límite tras la cual se considera tarde
 * @param fechaStr fecha del evento (AAAA-MM-DD) para obtener el día de la semana
 * @returns { esTarde: boolean, minutosRetraso: number, estado: 'Puntual' | 'Tarde', hayClaseHoy: boolean, diaNombre: string }
 */
export function calcularPuntualidad(
  horaLlegada: string, 
  horaOficial?: string, 
  horaLimite?: string,
  fechaStr?: string
) {
  if (!horaLlegada) return { esTarde: false, minutosRetraso: 0, estado: 'Puntual', hayClaseHoy: true, diaNombre: '' };
  
  const settings = getAppSettings();
  const diaHorario = getHorarioDia(fechaStr, settings);

  // If called without specific override and today is marked as NOT a class day:
  if (!horaOficial && !diaHorario.activo) {
    return {
      esTarde: false,
      minutosRetraso: 0,
      estado: 'Puntual',
      hayClaseHoy: false,
      diaNombre: diaHorario.nombreDia
    };
  }

  const effectiveHoraOficial = horaOficial || (diaHorario.activo ? diaHorario.hora_entrada : settings.hora_entrada) || HORA_OFICIAL_ENTRADA;
  const effectiveHoraLimite = horaLimite || (diaHorario.activo ? diaHorario.hora_limite : settings.hora_limite) || HORA_LIMITE_PUNTUALIDAD;

  try {
    const [hl, ml, sl = 0] = horaLlegada.split(':').map(Number);
    const [ho, mo] = effectiveHoraOficial.split(':').map(Number);
    const [hx, mx] = effectiveHoraLimite.split(':').map(Number);

    const segsLlegada = hl * 3600 + ml * 60 + sl;
    const segsOficial = ho * 3600 + mo * 60;
    const segsLimite = hx * 3600 + mx * 60;

    // Si llega a la hora límite o antes -> PUNTUAL
    if (segsLlegada <= segsLimite) {
      return { esTarde: false, minutosRetraso: 0, estado: 'Puntual', hayClaseHoy: diaHorario.activo, diaNombre: diaHorario.nombreDia };
    } else {
      // Después de la tolerancia -> TARDE (retraso desde la hora oficial de entrada)
      const minutosRetraso = Math.max(1, Math.ceil((segsLlegada - segsOficial) / 60));
      return { esTarde: true, minutosRetraso, estado: 'Tarde', hayClaseHoy: diaHorario.activo, diaNombre: diaHorario.nombreDia };
    }
  } catch {
    return { esTarde: false, minutosRetraso: 0, estado: 'Puntual', hayClaseHoy: diaHorario.activo, diaNombre: diaHorario.nombreDia };
  }
}

export function calcularRetraso(horaLlegada: string, horaProgramada: string): number {
  return calcularPuntualidad(horaLlegada, horaProgramada).minutosRetraso;
}

