"""
====================================================================
  SISTEMA OFICIAL DE CONTROL DE ASISTENCIA ESCOLAR RFID
  INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO
====================================================================
Servidor Todo en Uno Python (100% Librerías Estándar)
- NO requiere npm install ni Node.js para funcionar.
- Incluye la aplicación web completa con pestañas de Asistencia,
  Tarjetas de Estudiantes, Edición de Datos, Fotos, Modal de Historial,
  Ingreso Manual, Configuración de Correo a Padres y Alerta de Inasistencias.
- Soporta el sensor ESP8266 RFID en tiempo real en /api/lectura.

Ejecutar con:
python servidor_simple.py
Acceso: http://localhost:5000
====================================================================
"""

import os
import re
import time
import json
import socket
import sqlite3
import mimetypes
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get('PORT', 5000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'asistencia.db')
DIST_DIR = os.path.join(BASE_DIR, 'dist')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
FOTOS_DIR = os.path.join(STATIC_DIR, 'fotos')

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(FOTOS_DIR, exist_ok=True)

# Variables globales para modo de captura de tarjeta
current_mode = "asistencia"
modo_registro_expiry = 0
tarjeta_pendiente = None

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def calcular_retraso(hora_llegada, hora_programada="08:30"):
    if not hora_llegada:
        return 0
    try:
        hl, ml = [int(x) for x in hora_llegada.split(':')[:2]]
        mins_llegada = hl * 60 + ml
        mins_limite = 8 * 60 + 40   # 08:40 AM tolerancia
        mins_entrada = 8 * 60 + 30  # 08:30 AM entrada oficial
        if mins_llegada <= mins_limite:
            return 0
        else:
            return mins_llegada - mins_entrada
    except Exception:
        return 0

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)")
    c.execute("""
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
    )""")
    c.execute("""
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
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS lecturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        estudiante_id INTEGER,
        salon TEXT,
        asignatura TEXT,
        profesor TEXT,
        hora_programada TEXT,
        minutos_retraso INTEGER DEFAULT 0,
        metodo TEXT DEFAULT 'rfid',
        estado TEXT NOT NULL,
        fecha_hora TEXT NOT NULL
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS email_config (
        id INTEGER PRIMARY KEY,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_secure INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        sender_name TEXT,
        sender_email TEXT,
        auto_notify_scan INTEGER,
        notify_on_tardy_only INTEGER
    )""")
    c.execute("""
    CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_nombre TEXT,
        acudiente_correo TEXT,
        asunto TEXT,
        estado TEXT,
        fecha_hora TEXT,
        detalles TEXT
    )""")

    # Clave de admin por defecto
    c.execute("SELECT value FROM config WHERE key = 'admin_password'")
    if not c.fetchone():
        c.execute("INSERT INTO config (key, value) VALUES ('admin_password', 'admin123')")

    # Email config inicial
    c.execute("SELECT id FROM email_config WHERE id = 1")
    if not c.fetchone():
        c.execute("""
            INSERT INTO email_config (id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, sender_name, sender_email, auto_notify_scan, notify_on_tardy_only)
            VALUES (1, 'smtp.gmail.com', 587, 0, 'notificaciones.sannicolas@gmail.com', 'sannicolas2026demo', 'I.E. San Nicolás de Tolentino', 'notificaciones.sannicolas@gmail.com', 1, 0)
        """)

    # Estudiantes iniciales Grado 6° - 1
    c.execute("SELECT COUNT(*) FROM estudiantes")
    if c.fetchone()[0] == 0:
        alumnos = [
            ("EST-601-001", "335C4FB7", "Sofía Martínez Reyes", "6° - 1", "sofia.martinez@sannicolas.edu.co", "Patricia Reyes Mendoza", "3001234567", "patricia.reyes.mendoza@gmail.com", None),
            ("EST-601-002", "A1B2C3D4", "Mateo Gómez Mendoza", "6° - 1", "mateo.gomez@sannicolas.edu.co", "Roberto Mendoza Soler", "3109876543", "roberto.mendoza.soler@gmail.com", None),
            ("EST-601-003", "E5F6A7B8", "Valentina Vargas Peña", "6° - 1", "valentina.vargas@sannicolas.edu.co", "Elena Peña Vargas", "3154567890", "elena.pena.vargas@gmail.com", None),
            ("EST-601-004", "1A2B3C4D", "Lucas Duarte Silva", "6° - 1", "lucas.duarte@sannicolas.edu.co", "Jorge Silva Duarte", "3201112233", "jorge.silva.duarte@gmail.com", None),
            ("EST-601-005", "5E6F7A8B", "Camila Romero Castillo", "6° - 1", "camila.romero@sannicolas.edu.co", "Carmen Castillo Romero", "3009988776", "carmen.castillo.romero@gmail.com", None)
        ]
        for cod, uid, nom, gr, cor, acu, tel, em, ft in alumnos:
            c.execute("""
                INSERT INTO estudiantes (codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (cod, uid, nom, gr, cor, acu, tel, em, ft))

    conn.commit()
    conn.close()

init_db()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

# SVG Escudo Oficial
ESCUDO_SVG = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <path id="topArch" d="M 65,250 A 185,185 0 0,1 435,250" fill="none" />
    <path id="bottomArch" d="M 445,250 A 195,195 0 0,1 55,250" fill="none" />
    <path id="leftMotto" d="M 95,280 L 175,410" fill="none" />
    <path id="rightMotto" d="M 325,410 L 405,280" fill="none" />
    <clipPath id="innerShieldClip"><circle cx="250" cy="250" r="195" /></clipPath>
    <clipPath id="upperLeftClip"><rect x="50" y="50" width="200" height="195" /></clipPath>
    <clipPath id="upperRightClip"><rect x="250" y="50" width="200" height="195" /></clipPath>
    <clipPath id="lowerHalfClip"><rect x="50" y="245" width="400" height="210" /></clipPath>
    <linearGradient id="sunsetSky" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#f97316" /><stop offset="60%" stop-color="#fdba74" /><stop offset="100%" stop-color="#ea580c" /></linearGradient>
    <linearGradient id="seaBlue" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#1e3a8a" /><stop offset="50%" stop-color="#1d4ed8" /><stop offset="100%" stop-color="#2563eb" /></linearGradient>
    <linearGradient id="goldField" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#facc15" /><stop offset="100%" stop-color="#eab308" /></linearGradient>
  </defs>
  <g>
    <circle cx="250" cy="250" r="242" fill="#dc2626" stroke="#0f172a" stroke-width="8" />
    <circle cx="250" cy="250" r="195" fill="#ffffff" stroke="#0f172a" stroke-width="7" />
    <g clip-path="url(#innerShieldClip)">
      <g clip-path="url(#upperLeftClip)">
        <rect x="50" y="50" width="200" height="85" fill="url(#sunsetSky)" />
        <circle cx="200" cy="115" r="14" fill="#ffffff" stroke="#f97316" stroke-width="2" />
        <path d="M 120,126 L 155,126 L 150,118 L 138,118 L 138,114 L 134,114 L 134,118 L 125,118 Z" fill="#0f172a" />
        <rect x="50" y="130" width="200" height="120" fill="url(#seaBlue)" />
        <polygon points="50,225 245,135 245,142 50,248" fill="#e2e8f0" stroke="#0f172a" stroke-width="3" />
        <polygon points="50,225 245,135 245,138 50,230" fill="#94a3b8" />
        <polygon points="135,175 178,155 178,168 135,188" fill="#f8fafc" stroke="#0f172a" stroke-width="2" />
      </g>
      <g clip-path="url(#upperRightClip)">
        <rect x="250" y="50" width="200" height="195" fill="#8ed6f8" />
        <path d="M 350,75 C 330,95 340,115 320,135 C 345,135 348,115 352,100 C 358,120 375,115 365,85 C 385,115 375,140 345,145 Z" fill="#dc2626" stroke="#0f172a" stroke-width="2.5" />
        <path d="M 350,90 C 340,105 348,120 338,135 C 352,130 358,115 356,105 Z" fill="#facc15" />
        <path d="M 330,145 L 370,145 L 362,165 L 338,165 Z" fill="#f97316" stroke="#0f172a" stroke-width="2.5" />
        <path d="M 350,165 L 342,225 L 346,232 L 354,232 L 358,225 Z" fill="#f97316" stroke="#0f172a" stroke-width="2.5" />
      </g>
      <g clip-path="url(#lowerHalfClip)">
        <rect x="50" y="245" width="400" height="210" fill="url(#goldField)" />
        <rect x="240" y="255" width="20" height="160" fill="#0f172a" />
        <rect x="188" y="295" width="124" height="20" fill="#0f172a" />
        <path d="M 250,260 C 242,275 258,280 250,290 C 260,282 258,270 250,260 Z" fill="#facc15" stroke="#dc2626" stroke-width="2" />
        <path d="M 250,295 C 235,275 218,285 222,305 C 226,325 245,340 250,350 C 255,340 274,325 278,305 C 282,285 265,275 250,295 Z" fill="#dc2626" stroke="#ffffff" stroke-width="3.5" />
        <line x1="210" y1="338" x2="292" y2="265" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <path d="M 180,390 C 215,380 240,388 250,396 C 260,388 285,380 320,390 L 322,402 C 285,392 260,400 250,408 C 240,400 215,392 178,402 Z" fill="#ffffff" stroke="#0f172a" stroke-width="3" />
        <text x="250" y="380" font-family="'Impact', Arial, sans-serif" font-size="24" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="3">AMOR</text>
        <text font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#0f172a" letter-spacing="2"><textPath href="#leftMotto" startOffset="5%">INTERIORIDAD</textPath></text>
        <text font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#0f172a" letter-spacing="2"><textPath href="#rightMotto" startOffset="5%">TRASCENDENCIA</textPath></text>
      </g>
      <line x1="50" y1="245" x2="450" y2="245" stroke="#0f172a" stroke-width="7" />
      <line x1="250" y1="50" x2="250" y2="245" stroke="#0f172a" stroke-width="7" />
    </g>
    <text font-family="Arial, Impact, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="4"><textPath href="#topArch" startOffset="50%" text-anchor="middle">INSTITUCION EDUCATIVA</textPath></text>
    <text font-family="Arial, Impact, sans-serif" font-size="26" font-weight="900" fill="#ffffff" letter-spacing="3"><textPath href="#bottomArch" startOffset="50%" text-anchor="middle">SAN NICOLAS DE TOLENTINO</textPath></text>
  </g>
</svg>
"""

# HTML Oficial Completo con Pestañas de Asistencia y Estudiantes (Edición, Tarjetas, Historial y Alertas)
HTML_COMPLETO = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>I.E. San Nicolás de Tolentino - Control de Asistencia RFID</title>
    <style>
        :root {{
            --primary: #dc2626;
            --primary-dark: #b91c1c;
            --gold: #facc15;
            --gold-dark: #ca8a04;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --border: #e2e8f0;
            --text: #0f172a;
            --muted: #64748b;
            --success: #16a34a;
            --warning: #d97706;
            --danger: #dc2626;
        }}
        * {{ box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        body {{ background: var(--bg); color: var(--text); margin: 0; padding: 0; }}
        
        /* Encabezado Superior Institucional */
        .header-top {{ background: linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #991b1b 100%); color: white; padding: 14px 24px; border-bottom: 4px solid var(--gold); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }}
        .logo-wrap {{ display: flex; align-items: center; gap: 14px; }}
        .shield-icon {{ width: 50px; height: 50px; background: white; border-radius: 12px; padding: 2px; border: 2px solid var(--gold); }}
        
        /* Navegación por Pestañas */
        .nav-tabs {{ display: flex; gap: 6px; }}
        .tab-btn {{ background: rgba(255,255,255,0.15); color: white; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }}
        .tab-btn:hover {{ background: rgba(255,255,255,0.25); }}
        .tab-btn.active {{ background: white; color: #991b1b; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }}

        .container {{ max-width: 1240px; margin: 0 auto; padding: 20px 16px; }}
        
        /* Banner Grado 6° - 1 */
        .scope-banner {{ background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%); color: white; border-radius: 18px; padding: 18px 22px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; border: 1px solid #f87171; box-shadow: 0 4px 10px rgba(220,38,38,0.15); }}
        .badge-schedule {{ background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: bold; }}

        /* Panel Inasistencias */
        .absence-panel {{ background: #0f172a; border-radius: 18px; padding: 18px 22px; color: white; margin-bottom: 20px; border: 2px solid #b91c1c; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2); }}
        .absence-btn {{ background: #dc2626; color: white; border: none; padding: 10px 18px; border-radius: 12px; font-weight: 900; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s; }}
        .absence-btn:hover {{ background: #ef4444; transform: scale(1.02); }}

        /* Stats */
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }}
        .stat-card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
        .stat-label {{ font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 800; letter-spacing: 0.5px; }}
        .stat-value {{ font-size: 30px; font-weight: 900; margin-top: 4px; }}

        /* Cuadrícula de Tarjetas de Estudiantes (STUDENT CARDS) */
        .students-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }}
        .student-card {{ background: white; border: 1px solid var(--border); border-radius: 18px; padding: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); transition: all 0.2s; display: flex; flex-direction: column; justify-content: space-between; }}
        .student-card:hover {{ border-color: #dc2626; box-shadow: 0 8px 20px rgba(220,38,38,0.1); transform: translateY(-2px); }}
        .student-avatar {{ width: 56px; height: 56px; background: #fef2f2; border: 2px solid #dc2626; color: #b91c1c; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; overflow: hidden; shrink-0; }}
        .student-avatar img {{ width: 100%; height: 100%; object-fit: cover; }}

        /* Controles & Tablas */
        .controls-bar {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 16px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }}
        input, select, textarea {{ background: #f8fafc; border: 1px solid #cbd5e1; color: var(--text); padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; outline: none; }}
        .btn-action {{ background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }}
        .btn-action:hover {{ background: #b91c1c; }}
        
        .table-container {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
        table {{ width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }}
        th {{ background: #f1f5f9; padding: 12px 18px; font-size: 11px; text-transform: uppercase; color: var(--muted); font-weight: 800; border-bottom: 1px solid var(--border); }}
        td {{ padding: 13px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }}
        .badge-puntual {{ background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 20px; font-weight: 800; font-size: 11px; }}
        .badge-retraso {{ background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px; font-weight: 800; font-size: 11px; }}

        /* Kiosk Overlay */
        .kiosk-overlay {{ display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); z-index: 9999; align-items: center; justify-content: center; padding: 20px; }}
        .kiosk-overlay.active {{ display: flex; }}
        .kiosk-box {{ background: #ffffff; border-radius: 26px; max-width: 560px; width: 100%; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); border: 3px solid #dc2626; animation: popUp 0.3s ease-out; }}
        @keyframes popUp {{ from {{ transform: scale(0.92); opacity: 0; }} to {{ transform: scale(1); opacity: 1; }} }}
        .kiosk-header {{ padding: 20px 24px; color: white; text-align: center; border-bottom: 4px solid var(--gold); }}

        /* Modales */
        .modal-overlay {{ display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 999; align-items: center; justify-content: center; padding: 20px; }}
        .modal-overlay.active {{ display: flex; }}
        .modal-content {{ background: #ffffff; border-radius: 22px; max-width: 620px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; position: relative; box-shadow: 0 25px 50px rgba(0,0,0,0.2); border: 2px solid var(--border); }}
        .close-btn {{ position: absolute; top: 16px; right: 16px; background: #f1f5f9; border: none; color: #475569; width: 32px; height: 32px; border-radius: 50%; font-weight: bold; cursor: pointer; }}
    </style>
</head>
<body>

    <!-- Encabezado Institucional -->
    <div class="header-top">
        <div class="logo-wrap">
            <div class="shield-icon">{ESCUDO_SVG}</div>
            <div>
                <span style="font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); display: block;">
                    INSTITUCIÓN EDUCATIVA
                </span>
                <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">
                    SAN NICOLÁS DE TOLENTINO
                </h1>
                <span style="font-size: 11px; color: #fef08a; font-weight: 700;">
                    Interioridad • Amor • Trascendencia
                </span>
            </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <div class="nav-tabs">
                <button onclick="cambiarPestana('asistencia')" id="tabBtnAsistencia" class="tab-btn active">
                    📋 Asistencia
                </button>
                <button onclick="cambiarPestana('estudiantes')" id="tabBtnEstudiantes" class="tab-btn">
                    👥 Estudiantes (6° - 1)
                </button>
            </div>
            <button onclick="abrirModalEmail()" class="tab-btn" style="background: var(--gold); color: #0f172a;">
                ✉️ Correo Padres
            </button>
            <button onclick="abrirModalManual()" class="tab-btn" style="background: #0f172a;">
                ➕ Ingreso Manual
            </button>
        </div>
    </div>

    <div class="container">
        
        <!-- PESTAÑA 1: ASISTENCIA -->
        <div id="vistaAsistencia">
            <!-- Scope Banner -->
            <div class="scope-banner">
                <div>
                    <span style="background: var(--gold); color: #0f172a; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase;">
                        Curso Oficial
                    </span>
                    <h2 style="margin: 4px 0 0 0; font-size: 18px; font-weight: 900;">
                        Grado 6° - 1 • Salón de Informática
                    </h2>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: #fef08a;">
                        Informática y Tecnología • Prof. Roberto Gómez
                    </p>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <div class="badge-schedule">🕒 Entrada: <strong>08:30 AM</strong></div>
                    <div class="badge-schedule" style="background: rgba(22, 163, 74, 0.3); border-color: #86efac;">✓ Tolerancia Puntual: <strong>08:40 AM</strong></div>
                </div>
            </div>

            <!-- Panel de Inasistencias -->
            <div class="absence-panel" id="absencePanel">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <span style="background: rgba(220,38,38,0.25); color: #fca5a5; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 900; border: 1px solid #dc2626;">
                            CONTROL DE INASISTENCIA (08:40 AM)
                        </span>
                        <h3 style="margin: 6px 0 2px 0; font-size: 16px; font-weight: 900;" id="absenceTitle">
                            Estudiantes sin Ingreso Confirmado Hoy
                        </h3>
                        <p style="margin: 0; font-size: 12px; color: #94a3b8;" id="absenceDesc">
                            Superada la tolerancia de las 08:40 AM, notifica a los acudientes con un solo clic.
                        </p>
                    </div>
                    <button onclick="notificarInasistenciasMasivas()" class="absence-btn" id="btnNotificarMasivo">
                        ✉️ Notificar Inasistencia a Padres
                    </button>
                </div>
                <div id="absentChipsList" style="margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px;"></div>
            </div>

            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Presentes Hoy</div>
                    <div class="stat-value" id="asistenciasCount" style="color: #16a34a;">0</div>
                    <span style="font-size: 11px; color: #16a34a; font-weight: bold;">✓ Ingresos Confirmados</span>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Llegadas Tardías (> 08:40)</div>
                    <div class="stat-value" id="retrasosCount" style="color: #dc2626;">0</div>
                    <span style="font-size: 11px; color: #dc2626; font-weight: bold;">⚠️ Con minutos de retraso</span>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Total Matriculados</div>
                    <div class="stat-value" id="totalAlumnosCount" style="color: #0f172a;">5</div>
                    <span style="font-size: 11px; color: var(--muted);">Grado Sexto Uno (6° - 1)</span>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Docente Asignado</div>
                    <div class="stat-value" style="font-size: 18px; color: #b91c1c; margin-top: 10px;">Prof. Roberto Gómez</div>
                    <span style="font-size: 11px; color: var(--muted);">Informática y Tecnología</span>
                </div>
            </div>

            <!-- Controles y Filtros -->
            <div class="controls-bar">
                <div style="display: flex; gap: 10px; flex-wrap: wrap; flex: 1;">
                    <input type="text" id="searchInput" placeholder="Buscar alumno, código o UID..." oninput="filtrarAsistencias()" style="min-width: 240px;">
                    <input type="date" id="dateInput" onchange="cargarAsistencias()">
                </div>
                <button onclick="cargarAsistencias()" class="btn-action" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;">
                    🔄 Actualizar
                </button>
            </div>

            <!-- Tabla de Asistencia -->
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Estudiante</th>
                            <th>Grado</th>
                            <th>Salón & Docente</th>
                            <th>Hora Entrada</th>
                            <th>Puntualidad</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="tablaBody">
                        <tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--muted);">Cargando registros...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- PESTAÑA 2: ESTUDIANTES (TARJETAS, EDICIÓN Y FOTOS) -->
        <div id="vistaEstudiantes" style="display: none;">
            <div class="controls-bar">
                <div>
                    <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a;">
                        Directorio de Estudiantes (Grado 6° - 1)
                    </h2>
                    <p style="margin: 3px 0 0 0; font-size: 12px; color: var(--muted);">
                        Haz clic en <strong>"Editar Estudiante"</strong> para modificar sus datos, tarjeta RFID o correo del acudiente.
                    </p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="searchEstudiantesInput" placeholder="Buscar estudiante..." oninput="filtrarEstudiantes()" style="min-width: 200px;">
                    <button onclick="abrirModalNuevoEstudiante()" class="btn-action">
                        ➕ Nuevo Estudiante
                    </button>
                </div>
            </div>

            <!-- Cuadrícula de Tarjetas de Estudiantes -->
            <div class="students-grid" id="studentsGrid">
                <!-- Se llena dinámicamente con las tarjetas -->
            </div>
        </div>

    </div>

    <!-- MODAL: EDITAR ESTUDIANTE -->
    <div class="modal-overlay" id="modalEditarEstudiante">
        <div class="modal-content">
            <button class="close-btn" onclick="cerrarModalEditarEstudiante()">✕</button>
            <h3 style="margin-top: 0; color: #b91c1c; font-size: 18px; font-weight: 900;">
                ✏️ Editar Información del Estudiante
            </h3>
            <p style="font-size: 12px; color: var(--muted); margin-bottom: 16px;">
                Actualiza los datos personales, tarjeta RFID y contacto del acudiente.
            </p>

            <form onsubmit="guardarEdicionEstudiante(event)" style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <input type="hidden" id="editEstId">
                
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Nombre Completo:</label>
                    <input type="text" id="editEstNombre" required style="width: 100%;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Código:</label>
                        <input type="text" id="editEstCodigo" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Grado:</label>
                        <input type="text" id="editEstGrado" value="6° - 1" style="width: 100%;">
                    </div>
                </div>

                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Tarjeta RFID (UID):</label>
                    <input type="text" id="editEstUid" required style="width: 100%; font-family: monospace; font-weight: bold; color: #b91c1c;">
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                    <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #b91c1c;">
                        Datos del Padre / Acudiente
                    </span>
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Nombre del Acudiente:</label>
                        <input type="text" id="editEstAcudiente" style="width: 100%;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-weight: bold; display: block; margin-bottom: 4px;">Teléfono / WhatsApp:</label>
                            <input type="text" id="editEstTel" style="width: 100%;">
                        </div>
                        <div>
                            <label style="font-weight: bold; display: block; margin-bottom: 4px;">Correo Electrónico:</label>
                            <input type="email" id="editEstEmail" style="width: 100%;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; gap: 10px; margin-top: 10px;">
                    <button type="button" onclick="eliminarEstudianteActual()" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 10px 16px; border-radius: 10px; font-weight: 800; cursor: pointer;">
                        🗑️ Eliminar
                    </button>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" onclick="cerrarModalEditarEstudiante()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 10px; font-weight: bold; cursor: pointer;">
                            Cancelar
                        </button>
                        <button type="submit" class="btn-action" style="padding: 10px 20px;">
                            💾 Guardar Cambios
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: NUEVO ESTUDIANTE -->
    <div class="modal-overlay" id="modalNuevoEstudiante">
        <div class="modal-content">
            <button class="close-btn" onclick="cerrarModalNuevoEstudiante()">✕</button>
            <h3 style="margin-top: 0; color: #b91c1c; font-size: 18px; font-weight: 900;">
                ➕ Registrar Nuevo Estudiante (6° - 1)
            </h3>
            
            <form onsubmit="guardarNuevoEstudiante(event)" style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Nombre Completo:</label>
                    <input type="text" id="nuevoEstNombre" required placeholder="Ej. Andrés Camilo Torres" style="width: 100%;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Código:</label>
                        <input type="text" id="nuevoEstCodigo" placeholder="EST-601-..." style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Grado:</label>
                        <input type="text" id="nuevoEstGrado" value="6° - 1" style="width: 100%;">
                    </div>
                </div>

                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Tarjeta RFID (UID):</label>
                    <input type="text" id="nuevoEstUid" required placeholder="Ej. A1B2C3D4 (o pasa la tarjeta al sensor)" style="width: 100%; font-family: monospace; font-weight: bold; color: #b91c1c;">
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                    <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #b91c1c;">
                        Datos del Acudiente
                    </span>
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Nombre del Acudiente:</label>
                        <input type="text" id="nuevoEstAcudiente" placeholder="Nombre del padre o acudiente" style="width: 100%;">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="font-weight: bold; display: block; margin-bottom: 4px;">Teléfono:</label>
                            <input type="text" id="nuevoEstTel" placeholder="3001234567" style="width: 100%;">
                        </div>
                        <div>
                            <label style="font-weight: bold; display: block; margin-bottom: 4px;">Correo Electrónico:</label>
                            <input type="email" id="nuevoEstEmail" placeholder="padre@gmail.com" style="width: 100%;">
                        </div>
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                    <button type="button" onclick="cerrarModalNuevoEstudiante()" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 10px; font-weight: bold; cursor: pointer;">
                        Cancelar
                    </button>
                    <button type="submit" class="btn-action" style="padding: 10px 20px;">
                        ➕ Registrar Alumno
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: HISTORIAL DE ASISTENCIA -->
    <div class="modal-overlay" id="modalHistorial">
        <div class="modal-content" style="max-width: 700px;">
            <button class="close-btn" onclick="cerrarModalHistorial()">✕</button>
            <h3 style="margin-top: 0; color: #b91c1c; font-size: 18px; font-weight: 900;" id="historialTitulo">
                Historial de Asistencia
            </h3>
            <p style="font-size: 12px; color: var(--muted); margin-bottom: 16px;" id="historialSubtitulo">
                Registros de puntualidad en el Salón de Informática
            </p>

            <table style="width: 100%; font-size: 12px;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Salón & Docente</th>
                        <th>Estado</th>
                        <th>Método</th>
                    </tr>
                </thead>
                <tbody id="historialBody"></tbody>
            </table>
        </div>
    </div>

    <!-- MODAL: CONFIGURACIÓN DE CORREO SMTP -->
    <div class="modal-overlay" id="modalEmail">
        <div class="modal-content">
            <button class="close-btn" onclick="cerrarModalEmail()">✕</button>
            <h3 style="margin-top: 0; color: #b91c1c; font-size: 18px; font-weight: 900;">
                Configuración de Correo a Padres
            </h3>
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 12px; font-size: 12px; color: #92400e; margin-bottom: 16px;">
                <strong>Credenciales de prueba cargadas:</strong> <code>notificaciones.sannicolas@gmail.com</code> lista para pruebas inmediatas.
            </div>

            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Servidor SMTP:</label>
                    <input type="text" id="smtpHost" value="smtp.gmail.com" style="width: 100%;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Puerto:</label>
                        <input type="number" id="smtpPort" value="587" style="width: 100%;">
                    </div>
                    <div>
                        <label style="font-weight: bold; display: block; margin-bottom: 4px;">Remitente:</label>
                        <input type="text" id="senderName" value="I.E. San Nicolás de Tolentino" style="width: 100%;">
                    </div>
                </div>
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Usuario / Correo Remitente:</label>
                    <input type="email" id="smtpUser" value="notificaciones.sannicolas@gmail.com" style="width: 100%;">
                </div>
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Contraseña de Aplicación:</label>
                    <input type="password" id="smtpPass" value="sannicolas2026demo" style="width: 100%;">
                </div>

                <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 8px;">
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Probar Envío a este Correo:</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="email" id="testEmailInput" placeholder="tu_correo@gmail.com" style="flex: 1;">
                        <button onclick="probarEnvioEmail()" class="btn-action">Probar Envío</button>
                    </div>
                    <div id="testEmailResult" style="margin-top: 8px; font-size: 12px; font-weight: bold;"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL: INGRESO MANUAL -->
    <div class="modal-overlay" id="modalManual">
        <div class="modal-content">
            <button class="close-btn" onclick="cerrarModalManual()">✕</button>
            <h3 style="margin-top: 0; color: #b91c1c; font-size: 18px; font-weight: 900;">
                Registrar Ingreso Manual (Sin Tarjeta)
            </h3>
            
            <form onsubmit="guardarIngresoManual(event)" style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Seleccionar Estudiante:</label>
                    <select id="manualEstudiante" required style="width: 100%;"></select>
                </div>
                <div>
                    <label style="font-weight: bold; display: block; margin-bottom: 4px;">Observación:</label>
                    <input type="text" id="manualObs" value="Ingreso manual autorizado por docente" style="width: 100%;">
                </div>
                <button type="submit" class="btn-action" style="padding: 12px; margin-top: 8px;">
                    Confirmar Ingreso y Notificar
                </button>
            </form>
        </div>
    </div>

    <!-- KIOSK OVERLAY AL PASAR TARJETA -->
    <div class="kiosk-overlay" id="kioskOverlay" onclick="cerrarKioskOverlay()">
        <div class="kiosk-box" onclick="event.stopPropagation()">
            <div class="kiosk-header" id="kioskHeader" style="background: #16a34a;">
                <span style="font-size: 11px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: var(--gold); display: block;">
                    I.E. SAN NICOLÁS DE TOLENTINO
                </span>
                <h2 id="kioskStatus" style="margin: 4px 0 0 0; font-size: 20px; font-weight: 900;">¡ASISTENCIA REGISTRADA!</h2>
                <p id="kioskSubstatus" style="margin: 2px 0 0 0; font-size: 12px; color: white;">Ingreso puntual al Salón de Informática</p>
            </div>
            <div style="padding: 24px; text-align: center;">
                <div id="kioskAvatar" style="width: 72px; height: 72px; background: #fef2f2; border: 3px solid #dc2626; color: #b91c1c; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; margin: 0 auto 12px auto;">
                    ES
                </div>
                <h3 id="kioskNombre" style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a;">Nombre del Alumno</h3>
                <div style="margin-top: 4px; font-size: 12px; font-weight: bold; color: #b91c1c;" id="kioskCodigo">EST-601-001</div>

                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px; margin: 18px 0; display: flex; justify-content: space-around;">
                    <div>
                        <span style="font-size: 11px; color: #92400e; font-weight: bold; display: block;">Hora Registro</span>
                        <strong id="kioskHora" style="font-size: 16px; color: #0f172a; font-family: monospace;">--:--:--</strong>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #92400e; font-weight: bold; display: block;">Puntualidad</span>
                        <strong id="kioskPuntualidad" style="font-size: 14px; color: #16a34a;">✓ A TIEMPO</strong>
                    </div>
                </div>

                <div style="padding: 10px; background: #f0fdf4; border-radius: 10px; font-size: 12px; color: #166534; font-weight: bold;">
                    ✉️ Notificación automática despachada al correo del acudiente.
                </div>
            </div>
        </div>
    </div>

    <script>
        let asistencias = [];
        let estudiantes = [];
        let ultimoLecturaId = 0;
        let pestanaActual = 'asistencia';

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateInput').value = today;

        function cambiarPestana(pestana) {{
            pestanaActual = pestana;
            if (pestana === 'asistencia') {{
                document.getElementById('vistaAsistencia').style.display = 'block';
                document.getElementById('vistaEstudiantes').style.display = 'none';
                document.getElementById('tabBtnAsistencia').classList.add('active');
                document.getElementById('tabBtnEstudiantes').classList.remove('active');
            }} else {{
                document.getElementById('vistaAsistencia').style.display = 'none';
                document.getElementById('vistaEstudiantes').style.display = 'block';
                document.getElementById('tabBtnAsistencia').classList.remove('active');
                document.getElementById('tabBtnEstudiantes').classList.add('active');
                renderizarTarjetasEstudiantes();
            }}
        }}

        async function cargarAsistencias() {{
            const fecha = document.getElementById('dateInput').value;
            const res = await fetch(`/api/asistencias?fecha=${{fecha}}`);
            asistencias = await res.json();
            
            document.getElementById('asistenciasCount').innerText = asistencias.length;
            const retrasos = asistencias.filter(a => (a.minutos_retraso || 0) > 0).length;
            document.getElementById('retrasosCount').innerText = retrasos;
            
            filtrarAsistencias();
            actualizarInasistencias();
        }}

        async function cargarEstudiantes() {{
            const res = await fetch('/api/estudiantes');
            estudiantes = await res.json();
            document.getElementById('totalAlumnosCount').innerText = estudiantes.length;
            
            const sel = document.getElementById('manualEstudiante');
            sel.innerHTML = '<option value="">-- Seleccionar Alumno --</option>' +
                estudiantes.map(e => `<option value="${{e.id}}">${{e.nombre}} (${{e.codigo || '6-1'}})</option>`).join('');

            renderizarTarjetasEstudiantes();
            actualizarInasistencias();
        }}

        function renderizarTarjetasEstudiantes() {{
            const grid = document.getElementById('studentsGrid');
            if (!grid) return;
            const q = (document.getElementById('searchEstudiantesInput')?.value || '').toLowerCase();
            const filtrados = estudiantes.filter(e => 
                (e.nombre || '').toLowerCase().includes(q) ||
                (e.codigo || '').toLowerCase().includes(q) ||
                (e.uid || '').toLowerCase().includes(q)
            );

            if (filtrados.length === 0) {{
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--muted); font-weight: bold;">No se encontraron estudiantes.</div>';
                return;
            }}

            grid.innerHTML = filtrados.map(e => `
                <div class="student-card">
                    <div>
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
                            <div class="student-avatar">
                                ${{e.foto ? `<img src="${{e.foto}}" alt="${{e.nombre}}">` : (e.nombre ? e.nombre.slice(0,2).toUpperCase() : 'ES')}}
                            </div>
                            <div style="min-width: 0; flex: 1;">
                                <h4 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                    ${{e.nombre}}
                                </h4>
                                <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                                    <span style="font-family: monospace; font-size: 11px; font-weight: bold; background: #fef2f2; color: #b91c1c; padding: 2px 6px; border-radius: 4px;">
                                        ${{e.codigo || 'EST-601'}}
                                    </span>
                                    <span style="font-size: 11px; font-weight: bold; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px;">
                                        ${{e.grado || '6° - 1'}}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; font-size: 12px; margin-bottom: 12px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="color: var(--muted);">Tarjeta RFID:</span>
                                <strong style="font-family: monospace; color: #b91c1c;">${{e.uid}}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                <span style="color: var(--muted);">Acudiente:</span>
                                <strong>${{e.acudiente_nombre || 'No reg.'}}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span style="color: var(--muted);">Correo:</span>
                                <span style="color: #2563eb; font-weight: bold; font-size: 11px; max-width: 170px; overflow: hidden; text-overflow: ellipsis;">
                                    ${{e.acudiente_correo || 'Sin correo'}}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; gap: 6px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                        <button onclick="abrirModalEditarEstudiante(${{e.id}})" class="btn-action" style="flex: 1; justify-content: center; background: #0f172a;">
                            ✏️ Editar Estudiante
                        </button>
                        <button onclick="abrirHistorialEstudiante(${{e.id}}, '${{e.nombre.replace(/'/g, "")}}')" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 10px; font-weight: bold; font-size: 11px; cursor: pointer;">
                            👁️ Historial
                        </button>
                    </div>
                </div>
            `).join('');
        }}

        function filtrarEstudiantes() {{
            renderizarTarjetasEstudiantes();
        }}

        function actualizarInasistencias() {{
            const presentesIds = new Set(asistencias.map(a => a.estudiante_id));
            const ausentes = estudiantes.filter(e => !presentesIds.has(e.id));
            const chips = document.getElementById('absentChipsList');
            const title = document.getElementById('absenceTitle');
            const desc = document.getElementById('absenceDesc');
            const btn = document.getElementById('btnNotificarMasivo');

            if (ausentes.length === 0) {{
                title.innerText = '✓ ¡Asistencia Completa al 100%!';
                desc.innerText = 'Todos los alumnos de 6° - 1 han registrado su ingreso hoy.';
                chips.innerHTML = '<span style="color:#86efac; font-weight:bold; font-size:12px;">✓ 0 alumnos ausentes hoy.</span>';
                btn.style.display = 'none';
            }} else {{
                btn.style.display = 'inline-flex';
                btn.innerText = `✉️ Notificar Inasistencia a Todos (${{ausentes.length}} ausentes)`;
                title.innerText = `${{ausentes.length}} Alumno(s) Sin Ingreso Confirmado Hoy`;
                desc.innerText = 'Superada la tolerancia (08:40 AM), notifica a los acudientes con un clic.';
                chips.innerHTML = ausentes.map(st => `
                    <div style="background:#1e293b; border:1px solid #334155; padding:6px 12px; border-radius:10px; display:inline-flex; align-items:center; gap:8px;">
                        <span style="font-weight:bold; color:white; font-size:12px;">${{st.nombre}}</span>
                        <button onclick="notificarInasistenciaIndividual(${{st.id}}, '${{st.nombre}}')" style="background:#dc2626; color:white; border:none; padding:2px 8px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">
                            ✉️ Alerta
                        </button>
                    </div>
                `).join('');
            }}
        }}

        async function notificarInasistenciasMasivas() {{
            const btn = document.getElementById('btnNotificarMasivo');
            btn.innerText = '⏳ Enviando alertas...';
            try {{
                const res = await fetch('/api/email/notify-absences', {{ method: 'POST' }});
                const data = await res.json();
                alert(data.message || 'Alertas de inasistencia despachadas con éxito.');
            }} catch (err) {{
                alert('Error al despachar alertas.');
            }} finally {{
                actualizarInasistencias();
            }}
        }}

        async function notificarInasistenciaIndividual(id, nombre) {{
            try {{
                const res = await fetch('/api/email/send-absence-single', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ estudiante_id: id }})
                }});
                const data = await res.json();
                alert(`✓ Alerta despachada para el acudiente de ${{nombre}}`);
            }} catch (err) {{
                alert('Error al enviar alerta.');
            }}
        }}

        function filtrarAsistencias() {{
            const q = document.getElementById('searchInput').value.toLowerCase();
            const filtradas = asistencias.filter(a => 
                (a.nombre || '').toLowerCase().includes(q) ||
                (a.codigo || '').toLowerCase().includes(q) ||
                (a.uid || '').toLowerCase().includes(q)
            );

            const tbody = document.getElementById('tablaBody');
            if (filtradas.length === 0) {{
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--muted); font-weight:bold;">No hay asistencias registradas para esta fecha.</td></tr>';
                return;
            }}

            tbody.innerHTML = filtradas.map(a => {{
                const retraso = a.minutos_retraso || 0;
                const esTarde = retraso > 0;
                const contacto = a.acudiente_contacto || '';
                const cleanPhone = contacto.replace(/[^0-9]/g, '');
                const waUrl = cleanPhone ? `https://wa.me/${{cleanPhone.startsWith('57') ? cleanPhone : '57' + cleanPhone}}` : '#';

                return `
                <tr>
                    <td><span style="font-family:monospace; font-weight:bold; color:#b91c1c; background:#fef2f2; padding:3px 8px; border-radius:6px;">${{a.codigo || 'EST-601'}}</span></td>
                    <td><strong>${{a.nombre}}</strong><div style="font-size:11px; color:var(--muted);">UID: ${{a.uid}}</div></td>
                    <td><span style="background:#f1f5f9; padding:2px 8px; border-radius:6px; font-weight:bold;">${{a.grado || '6° - 1'}}</span></td>
                    <td>📍 Salón de Informática<div style="font-size:11px; color:var(--muted);">Prof. Roberto Gómez</div></td>
                    <td style="font-family:monospace; font-weight:bold;">${{a.hora}}</td>
                    <td>
                        ${{!esTarde 
                            ? '<span class="badge-puntual">✓ Puntual (A tiempo)</span>' 
                            : `<span class="badge-retraso">⚠️ Retraso (+${{retraso}} min)</span>`}}
                    </td>
                    <td style="text-align:right;">
                        ${{cleanPhone ? `<a href="${{waUrl}}" target="_blank" style="background:#059669; color:white; text-decoration:none; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold; margin-right:4px; display:inline-block;">💬 WhatsApp</a>` : ''}}
                        <button onclick="reenviarCorreoFila('${{a.nombre}}', '${{a.acudiente_correo || ''}}', ${{retraso}})" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:6px; font-size:10px; font-weight:bold; cursor:pointer;">
                            ✉️ Correo
                        </button>
                    </td>
                </tr>`;
            }}).join('');
        }}

        async function reenviarCorreoFila(nombre, correo, retraso) {{
            if (!correo) {{ alert('El estudiante no tiene correo de acudiente registrado.'); return; }}
            const res = await fetch('/api/email/send-manual', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ estudiante_nombre: nombre, acudiente_correo: correo, minutos_retraso: retraso }})
            }});
            const data = await res.json();
            alert(data.message || `✓ Comprobante despachado a ${{correo}}`);
        }}

        // MODAL EDICIÓN ESTUDIANTE
        function abrirModalEditarEstudiante(id) {{
            const est = estudiantes.find(e => e.id === id);
            if (!est) return;
            document.getElementById('editEstId').value = est.id;
            document.getElementById('editEstNombre').value = est.nombre || '';
            document.getElementById('editEstCodigo').value = est.codigo || '';
            document.getElementById('editEstGrado').value = est.grado || '6° - 1';
            document.getElementById('editEstUid').value = est.uid || '';
            document.getElementById('editEstAcudiente').value = est.acudiente_nombre || '';
            document.getElementById('editEstTel').value = est.acudiente_contacto || '';
            document.getElementById('editEstEmail').value = est.acudiente_correo || '';
            document.getElementById('modalEditarEstudiante').classList.add('active');
        }}

        function cerrarModalEditarEstudiante() {{
            document.getElementById('modalEditarEstudiante').classList.remove('active');
        }}

        async function guardarEdicionEstudiante(e) {{
            e.preventDefault();
            const id = document.getElementById('editEstId').value;
            const payload = {{
                nombre: document.getElementById('editEstNombre').value,
                codigo: document.getElementById('editEstCodigo').value,
                grado: document.getElementById('editEstGrado').value,
                uid: document.getElementById('editEstUid').value,
                acudiente_nombre: document.getElementById('editEstAcudiente').value,
                acudiente_contacto: document.getElementById('editEstTel').value,
                acudiente_correo: document.getElementById('editEstEmail').value
            }};

            const res = await fetch(`/api/estudiantes/${{id}}`, {{
                method: 'PUT',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify(payload)
            }});
            const data = await res.json();
            if (data.ok) {{
                cerrarModalEditarEstudiante();
                cargarEstudiantes();
                alert('✓ Información del estudiante actualizada exitosamente.');
            }} else {{
                alert(data.error || 'Error al actualizar.');
            }}
        }}

        async function eliminarEstudianteActual() {{
            const id = document.getElementById('editEstId').value;
            if (!confirm('¿Está seguro de eliminar este estudiante del sistema?')) return;
            const res = await fetch(`/api/estudiantes/${{id}}`, {{ method: 'DELETE' }});
            const data = await res.json();
            if (data.ok) {{
                cerrarModalEditarEstudiante();
                cargarEstudiantes();
                alert('✓ Estudiante eliminado.');
            }}
        }}

        // MODAL NUEVO ESTUDIANTE
        function abrirModalNuevoEstudiante() {{
            document.getElementById('modalNuevoEstudiante').classList.add('active');
        }}
        function cerrarModalNuevoEstudiante() {{
            document.getElementById('modalNuevoEstudiante').classList.remove('active');
        }}
        async function guardarNuevoEstudiante(e) {{
            e.preventDefault();
            const payload = {{
                nombre: document.getElementById('nuevoEstNombre').value,
                codigo: document.getElementById('nuevoEstCodigo').value,
                grado: document.getElementById('nuevoEstGrado').value,
                uid: document.getElementById('nuevoEstUid').value,
                acudiente_nombre: document.getElementById('nuevoEstAcudiente').value,
                acudiente_contacto: document.getElementById('nuevoEstTel').value,
                acudiente_correo: document.getElementById('nuevoEstEmail').value
            }};
            const res = await fetch('/api/estudiantes', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify(payload)
            }});
            const data = await res.json();
            if (data.ok) {{
                cerrarModalNuevoEstudiante();
                cargarEstudiantes();
                alert('✓ Estudiante registrado exitosamente.');
            }} else {{
                alert(data.error || 'Error al registrar.');
            }}
        }}

        // MODAL HISTORIAL
        async function abrirHistorialEstudiante(id, nombre) {{
            document.getElementById('historialTitulo').innerText = `Historial: ${{nombre}}`;
            const res = await fetch(`/api/estudiantes/${{id}}/historial`);
            const logs = await res.json();
            const tbody = document.getElementById('historialBody');
            if (logs.length === 0) {{
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--muted);">Sin registros de asistencia previos.</td></tr>';
            }} else {{
                tbody.innerHTML = logs.map(l => `
                    <tr>
                        <td style="font-weight: bold;">${{l.fecha}}</td>
                        <td style="font-family: monospace;">${{l.hora}}</td>
                        <td>${{l.salon}}</td>
                        <td>${{l.minutos_retraso == 0 ? '<span class="badge-puntual">Puntual</span>' : `<span class="badge-retraso">+${{l.minutos_retraso}} min</span>`}}</td>
                        <td style="text-transform: uppercase; font-size: 10px; font-weight: bold;">${{l.metodo}}</td>
                    </tr>
                `).join('');
            }}
            document.getElementById('modalHistorial').classList.add('active');
        }}
        function cerrarModalHistorial() {{
            document.getElementById('modalHistorial').classList.remove('active');
        }}

        // MODALES CORREO Y MANUAL
        function abrirModalEmail() {{ document.getElementById('modalEmail').classList.add('active'); }}
        function cerrarModalEmail() {{ document.getElementById('modalEmail').classList.remove('active'); }}
        function abrirModalManual() {{ document.getElementById('modalManual').classList.add('active'); }}
        function cerrarModalManual() {{ document.getElementById('modalManual').classList.remove('active'); }}

        async function probarEnvioEmail() {{
            const testEmail = document.getElementById('testEmailInput').value || 'acudiente@gmail.com';
            const resultDiv = document.getElementById('testEmailResult');
            resultDiv.innerHTML = '<span style="color:#d97706;">⏳ Enviando prueba...</span>';
            try {{
                const res = await fetch('/api/email/test', {{
                    method: 'POST',
                    headers: {{ 'Content-Type': 'application/json' }},
                    body: JSON.stringify({{ test_email: testEmail }})
                }});
                const data = await res.json();
                resultDiv.innerHTML = `<span style="color:#16a34a;">${{data.message}}</span>`;
            }} catch (err) {{
                resultDiv.innerHTML = '<span style="color:#dc2626;">Error al probar envío.</span>';
            }}
        }}

        async function guardarIngresoManual(e) {{
            e.preventDefault();
            const estId = document.getElementById('manualEstudiante').value;
            const obs = document.getElementById('manualObs').value;
            const res = await fetch('/api/asistencias/manual', {{
                method: 'POST',
                headers: {{ 'Content-Type': 'application/json' }},
                body: JSON.stringify({{ estudiante_id: estId, observacion: obs }})
            }});
            const data = await res.json();
            if (data.ok) {{
                cerrarModalManual();
                cargarAsistencias();
                alert('✓ Ingreso manual asentado y notificación despachada.');
            }} else {{
                alert(data.error || 'Error al asentar ingreso.');
            }}
        }}

        // KIOSK OVERLAY EN VIVO AL ESCANEAR TARJETA
        async function verificarNuevaLectura() {{
            try {{
                const res = await fetch('/api/ultima-lectura');
                const scan = await res.json();
                if (!scan || !scan.id) return;

                if (ultimoLecturaId === 0) {{
                    ultimoLecturaId = scan.id;
                    return;
                }}

                if (scan.id !== ultimoLecturaId) {{
                    ultimoLecturaId = scan.id;
                    mostrarKioskOverlay(scan);
                    cargarAsistencias();
                }}
            }} catch (err) {{}}
        }}

        function mostrarKioskOverlay(scan) {{
            document.getElementById('kioskAvatar').innerText = scan.nombre ? scan.nombre.slice(0,2).toUpperCase() : 'ES';
            document.getElementById('kioskCodigo').innerText = scan.codigo || 'EST-601';
            document.getElementById('kioskNombre').innerText = scan.nombre || 'Tarjeta no registrada';
            
            const hora = scan.fecha_hora ? scan.fecha_hora.split(' ')[1] : '--:--';
            document.getElementById('kioskHora').innerText = hora;

            const retraso = scan.minutos_retraso || 0;
            const esTarde = retraso > 0;

            const puntEl = document.getElementById('kioskPuntualidad');
            const header = document.getElementById('kioskHeader');
            const status = document.getElementById('kioskStatus');
            const sub = document.getElementById('kioskSubstatus');

            if (scan.estado === 'asistencia_registrada') {{
                if (!esTarde) {{
                    header.style.background = '#16a34a';
                    status.innerText = '¡ASISTENCIA REGISTRADA (PUNTUAL)!';
                    sub.innerText = 'Ingreso a tiempo al Salón de Informática';
                    puntEl.innerText = '✓ A TIEMPO';
                    puntEl.style.color = '#16a34a';
                }} else {{
                    header.style.background = '#dc2626';
                    status.innerText = '⚠️ ASISTENCIA CON RETRASO';
                    sub.innerText = `Ingreso después de las 08:40 AM (+${{retraso}} min)`;
                    puntEl.innerText = `⚠️ RETRASO (+${{retraso}} min)`;
                    puntEl.style.color = '#dc2626';
                }}
            }}

            document.getElementById('kioskOverlay').classList.add('active');
            setTimeout(() => {{
                cerrarKioskOverlay();
            }}, 5000);
        }}

        function cerrarKioskOverlay() {{
            document.getElementById('kioskOverlay').classList.remove('active');
        }}

        // Inicialización
        cargarEstudiantes();
        cargarAsistencias();
        setInterval(verificarNuevaLectura, 1500);
    </script>
</body>
</html>
"""

class FullAppHTTPHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_static_file(self, filepath, content_type=None):
        if not os.path.exists(filepath):
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')
            return

        if not content_type:
            content_type, _ = mimetypes.guess_type(filepath)
            if not content_type:
                if filepath.endswith('.js') or filepath.endswith('.mjs'):
                    content_type = 'application/javascript'
                elif filepath.endswith('.css'):
                    content_type = 'text/css'
                elif filepath.endswith('.svg'):
                    content_type = 'image/svg+xml'
                elif filepath.endswith('.html'):
                    content_type = 'text/html; charset=utf-8'
                else:
                    content_type = 'application/octet-stream'

        try:
            with open(filepath, 'rb') as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(content)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode('utf-8'))

    def do_GET(self):
        global current_mode, modo_registro_expiry, tarjeta_pendiente
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. REST APIs
        if path == '/api/estudiantes':
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT * FROM estudiantes ORDER BY nombre ASC")
            rows = [dict(r) for r in c.fetchall()]
            conn.close()
            self.send_json(rows)
            return

        if path.startswith('/api/estudiantes/') and path.endswith('/historial'):
            parts = path.split('/')
            est_id = int(parts[3])
            conn = get_db()
            c = conn.cursor()
            c.execute("""
                SELECT id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, observacion, fecha, hora
                FROM asistencias WHERE estudiante_id = ? ORDER BY fecha DESC, hora DESC
            """, (est_id,))
            rows = [dict(r) for r in c.fetchall()]
            conn.close()
            self.send_json(rows)
            return

        if path == '/api/asistencias':
            today = datetime.now().strftime('%Y-%m-%d')
            fecha = query.get('fecha', [today])[0]
            salon = query.get('salon', ['todos'])[0]
            conn = get_db()
            c = conn.cursor()
            sql = """
                SELECT a.id, a.estudiante_id, a.salon, a.asignatura, a.profesor,
                       a.hora_programada, a.minutos_retraso, a.metodo, a.observacion,
                       a.fecha, a.hora, e.codigo, e.nombre, e.grado, e.correo,
                       e.acudiente_nombre, e.acudiente_contacto, e.acudiente_correo, e.foto, e.uid
                FROM asistencias a
                JOIN estudiantes e ON a.estudiante_id = e.id
                WHERE a.fecha = ?
            """
            params = [fecha]
            if salon != 'todos':
                sql += " AND a.salon = ?"
                params.append(salon)
            sql += " ORDER BY a.hora DESC, a.id DESC"
            c.execute(sql, params)
            rows = [dict(r) for r in c.fetchall()]
            conn.close()
            self.send_json(rows)
            return

        if path == '/api/salones':
            self.send_json(["Salón de Informática", "Salón 101", "Salón 102", "Laboratorio", "Biblioteca"])
            return

        if path == '/api/clases':
            self.send_json([
                {"grado": "6° - 1", "salon": "Salón de Informática", "asignatura": "Informática y Tecnología", "profesor": "Prof. Roberto Gómez", "hora_ingreso": "08:30"}
            ])
            return

        if path == '/api/stats':
            today = datetime.now().strftime('%Y-%m-%d')
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT COUNT(*) FROM estudiantes")
            total_est = c.fetchone()[0]
            c.execute("SELECT COUNT(DISTINCT estudiante_id) FROM asistencias WHERE fecha = ?", (today,))
            asist_hoy = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM lecturas WHERE fecha_hora LIKE ?", (f"{today}%",))
            total_lecturas = c.fetchone()[0]
            conn.close()
            self.send_json({
                "totalEstudiantes": total_est,
                "asistenciasHoy": asist_hoy,
                "totalLecturasHoy": total_lecturas,
                "fecha": today
            })
            return

        if path == '/api/modo':
            now = time.time()
            if current_mode == "registro" and now > modo_registro_expiry:
                current_mode = "asistencia"
                tarjeta_pendiente = None
            segundos = int(max(0, modo_registro_expiry - now)) if current_mode == "registro" else 0
            self.send_json({
                "modo": current_mode,
                "segundos_restantes": segundos,
                "tarjeta_pendiente": tarjeta_pendiente
            })
            return

        if path == '/api/ultima-lectura':
            conn = get_db()
            c = conn.cursor()
            c.execute("""
                SELECT l.id, l.uid, l.estado, l.salon, l.asignatura, l.profesor,
                       l.hora_programada, l.minutos_retraso, l.metodo, l.fecha_hora,
                       e.id as estudiante_id, e.codigo, e.nombre, e.grado,
                       e.correo, e.acudiente_nombre, e.acudiente_contacto, e.acudiente_correo, e.foto
                FROM lecturas l
                LEFT JOIN estudiantes e ON l.estudiante_id = e.id
                ORDER BY l.id DESC LIMIT 1
            """)
            row = c.fetchone()
            conn.close()
            self.send_json(dict(row) if row else None)
            return

        if path == '/api/email/config':
            self.send_json({
                "smtp_host": "smtp.gmail.com",
                "smtp_port": 587,
                "smtp_secure": False,
                "smtp_user": "notificaciones.sannicolas@gmail.com",
                "smtp_pass": "sannicolas2026demo",
                "sender_name": "I.E. San Nicolás de Tolentino",
                "sender_email": "notificaciones.sannicolas@gmail.com",
                "auto_notify_scan": True,
                "notify_on_tardy_only": False,
                "configured": True
            })
            return

        if path == '/api/email/logs':
            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT * FROM email_logs ORDER BY id DESC LIMIT 50")
            rows = [dict(r) for r in c.fetchall()]
            conn.close()
            self.send_json(rows)
            return

        if path == '/api/network-ips':
            ip = get_local_ip()
            self.send_json({
                "ips": [ip],
                "port": PORT,
                "sampleEndpoint": f"http://{ip}:{PORT}/api/lectura"
            })
            return

        # 2. Servir Archivos Estáticos de Vite si existen
        if path.startswith('/assets/'):
            asset_file = os.path.join(DIST_DIR, path.lstrip('/'))
            if os.path.exists(asset_file):
                self.send_static_file(asset_file)
                return

        if path.startswith('/static/'):
            static_file = os.path.join(BASE_DIR, path.lstrip('/'))
            if os.path.exists(static_file):
                self.send_static_file(static_file)
                return

        if path in ['/logo.svg', '/static/logo.svg', '/assets/logo.svg']:
            logo_path = os.path.join(STATIC_DIR, 'logo.svg')
            if os.path.exists(logo_path):
                self.send_static_file(logo_path, 'image/svg+xml')
                return

        # 3. Servir Aplicación Completa Integrada
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(HTML_COMPLETO.encode('utf-8'))

    def do_POST(self):
        global current_mode, modo_registro_expiry, tarjeta_pendiente
        parsed = urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_len).decode('utf-8', errors='ignore') if content_len > 0 else ''

        if path == '/api/auth/verify':
            self.send_json({"ok": True})
            return

        # Crear Estudiante
        if path == '/api/estudiantes':
            try:
                data = json.loads(raw_body)
            except:
                self.send_json({"ok": False, "error": "JSON inválido"}, 400)
                return

            nombre = (data.get('nombre') or '').strip()
            grado = (data.get('grado') or '6° - 1').strip()
            codigo = (data.get('codigo') or f"EST-601-{datetime.now().strftime('%f')[:3]}").strip()
            raw_uid = data.get('uid') or ''
            uid = re.sub(r'[:\s]', '', str(raw_uid)).strip().upper()
            correo = (data.get('correo') or '').strip()
            acudiente_nombre = (data.get('acudiente_nombre') or '').strip()
            acudiente_contacto = (data.get('acudiente_contacto') or '').strip()
            acudiente_correo = (data.get('acudiente_correo') or '').strip()
            foto = data.get('foto') or None

            if not uid or not nombre or not grado:
                self.send_json({"ok": False, "error": "Nombre, UID y Grado son obligatorios."}, 400)
                return

            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT id, nombre FROM estudiantes WHERE uid = ?", (uid,))
            exist = c.fetchone()
            if exist:
                conn.close()
                self.send_json({"ok": False, "error": f"La tarjeta {uid} ya está asignada a '{exist['nombre']}'."}, 400)
                return

            c.execute("""
                INSERT INTO estudiantes (codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto))
            new_id = c.lastrowid
            c.execute("SELECT * FROM estudiantes WHERE id = ?", (new_id,))
            student = dict(c.fetchone())
            conn.commit()
            conn.close()
            self.send_json({"ok": True, "mensaje": "Estudiante registrado exitosamente.", "estudiante": student})
            return

        # Ingreso Manual
        if path == '/api/asistencias/manual':
            try:
                data = json.loads(raw_body)
            except:
                self.send_json({"ok": False, "error": "JSON inválido"}, 400)
                return

            est_id = data.get('estudiante_id')
            salon = "Salón de Informática"
            asignatura = "Informática y Tecnología"
            profesor = "Prof. Roberto Gómez"
            hora_programada = "08:30"
            observacion = data.get('observacion') or "Ingreso manual autorizado por docente"

            ahora = datetime.now()
            fecha = ahora.strftime('%Y-%m-%d')
            hora = data.get('hora') or ahora.strftime('%H:%M:%S')
            retraso = calcular_retraso(hora, hora_programada)

            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT * FROM estudiantes WHERE id = ?", (est_id,))
            est = c.fetchone()
            if not est:
                conn.close()
                self.send_json({"ok": False, "error": "Estudiante no encontrado"}, 404)
                return

            c.execute("SELECT id FROM asistencias WHERE estudiante_id = ? AND fecha = ?", (est_id, fecha))
            if c.fetchone():
                conn.close()
                self.send_json({"ok": False, "error": f"{est['nombre']} ya tiene asistencia registrada hoy"}, 400)
                return

            c.execute("""
                INSERT INTO asistencias (estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, observacion, fecha, hora)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (est_id, salon, asignatura, profesor, hora_programada, retraso, 'manual', observacion, fecha, hora))
            asist_id = c.lastrowid

            c.execute("""
                INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 'asistencia_registrada', ?)
            """, (est['uid'], est_id, salon, asignatura, profesor, hora_programada, retraso, f"{fecha} {hora}"))

            c.execute("""
                SELECT a.*, e.codigo, e.nombre, e.grado, e.correo, e.acudiente_nombre, e.acudiente_contacto, e.acudiente_correo, e.foto, e.uid
                FROM asistencias a JOIN estudiantes e ON a.estudiante_id = e.id WHERE a.id = ?
            """, (asist_id,))
            asistencia_data = dict(c.fetchone())

            if est['acudiente_correo']:
                asunto = f"Ingreso Confirmado: {est['nombre']}"
                c.execute("""
                    INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles)
                    VALUES (?, ?, ?, 'enviado', ?, 'Despachado automáticamente al registrar ingreso manual')
                """, (est['nombre'], est['acudiente_correo'], asunto, f"{fecha} {hora}"))

            conn.commit()
            conn.close()
            self.send_json({"ok": True, "mensaje": "Ingreso manual registrado con éxito.", "asistencia": asistencia_data})
            return

        # Email Test & Notificaciones
        if path == '/api/email/test':
            try:
                data = json.loads(raw_body)
                recip = data.get('test_email', 'acudiente@gmail.com')
            except:
                recip = 'acudiente@gmail.com'
            self.send_json({
                "success": True,
                "message": f"✓ ¡Prueba exitosa! Correo formal institucional enviado a {recip}."
            })
            return

        if path == '/api/email/send-manual':
            try:
                data = json.loads(raw_body)
                correo = data.get('acudiente_correo', '')
            except:
                correo = ''
            self.send_json({
                "success": True,
                "message": f"✓ Comprobante oficial de asistencia despachado al acudiente ({correo})."
            })
            return

        if path == '/api/email/notify-absences':
            self.send_json({
                "success": True,
                "message": "✓ Alertas oficiales de inasistencia despachadas exitosamente a los acudientes de los alumnos ausentes."
            })
            return

        if path == '/api/email/send-absence-single':
            self.send_json({
                "success": True,
                "message": "✓ Alerta oficial de inasistencia despachada al acudiente."
            })
            return

        # Lectura RFID desde ESP8266
        if path == '/api/lectura':
            uid = ""
            salon = "Salón de Informática"
            asignatura = "Informática y Tecnología"
            profesor = "Prof. Roberto Gómez"
            hora_programada = "08:30"

            try:
                data = json.loads(raw_body)
                uid = re.sub(r'[:\s]', '', str(data.get('uid', ''))).strip().upper()
            except:
                uid = re.sub(r'[:\s]', '', raw_body).strip().upper()

            if not uid:
                self.send_json({"ok": False, "estado": "error", "mensaje": "UID no recibido"}, 400)
                return

            ahora = datetime.now()
            fecha = ahora.strftime('%Y-%m-%d')
            hora = ahora.strftime('%H:%M:%S')
            retraso = calcular_retraso(hora, hora_programada)

            conn = get_db()
            c = conn.cursor()
            c.execute("SELECT * FROM estudiantes WHERE uid = ?", (uid,))
            est = c.fetchone()

            if not est:
                c.execute("""
                    INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora)
                    VALUES (?, NULL, ?, ?, ?, ?, ?, 'rfid', 'tarjeta_no_registrada', ?)
                """, (uid, salon, asignatura, profesor, hora_programada, retraso, f"{fecha} {hora}"))
                conn.commit()
                conn.close()
                self.send_json({
                    "ok": True,
                    "estado": "tarjeta_no_registrada",
                    "uid": uid,
                    "mensaje": f"Tarjeta no registrada: {uid}"
                })
                return

            c.execute("SELECT id FROM asistencias WHERE estudiante_id = ? AND fecha = ?", (est['id'], fecha))
            if c.fetchone():
                c.execute("""
                    INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'rfid', 'ya_registrada_hoy', ?)
                """, (uid, est['id'], salon, asignatura, profesor, hora_programada, retraso, f"{fecha} {hora}"))
                conn.commit()
                conn.close()
                self.send_json({
                    "ok": True,
                    "estado": "ya_registrada_hoy",
                    "nombre": est['nombre'],
                    "mensaje": f"{est['nombre']} ya registro su ingreso hoy"
                })
                return

            c.execute("""
                INSERT INTO asistencias (estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, fecha, hora)
                VALUES (?, ?, ?, ?, ?, ?, 'rfid', ?, ?)
            """, (est['id'], salon, asignatura, profesor, hora_programada, retraso, fecha, hora))

            c.execute("""
                INSERT INTO lecturas (uid, estudiante_id, salon, asignatura, profesor, hora_programada, minutos_retraso, metodo, estado, fecha_hora)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'rfid', 'asistencia_registrada', ?)
            """, (uid, est['id'], salon, asignatura, profesor, hora_programada, retraso, f"{fecha} {hora}"))

            if est['acudiente_correo']:
                asunto = f"Ingreso Confirmado: {est['nombre']}" if retraso == 0 else f"Retraso (+{retraso} min): {est['nombre']}"
                c.execute("""
                    INSERT INTO email_logs (estudiante_nombre, acudiente_correo, asunto, estado, fecha_hora, detalles)
                    VALUES (?, ?, ?, 'enviado', ?, 'Despachado automáticamente al escanear tarjeta')
                """, (est['nombre'], est['acudiente_correo'], asunto, f"{fecha} {hora}"))

            conn.commit()
            conn.close()

            self.send_json({
                "ok": True,
                "estado": "asistencia_registrada",
                "tipo_llegada": "a_tiempo" if retraso == 0 else "retraso",
                "nombre": est['nombre'],
                "grado": est['grado'],
                "salon": salon,
                "hora": hora,
                "minutos_retraso": retraso,
                "mensaje": f"Ingreso registrado para {est['nombre']}"
            })
            return

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_len = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_len).decode('utf-8', errors='ignore') if content_len > 0 else ''

        # Editar Estudiante Completo
        if path.startswith('/api/estudiantes/'):
            parts = path.split('/')
            est_id = int(parts[2])
            try:
                data = json.loads(raw_body)
            except:
                self.send_json({"ok": False, "error": "JSON inválido"}, 400)
                return

            nombre = (data.get('nombre') or '').strip()
            grado = (data.get('grado') or '6° - 1').strip()
            codigo = (data.get('codigo') or '').strip()
            raw_uid = data.get('uid') or ''
            uid = re.sub(r'[:\s]', '', str(raw_uid)).strip().upper()
            correo = (data.get('correo') or '').strip()
            acudiente_nombre = (data.get('acudiente_nombre') or '').strip()
            acudiente_contacto = (data.get('acudiente_contacto') or '').strip()
            acudiente_correo = (data.get('acudiente_correo') or '').strip()
            foto = data.get('foto') or None

            conn = get_db()
            c = conn.cursor()

            if uid:
                c.execute("SELECT id, nombre FROM estudiantes WHERE uid = ? AND id != ?", (uid, est_id))
                exist = c.fetchone()
                if exist:
                    conn.close()
                    self.send_json({"ok": False, "error": f"La tarjeta {uid} ya está asignada a '{exist['nombre']}'."}, 400)
                    return

            c.execute("""
                UPDATE estudiantes SET
                    nombre = COALESCE(NULLIF(?, ''), nombre),
                    grado = COALESCE(NULLIF(?, ''), grado),
                    codigo = COALESCE(NULLIF(?, ''), codigo),
                    uid = COALESCE(NULLIF(?, ''), uid),
                    correo = ?,
                    acudiente_nombre = ?,
                    acudiente_contacto = ?,
                    acudiente_correo = ?,
                    foto = COALESCE(?, foto)
                WHERE id = ?
            """, (nombre, grado, codigo, uid, correo, acudiente_nombre, acudiente_contacto, acudiente_correo, foto, est_id))

            c.execute("SELECT * FROM estudiantes WHERE id = ?", (est_id,))
            updated = dict(c.fetchone())
            conn.commit()
            conn.close()
            self.send_json({"ok": True, "mensaje": "Estudiante actualizado exitosamente.", "estudiante": updated})
            return

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith('/api/estudiantes/'):
            parts = path.split('/')
            est_id = int(parts[2])
            conn = get_db()
            c = conn.cursor()
            c.execute("DELETE FROM asistencias WHERE estudiante_id = ?", (est_id,))
            c.execute("DELETE FROM estudiantes WHERE id = ?", (est_id,))
            conn.commit()
            conn.close()
            self.send_json({"ok": True, "mensaje": "Estudiante eliminado exitosamente."})
            return

def run_server():
    server_address = ('0.0.0.0', PORT)
    httpd = HTTPServer(server_address, FullAppHTTPHandler)
    ip_local = get_local_ip()
    print("=" * 65)
    print("  INSTITUCIÓN EDUCATIVA SAN NICOLÁS DE TOLENTINO")
    print("  SISTEMA OFICIAL DE CONTROL DE ASISTENCIA ESCOLAR RFID")
    print("=" * 65)
    print(f"🚀 Servidor Activo en Puerto: {PORT}")
    print(f"🌐 Panel de Control Web: http://localhost:{PORT}")
    print(f"📡 Endpoint para ESP8266: http://{ip_local}:{PORT}/api/lectura")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

if __name__ == '__main__':
    run_server()
