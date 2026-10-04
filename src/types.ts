export interface DiaHorario {
  dia: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  nombreDia: string; // 'Lunes', 'Martes', etc.
  activo: boolean; // ¿Se dicta clase este día?
  hora_entrada: string; // ej: "08:30"
  minutos_tolerancia: number; // ej: 10
  hora_limite?: string; // calculado "08:40"
}

export interface AppSettings {
  nombre_colegio: string;
  lema_colegio: string;
  logo_url: string;
  grado: string;
  salon: string;
  asignatura: string;
  profesor: string;
  hora_entrada: string; // ej: "08:30" (horario base)
  minutos_tolerancia: number; // ej: 10 (tolerancia base)
  hora_limite?: string; // ej: "08:40"
  esp_endpoint_url: string; // ej: "https://mi-dominio.com/api/lectura"
  wifi_ssid_default?: string;
  wifi_pass_default?: string;
  horarios_semanales?: DiaHorario[]; // Días y horas específicas en la semana
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
  hora_ingreso: string; // ej: "07:00"
}

export interface Asistencia {
  id: number;
  estudiante_id: number;
  codigo?: string | null;
  nombre: string;
  grado: string;
  correo?: string | null;
  acudiente_nombre?: string | null;
  acudiente_contacto?: string | null;
  acudiente_correo?: string | null;
  foto?: string | null;
  uid: string;
  salon: string;
  asignatura?: string | null;
  profesor?: string | null;
  hora_programada?: string | null;
  minutos_retraso?: number;
  metodo?: 'rfid' | 'manual';
  observacion?: string | null;
  fecha: string;
  hora: string;
}

export interface Lectura {
  id: number;
  uid: string;
  estudiante_id?: number | null;
  codigo?: string | null;
  nombre?: string | null;
  grado?: string | null;
  correo?: string | null;
  foto?: string | null;
  acudiente_nombre?: string | null;
  acudiente_contacto?: string | null;
  acudiente_correo?: string | null;
  salon: string;
  asignatura?: string | null;
  profesor?: string | null;
  minutos_retraso?: number;
  metodo?: string;
  estado: 'asistencia_registrada' | 'ya_registrada_hoy' | 'tarjeta_no_registrada' | 'tarjeta_capturada' | 'tarjeta_ya_asignada' | string;
  fecha_hora: string;
}

export interface ModoInfo {
  modo: 'asistencia' | 'registro';
  segundos_restantes: number;
}

export interface SystemStats {
  totalEstudiantes: number;
  asistenciasHoy: number;
  totalLecturasHoy: number;
  fecha: string;
}

export interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  sender_name: string;
  sender_email: string;
  auto_notify_scan: boolean;
  notify_on_tardy_only: boolean;
  configured?: boolean;
}

export interface EmailLog {
  id: number;
  estudiante_nombre: string;
  acudiente_correo: string;
  asunto: string;
  estado: 'enviado' | 'fallido' | 'simulado';
  fecha_hora: string;
  detalles?: string;
}
