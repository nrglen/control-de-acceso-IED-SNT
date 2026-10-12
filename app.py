"""
Sistema de Asistencia Escolar con RFID (ESP8266 + SQLite)
Backend oficial en Python Flask
Ejecutar con: python app.py
Escucha en: 0.0.0.0:5000
"""

import os
import re
import time
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory

try:
    from flask_cors import CORS
    has_flask_cors = True
except ImportError:
    has_flask_cors = False

try:
    from werkzeug.utils import secure_filename
except ImportError:
    def secure_filename(filename):
        return re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)

app = Flask(__name__, static_folder='static')

if has_flask_cors:
    CORS(app)
else:
    @app.after_request
    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
        return response

    @app.route('/api/<path:subpath>', methods=['OPTIONS'])
    def options_handler(subpath):
        return '', 204

DB_PATH = os.path.join(os.path.dirname(__file__), 'asistencia.db')
STATIC_DIR = os.path.join(os.path.dirname(__file__), 'static')
FOTOS_DIR = os.path.join(STATIC_DIR, 'fotos')
DIST_DIR = os.path.join(os.path.dirname(__file__), 'dist')

os.makedirs(FOTOS_DIR, exist_ok=True)

# Variables globales de modo
current_mode = "asistencia"  # "asistencia" o "registro"
modo_registro_expiry = 0
tarjeta_pendiente = None

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS estudiantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        grado TEXT NOT NULL,
        foto TEXT
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS asistencias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        estudiante_id INTEGER NOT NULL,
        salon TEXT NOT NULL,
        fecha TEXT NOT NULL,
        hora TEXT NOT NULL,
        FOREIGN KEY (estudiante_id) REFERENCES estudiantes (id)
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS lecturas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT NOT NULL,
        estudiante_id INTEGER,
        salon TEXT NOT NULL,
        estado TEXT NOT NULL,
        fecha_hora TEXT NOT NULL
    );
    """)
    
    # Contraseña inicial
    cursor.execute("SELECT value FROM config WHERE key = 'admin_password'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO config (key, value) VALUES ('admin_password', 'admin123')")

    # Sembrar estudiantes si está vacío
    cursor.execute("SELECT COUNT(*) FROM estudiantes")
    if cursor.fetchone()[0] == 0:
        default_estudiantes = [
            ('A34F129C', 'Sofía Martínez Reyes', '10° - A', None),
            ('B21890EF', 'Carlos Daniel Mendoza', '10° - A', None),
            ('C77410A1', 'Valentina Gómez Peña', '11° - B', None),
            ('D59021B3', 'Mateo Alejandro Silva', '9° - C', None),
            ('E821034A', 'Lucía Fernández Castillo', '11° - A', None)
        ]
        cursor.executemany("INSERT INTO estudiantes (uid, nombre, grado, foto) VALUES (?, ?, ?, ?)", default_estudiantes)
    
    conn.commit()
    conn.close()

init_db()

def normalize_uid(raw):
    if not raw:
        return ""
    return re.sub(r'[:\s]', '', str(raw)).strip().upper()

def update_modo_state():
    global current_mode, modo_registro_expiry, tarjeta_pendiente
    if current_mode == "registro":
        if time.time() >= modo_registro_expiry:
            current_mode = "asistencia"
            modo_registro_expiry = 0
            tarjeta_pendiente = None

def get_modo_info():
    update_modo_state()
    segundos_restantes = 0
    if current_mode == "registro" and modo_registro_expiry > 0:
        segundos_restantes = max(0, int(modo_registro_expiry - time.time()))
    return {
        "modo": current_mode,
        "segundos_restantes": segundos_restantes
    }

# -------------------------------------------------------------
# Endpoints API
# -------------------------------------------------------------

@app.route('/api/lectura', methods=['POST'])
def api_lectura():
    global tarjeta_pendiente
    data = request.get_json(silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"ok": False, "estado": "error"}), 400

    raw_uid = data.get('uid')
    uid = normalize_uid(raw_uid)
    salon = (data.get('salon') or 'Salon-General').strip()

    if not uid:
        return jsonify({"ok": False, "estado": "error"}), 400

    now = datetime.now()
    fecha = now.strftime('%Y-%m-%d')
    hora = now.strftime('%H:%M:%S')
    fecha_hora = f"{fecha} {hora}"

    modo_info = get_modo_info()
    conn = get_db()
    cursor = conn.cursor()

    # Buscar estudiante
    cursor.execute("SELECT id, uid, nombre, grado, foto FROM estudiantes WHERE uid = ?", (uid,))
    estudiante = cursor.fetchone()

    # MODO ASISTENCIA
    if modo_info["modo"] == "asistencia":
        if estudiante:
            # Revisar si ya marcó hoy en ese salón
            cursor.execute("SELECT id FROM asistencias WHERE estudiante_id = ? AND salon = ? AND fecha = ?", 
                           (estudiante['id'], salon, fecha))
            asistencia_hoy = cursor.fetchone()

            if asistencia_hoy:
                cursor.execute("INSERT INTO lecturas (uid, estudiante_id, salon, estado, fecha_hora) VALUES (?, ?, ?, ?, ?)",
                               (uid, estudiante['id'], salon, 'ya_registrada_hoy', fecha_hora))
                conn.commit()
                conn.close()
                return jsonify({"ok": True, "estado": "ya_registrada_hoy", "nombre": estudiante['nombre']})
            else:
                cursor.execute("INSERT INTO asistencias (estudiante_id, salon, fecha, hora) VALUES (?, ?, ?, ?)",
                               (estudiante['id'], salon, fecha, hora))
                cursor.execute("INSERT INTO lecturas (uid, estudiante_id, salon, estado, fecha_hora) VALUES (?, ?, ?, ?, ?)",
                               (uid, estudiante['id'], salon, 'asistencia_registrada', fecha_hora))
                conn.commit()
                conn.close()
                return jsonify({"ok": True, "estado": "asistencia_registrada", "nombre": estudiante['nombre']})
        else:
            # Tarjeta no registrada
            cursor.execute("INSERT INTO lecturas (uid, estudiante_id, salon, estado, fecha_hora) VALUES (?, NULL, ?, ?, ?)",
                           (uid, salon, 'tarjeta_no_registrada', fecha_hora))
            conn.commit()
            conn.close()
            return jsonify({"ok": True, "estado": "tarjeta_no_registrada", "nombre": None})

    # MODO REGISTRO
    elif modo_info["modo"] == "registro":
        if estudiante:
            cursor.execute("INSERT INTO lecturas (uid, estudiante_id, salon, estado, fecha_hora) VALUES (?, ?, ?, ?, ?)",
                           (uid, estudiante['id'], salon, 'tarjeta_ya_asignada', fecha_hora))
            conn.commit()
            conn.close()
            return jsonify({"ok": True, "estado": "tarjeta_ya_asignada", "nombre": estudiante['nombre']})
        else:
            tarjeta_pendiente = uid
            cursor.execute("INSERT INTO lecturas (uid, estudiante_id, salon, estado, fecha_hora) VALUES (?, NULL, ?, ?, ?)",
                           (uid, salon, 'tarjeta_capturada', fecha_hora))
            conn.commit()
            conn.close()
            return jsonify({"ok": True, "estado": "tarjeta_capturada", "nombre": None})

    conn.close()
    return jsonify({"ok": False, "estado": "error"}), 400


@app.route('/api/modo', methods=['GET'])
def api_modo():
    return jsonify(get_modo_info())


@app.route('/api/modo/registro', methods=['POST'])
def api_modo_registro():
    global current_mode, modo_registro_expiry, tarjeta_pendiente
    current_mode = "registro"
    modo_registro_expiry = time.time() + 60
    tarjeta_pendiente = None
    return jsonify({"ok": True, "modo": "registro", "segundos_restantes": 60})


@app.route('/api/modo/asistencia', methods=['POST'])
def api_modo_asistencia():
    global current_mode, modo_registro_expiry, tarjeta_pendiente
    current_mode = "asistencia"
    modo_registro_expiry = 0
    tarjeta_pendiente = None
    return jsonify({"ok": True, "modo": "asistencia", "segundos_restantes": 0})


@app.route('/api/tarjeta-pendiente', methods=['GET'])
def api_tarjeta_pendiente():
    update_modo_state()
    return jsonify({"uid": tarjeta_pendiente})


@app.route('/api/tarjeta-pendiente/limpiar', methods=['POST'])
def api_tarjeta_pendiente_limpiar():
    global tarjeta_pendiente
    tarjeta_pendiente = None
    return jsonify({"ok": True})


@app.route('/api/ultima-lectura', methods=['GET'])
def api_ultima_lectura():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT l.id, l.uid, l.estado, l.salon, l.fecha_hora,
               e.nombre, e.grado, e.foto
        FROM lecturas l
        LEFT JOIN estudiantes e ON l.estudiante_id = e.id
        ORDER BY l.id DESC LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify(None)
    return jsonify(dict(row))


@app.route('/api/asistencias', methods=['GET'])
def api_asistencias():
    today = datetime.now().strftime('%Y-%m-%d')
    fecha = request.args.get('fecha', today)
    salon = request.args.get('salon')
    asig = request.args.get('asignatura')

    query = """
        SELECT a.id, a.estudiante_id, a.salon, COALESCE(a.asignatura, 'Matemáticas') as asignatura, a.fecha, a.hora,
               e.codigo, e.nombre, e.grado, e.correo, e.acudiente_nombre, e.acudiente_contacto, e.foto, e.uid
        FROM asistencias a
        JOIN estudiantes e ON a.estudiante_id = e.id
        WHERE a.fecha = ?
    """
    params = [fecha]
    if salon and salon not in ('todos', 'Todos'):
        query += " AND a.salon = ?"
        params.append(salon)

    if asig and asig not in ('todas', 'Todas'):
        query += " AND a.asignatura = ?"
        params.append(asig)

    query += " ORDER BY a.hora DESC, a.id DESC"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/estudiantes/<int:est_id>/historial', methods=['GET'])
def api_estudiante_historial(est_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT a.id, a.salon, COALESCE(a.asignatura, 'Matemáticas') as asignatura, a.fecha, a.hora
        FROM asistencias a
        WHERE a.estudiante_id = ?
        ORDER BY a.fecha DESC, a.hora DESC
    """, (est_id,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/estudiantes', methods=['GET'])
def api_get_estudiantes():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, codigo, uid, nombre, grado, correo, acudiente_nombre, acudiente_contacto, foto FROM estudiantes ORDER BY nombre ASC")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)


@app.route('/api/estudiantes', methods=['POST'])
def api_create_estudiante():
    global current_mode, modo_registro_expiry, tarjeta_pendiente

    # Soporte multipart o json
    uid = normalize_uid(request.form.get('uid') or (request.json and request.json.get('uid')))
    nombre = (request.form.get('nombre') or (request.json and request.json.get('nombre')) or '').strip()
    grado = (request.form.get('grado') or (request.json and request.json.get('grado')) or '').strip()
    codigo = (request.form.get('codigo') or (request.json and request.json.get('codigo')) or '').strip()
    correo = (request.form.get('correo') or (request.json and request.json.get('correo')) or '').strip()
    acudiente_nombre = (request.form.get('acudiente_nombre') or (request.json and request.json.get('acudiente_nombre')) or '').strip()
    acudiente_contacto = (request.form.get('acudiente_contacto') or (request.json and request.json.get('acudiente_contacto')) or '').strip()

    if not uid or not nombre or not grado:
        return jsonify({"ok": False, "error": "UID, nombre y grado son obligatorios."}), 400

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT id, nombre FROM estudiantes WHERE uid = ?", (uid,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return jsonify({"ok": False, "error": f"La tarjeta {uid} ya está asignada a {existing['nombre']}."}), 400

    foto_url = None
    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename:
            filename = f"foto_{int(time.time())}_{secure_filename(file.filename)}"
            file.save(os.path.join(FOTOS_DIR, filename))
            foto_url = f"/static/fotos/{filename}"
    elif request.json and request.json.get('foto_base64'):
        # Guardar base64
        import base64
        data = request.json['foto_base64']
        match = re.search(r'base64,(.*)', data)
        if match:
            b64_str = match.group(1)
            filename = f"cam_{int(time.time())}.jpg"
            with open(os.path.join(FOTOS_DIR, filename), "wb") as fh:
                fh.write(base64.b64decode(b64_str))
            foto_url = f"/static/fotos/{filename}"

    cursor.execute("INSERT INTO estudiantes (uid, nombre, grado, foto) VALUES (?, ?, ?, ?)",
                   (uid, nombre, grado, foto_url))
    new_id = cursor.lastrowid
    conn.commit()

    # Vuelve a modo asistencia y limpia tarjeta pendiente
    current_mode = "asistencia"
    modo_registro_expiry = 0
    tarjeta_pendiente = None

    cursor.execute("SELECT id, uid, nombre, grado, foto FROM estudiantes WHERE id = ?", (new_id,))
    new_est = dict(cursor.fetchone())
    conn.close()

    return jsonify({"ok": True, "estudiante": new_est})


@app.route('/api/estudiantes/<int:id>', methods=['PUT'])
def api_update_estudiante(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM estudiantes WHERE id = ?", (id,))
    current = cursor.fetchone()
    if not current:
        conn.close()
        return jsonify({"ok": False, "error": "Estudiante no encontrado."}), 404

    data = request.form if request.form else (request.get_json(silent=True) or {})
    uid = normalize_uid(data.get('uid')) or current['uid']
    nombre = data.get('nombre', current['nombre']).strip()
    grado = data.get('grado', current['grado']).strip()
    foto_url = current['foto']

    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename:
            filename = f"foto_{int(time.time())}_{secure_filename(file.filename)}"
            file.save(os.path.join(FOTOS_DIR, filename))
            foto_url = f"/static/fotos/{filename}"

    cursor.execute("UPDATE estudiantes SET uid = ?, nombre = ?, grado = ?, foto = ? WHERE id = ?",
                   (uid, nombre, grado, foto_url, id))
    conn.commit()
    cursor.execute("SELECT id, uid, nombre, grado, foto FROM estudiantes WHERE id = ?", (id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return jsonify({"ok": True, "estudiante": updated})


@app.route('/api/estudiantes/<int:id>', methods=['DELETE'])
def api_delete_estudiante(id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM asistencias WHERE estudiante_id = ?", (id,))
    cursor.execute("UPDATE lecturas SET estudiante_id = NULL WHERE estudiante_id = ?", (id,))
    cursor.execute("DELETE FROM estudiantes WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route('/api/salones', methods=['GET'])
def api_salones():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT salon FROM asistencias WHERE salon IS NOT NULL")
    salones = {r[0] for r in cursor.fetchall()}
    salones.update(['Salon-101', 'Salon-102', 'Laboratorio', 'Biblioteca', 'Entrada Principal'])
    conn.close()
    return jsonify(list(salones))


@app.route('/api/stats', methods=['GET'])
def api_stats():
    today = datetime.now().strftime('%Y-%m-%d')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM estudiantes")
    total_estudiantes = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(DISTINCT estudiante_id) FROM asistencias WHERE fecha = ?", (today,))
    asistencias_hoy = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM lecturas WHERE fecha_hora LIKE ?", (f"{today}%",))
    lecturas_hoy = cursor.fetchone()[0]
    conn.close()
    return jsonify({
        "totalEstudiantes": total_estudiantes,
        "asistenciasHoy": asistencias_hoy,
        "totalLecturasHoy": lecturas_hoy,
        "fecha": today
    })


@app.route('/api/auth/verify', methods=['POST'])
def api_verify_password():
    data = request.get_json(silent=True) or {}
    password = data.get('password', '')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM config WHERE key = 'admin_password'")
    row = cursor.fetchone()
    conn.close()
    actual = row['value'] if row else 'admin123'
    if password == actual:
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Contraseña incorrecta."}), 401


# Servir Frontend compilado (Vite build) o HTML Oficial
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        return send_from_directory(DIST_DIR, 'index.html')
    try:
        from servidor_simple import HTML_INTERFAZ
        return HTML_INTERFAZ, 200, {'Content-Type': 'text/html; charset=utf-8'}
    except Exception:
        return "I.E. San Nicolás de Tolentino - Control de Asistencia RFID"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print("=" * 60)
    print(f"🚀 Servidor Python Flask RFID Asistencia")
    print(f"📍 Escuchando en: http://0.0.0.0:{port}")
    print(f"📡 Endpoint ESP8266: POST http://<TU_IP_LOCAL>:{port}/api/lectura")
    print("=" * 60)
    app.run(host='0.0.0.0', port=port, debug=False)
