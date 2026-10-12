import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldAlert, 
  Terminal, 
  Copy, 
  Check, 
  Network, 
  ExternalLink, 
  FileCode, 
  Zap, 
  Layers, 
  HelpCircle,
  KeyRound
} from 'lucide-react';

export const HardwareGuideModal: React.FC = () => {
  const [copiedArduino, setCopiedArduino] = useState(false);
  const [copiedFirewall, setCopiedFirewall] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{ ips: string[]; port: number; sampleEndpoint: string } | null>(null);
  const [dynamicArduinoCode, setDynamicArduinoCode] = useState<string>('');

  // Password change state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    fetch('/api/network-ips')
      .then((res) => res.json())
      .then((data) => setNetworkInfo(data))
      .catch(() => {});

    fetch('/api/esp8266/arduino-code')
      .then((res) => res.json())
      .then((data) => {
        if (data?.code) setDynamicArduinoCode(data.code);
      })
      .catch(() => {});
  }, []);

  const arduinoCode = dynamicArduinoCode || `/*
  SISTEMA DE ASISTENCIA ESCOLAR RFID - FIRMWARE ESP8266 + RC522
  Universal: Soporte SSL HTTPS para la Web y HTTP para Red Local
*/
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_PASSWORD_WIFI";
const char* SERVER_ENDPOINT = "https://.../api/lectura";
// ... (Código completo disponible para descarga)
`;

  const firewallCommand = `netsh advfirewall firewall add rule name="Servidor Asistencia RFID Puerto 5000" dir=in action=allow protocol=TCP localport=5000`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setPassMsg({ type: 'ok', text: '¡Contraseña actualizada con éxito!' });
        setCurrentPass('');
        setNewPass('');
      } else {
        setPassMsg({ type: 'err', text: data.error || 'Error al cambiar contraseña' });
      }
    } catch {
      setPassMsg({ type: 'err', text: 'Error de conexión con el servidor.' });
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Network & Local Server Info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Configuración de Red Local (LAN) para ESP8266
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Direcciones IP disponibles en este computador para configurar el lector RFID
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-emerald-400 font-mono text-xs px-4 py-2 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Escuchando en: 0.0.0.0:{networkInfo?.port || 5000}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              IP(s) Locales Detectadas
            </span>
            <div className="flex flex-wrap gap-2">
              {networkInfo && networkInfo.ips.length > 0 ? (
                networkInfo.ips.map((ip) => (
                  <span
                    key={ip}
                    className="font-mono text-sm font-bold bg-white px-3 py-1 rounded-lg border border-slate-300 text-blue-700 shadow-xs"
                  >
                    {ip}
                  </span>
                ))
              ) : (
                <span className="font-mono text-xs text-slate-500">
                  (En Windows ejecute 'ipconfig' en CMD para ver su IPv4)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Esta es la IP que debe colocar en <code className="text-blue-600">SERVER_IP</code> en el código Arduino.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
              Endpoint HTTP POST
            </span>
            <div className="font-mono text-xs font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 truncate shadow-xs">
              {networkInfo?.sampleEndpoint || 'http://192.168.1.X:5000/api/lectura'}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Payload requerido: <code className="text-slate-700">{`{"uid": "A34F129C", "salon": "Salon-101"}`}</code>
            </p>
          </div>
        </div>
      </div>

      {/* Hardware Connection Diagram Table */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-black text-slate-900">
            Diagrama de Conexión: ESP8266 (NodeMCU) y Lector RFID RC522
          </h3>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs mb-4 flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>¡ADVERTENCIA DE VOLTAJE!</strong> Conecte el pin <strong>VCC / 3.3V</strong> del módulo RC522 
            estrictamente al pin <strong>3.3V</strong> del ESP8266. <u>NUNCA conecte el RC522 a 5V</u> porque se quemará.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Pin Lector RC522</th>
                <th className="py-2.5 px-4">ESP8266 NodeMCU</th>
                <th className="py-2.5 px-4">Wemos D1 Mini</th>
                <th className="py-2.5 px-4">Función</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr className="bg-amber-50/50 font-bold">
                <td className="py-2 px-4 text-amber-700">3.3V (VCC)</td>
                <td className="py-2 px-4">3.3V</td>
                <td className="py-2 px-4">3.3V</td>
                <td className="py-2 px-4">Alimentación 3.3V (¡No usar 5V!)</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">RST (Reset)</td>
                <td className="py-2 px-4 font-mono font-bold text-blue-600">D3 (GPIO 0)</td>
                <td className="py-2 px-4 font-mono">D3</td>
                <td className="py-2 px-4">Reinicio del chip RFID</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">GND</td>
                <td className="py-2 px-4 font-mono font-bold text-slate-900">GND</td>
                <td className="py-2 px-4 font-mono">GND</td>
                <td className="py-2 px-4">Tierra común</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">IRQ</td>
                <td className="py-2 px-4 text-slate-400">No conectado</td>
                <td className="py-2 px-4 text-slate-400">No conectado</td>
                <td className="py-2 px-4">Interrupción no requerida</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">MISO</td>
                <td className="py-2 px-4 font-mono font-bold text-blue-600">D6 (GPIO 12)</td>
                <td className="py-2 px-4 font-mono">D6</td>
                <td className="py-2 px-4">SPI Master In Slave Out</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">MOSI</td>
                <td className="py-2 px-4 font-mono font-bold text-blue-600">D7 (GPIO 13)</td>
                <td className="py-2 px-4 font-mono">D7</td>
                <td className="py-2 px-4">SPI Master Out Slave In</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">SCK</td>
                <td className="py-2 px-4 font-mono font-bold text-blue-600">D5 (GPIO 14)</td>
                <td className="py-2 px-4 font-mono">D5</td>
                <td className="py-2 px-4">SPI Clock</td>
              </tr>
              <tr>
                <td className="py-2 px-4 font-mono">SDA (SS)</td>
                <td className="py-2 px-4 font-mono font-bold text-blue-600">D4 (GPIO 2)</td>
                <td className="py-2 px-4 font-mono">D4</td>
                <td className="py-2 px-4">SPI Slave Select</td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-2 px-4 font-mono">Buzzer (Opcional)</td>
                <td className="py-2 px-4 font-mono font-bold text-emerald-600">D1 (GPIO 5)</td>
                <td className="py-2 px-4 font-mono">D1</td>
                <td className="py-2 px-4">Zumbador para confirmación acústica</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Windows Execution & Firewall Instructions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-4">
          <Terminal className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-black text-slate-900">
            Instrucciones para Ejecución en Windows y Firewall (Puerto 5000)
          </h3>
        </div>

        <div className="space-y-4 text-xs text-slate-700">
          {/* Step 1: Firewall */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                Habilitar Puerto 5000 en el Firewall de Windows
              </span>
              <button
                onClick={() => copyToClipboard(firewallCommand, setCopiedFirewall)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-600 font-bold rounded-lg border border-slate-200 transition-colors"
              >
                {copiedFirewall ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFirewall ? '¡Copiado!' : 'Copiar Comando'}</span>
              </button>
            </div>
            <p className="text-slate-600">
              Para que el ESP8266 pueda comunicarse con el computador, Windows debe permitir conexiones entrantes en el puerto 5000. 
              Abra <strong>PowerShell</strong> o <strong>Símbolo del sistema (CMD)</strong> como <u>Administrador</u> y ejecute:
            </p>
            <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg font-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-all">
              {firewallCommand}
            </pre>
            <p className="text-[11px] text-slate-500">
              * O simplemente haga doble clic derecho en el archivo provisto <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-mono font-bold">abrir_puerto_firewall.bat</code> y seleccione "Ejecutar como Administrador".
            </p>
          </div>

          {/* Step 2: Running server in Windows */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 block">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Cómo Iniciar el Servidor en su Computador
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <span>Con Node.js (Recomendado)</span>
                </h4>
                <p className="text-slate-500 text-[11px] mb-2">
                  Doble clic en <code className="font-bold font-mono">iniciar_servidor_windows.bat</code> o ejecute en terminal:
                </p>
                <pre className="bg-slate-900 text-cyan-300 p-2 rounded text-[11px] font-mono whitespace-pre-wrap">
                  npm install{'\n'}
                  npm run build{'\n'}
                  PORT=5000 npm start
                </pre>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                  <span>Con Python Flask (app.py)</span>
                </h4>
                <p className="text-slate-500 text-[11px] mb-2">
                  Si prefiere Python con SQLite en Windows:
                </p>
                <pre className="bg-slate-900 text-amber-300 p-2 rounded text-[11px] font-mono whitespace-pre-wrap">
                  pip install flask flask-cors werkzeug{'\n'}
                  python app.py
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Arduino IDE Code Box */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-black text-slate-900">
                Código Arduino Firmware para ESP8266 (.ino)
              </h3>
              <p className="text-xs text-slate-500">
                Archivo disponible en raíz: <code className="font-mono text-indigo-600">esp8266_rfid_asistencia.ino</code>
              </p>
            </div>
          </div>

          <button
            onClick={() => copyToClipboard(arduinoCode, setCopiedArduino)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto"
          >
            {copiedArduino ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedArduino ? '¡Código Copiado!' : 'Copiar Código Completo'}</span>
          </button>
        </div>

        <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[350px] leading-relaxed border border-slate-800">
          {arduinoCode}
        </pre>
      </div>

      {/* Administration Password Configuration */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2.5 mb-2">
          <KeyRound className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-black text-slate-900">
            Cambiar Contraseña de Administración
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Actualice la clave de acceso para proteger el módulo de estudiantes y registro de tarjetas.
        </p>

        {passMsg && (
          <div
            className={`p-3 rounded-xl text-xs mb-4 ${
              passMsg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {passMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="password"
            required
            value={currentPass}
            onChange={(e) => setCurrentPass(e.target.value)}
            placeholder="Contraseña actual (ej. admin123)"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            required
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Nueva contraseña (mínimo 3 caract.)"
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={passLoading || !currentPass || !newPass}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            {passLoading ? 'Actualizando...' : 'Guardar Nueva Clave'}
          </button>
        </form>
      </div>
    </div>
  );
};
