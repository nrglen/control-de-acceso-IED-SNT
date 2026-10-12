/*
  ===================================================================
  SISTEMA DE ASISTENCIA ESCOLAR RFID - FIRMWARE ESP8266 + RC522
  Versión Mejorada: Soporte Universal HTTPS (Web en la nube) y HTTP (LAN)
  ===================================================================
  
  Placas soportadas:
  - NodeMCU v2 / v3 (ESP-12E / ESP8266)
  - Wemos D1 Mini
  - Cualquier módulo ESP8266 con conexión Wi-Fi

  Lector RFID:
  - Módulo RFID-RC522 (13.56 MHz Mifare) y tarjetas/llaveros compatibles.

  Librerías requeridas en Arduino IDE (Menú: Programa -> Incluir Librería -> Administrar Bibliotecas):
  1. "MFRC522" por GithubCommunity
  2. "ArduinoJson" por Benoit Blanchon (versión 6.x o 7.x)
  3. "ESP8266WiFi" y "ESP8266HTTPClient" (incluidas con el paquete de tarjetas ESP8266)

  Conexión de Pines (ESP8266 NodeMCU <-> MFRC522):
  -----------------------------------------------------------------
  RC522 PIN    | ESP8266 NodeMCU | Wemos D1 Mini | Descripción
  -----------------------------------------------------------------
  3.3V (VCC)   | 3.3V            | 3.3V          | ¡ATENCIÓN: NUNCA conectar a 5V!
  RST (Reset)  | D3 (GPIO 0)     | D3            | Reset
  GND          | GND             | GND           | Tierra / Ground
  IRQ          | No conectado    | No conectado  | No requerido
  MISO         | D6 (GPIO 12)    | D6            | SPI MISO
  MOSI         | D7 (GPIO 13)    | D7            | SPI MOSI
  SCK          | D5 (GPIO 14)    | D5            | SPI Clock
  SDA (SS)     | D4 (GPIO 2)     | D4            | SPI Slave Select
  -----------------------------------------------------------------
  Componentes Opcionales de Indicación:
  Buzzer       | D1 (GPIO 5)     | D1            | Sonido de confirmación
  LED Verde    | D2 (GPIO 4)     | D2            | Luz de lectura exitosa
  -----------------------------------------------------------------
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ===================================================================
// 1. CONFIGURACIÓN DE RED WI-FI
// ===================================================================
const char* WIFI_SSID     = "TU_NOMBRE_WIFI";      // Nombre de tu red Wi-Fi
const char* WIFI_PASSWORD = "TU_CONTRASENA_WIFI";  // Contraseña de tu red Wi-Fi

// ===================================================================
// 2. ENDPOINT / URL DE LA PÁGINA WEB O SERVIDOR
// ===================================================================
// Si tu app está subida a una página web (Google Cloud Run, Vercel, Render, Railway, VPS):
// Copia la URL desde "Ajustes > ESP8266" en la página web.
// IMPORTANTE:
// - Debe comenzar con "https://" si está en la nube o "http://" si es local.
// - Debe terminar con "/api/lectura".
//
// Ejemplos:
// - Página Web publicada: "https://ais-pre-qpjmvonyw3spku67ul5ko5-286007630516.us-east1.run.app/api/lectura"
// - Servidor local en PC: "http://192.168.1.100:3000/api/lectura"
const char* SERVER_ENDPOINT = "https://ais-pre-qpjmvonyw3spku67ul5ko5-286007630516.us-east1.run.app/api/lectura";

// Configuración de este punto de control / salón
const char* SALON_NAME      = "Salón de Informática";
const char* ASIGNATURA_NAME = "Informática y Tecnología";

// ===================================================================
// 3. ASIGNACIÓN DE PINES HARDWARE (ESP8266)
// ===================================================================
// Compatibilidad de pines GPIO para cualquier módulo ESP8266
// (NodeMCU v2/v3, Wemos D1 Mini o Generic ESP8266 Module)
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

#define SS_PIN     D4 // GPIO 2  (SDA del RC522)
#define RST_PIN    D3 // GPIO 0  (RST del RC522)
#define BUZZER_PIN D1 // GPIO 5  (Buzzer activo o pasivo - Opcional)
#define LED_PIN    D2 // GPIO 4  (LED Verde indicador - Opcional)

MFRC522 rfid(SS_PIN, RST_PIN);

// Filtro anti-rebote para evitar lecturas continuas de la misma tarjeta pegada
String ultimaTarjetaLeida = "";
unsigned long tiempoUltimaLectura = 0;
const unsigned long COOLDOWN_MS = 2500; // 2.5 segundos de enfriamiento

// Declaraciones de funciones para compatibilidad estricta con todas las versiones de Arduino IDE
void emitirBeep(int duracionMs, int veces = 1);
String extraerHost(String url);
void realizarPeticionHttp(HTTPClient &http, String uid);
void enviarLecturaAlServidor(String uid);

// Función para emitir tonos en el buzzer
void emitirBeep(int duracionMs, int veces = 1) {
  for (int i = 0; i < veces; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duracionMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (veces > 1) delay(70);
  }
}

// Extrae el host de una URL para diagnóstico DNS
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
  delay(600);

  Serial.println("\n\n========================================================");
  Serial.println("  SISTEMA DE ASISTENCIA ESCOLAR RFID - ESP8266");
  Serial.println("  Firmware Universal con Soporte SSL/HTTPS y HTTP Local");
  Serial.println("========================================================");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  // Inicializar bus SPI y Lector RFID RC522
  SPI.begin();
  rfid.PCD_Init();
  delay(100);
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  Serial.printf("[RFID] Lector MFRC522 inicializado (Registro Version: 0x%02X)\n", version);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("[ALERTA RFID] ¡Comprueba las conexiones de cables entre ESP8266 y RC522!");
  } else {
    Serial.println("[RFID] Comunicación SPI con RC522 correcta.");
  }

  // Conectar a la red Wi-Fi
  Serial.println("\n[WIFI] Conectando a la red:");
  Serial.printf("       SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(500);
    Serial.print(".");
    intentos++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] ¡Conexión Wi-Fi exitosa!");
    Serial.print("[WIFI] IP asignada al ESP8266: ");
    Serial.println(WiFi.localIP());
    Serial.printf("[WIFI] Potencia de señal (RSSI): %d dBm\n", WiFi.RSSI());
    Serial.printf("[ENDPOINT] %s\n", SERVER_ENDPOINT);
    Serial.printf("[SALÓN]    %s\n", SALON_NAME);

    // Diagnóstico preliminar de DNS
    String host = extraerHost(String(SERVER_ENDPOINT));
    IPAddress testIp;
    Serial.printf("[DNS] Verificando resolución de '%s'...\n", host.c_str());
    if (WiFi.hostByName(host.c_str(), testIp)) {
      Serial.printf("[DNS] ¡Éxito! Dominio resuelto a IP: %s\n", testIp.toString().c_str());
    } else {
      Serial.println("[DNS ADVERTENCIA] No se pudo resolver la IP del dominio aún.");
      Serial.println("                  Verifica si la red Wi-Fi tiene salida a internet.");
    }

    emitirBeep(100, 2); // 2 beeps cortos = Inicio correcto
  } else {
    Serial.println("\n[WIFI ERROR] No se pudo conectar a la red Wi-Fi.");
    Serial.println("             Verifica el nombre (SSID) y la contraseña.");
    emitirBeep(400, 2);
  }
}

void loop() {
  // Ceder tiempo a tareas Wi-Fi en segundo plano del ESP8266 y evitar Soft Watchdog Reset (WDT)
  yield();
  delay(10);

  // Verificar si hay una tarjeta nueva cerca del lector
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  // Leer el número de serie (UID) de la tarjeta
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Normalizar UID a formato hexadecimal en mayúsculas (ej: "A34F129C")
  String uidString = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uidString += "0";
    uidString += String(rfid.uid.uidByte[i], HEX);
  }
  uidString.toUpperCase();

  // Filtro anti-rebote: evitar lecturas repetidas continuas de la misma tarjeta
  if (uidString == ultimaTarjetaLeida && (millis() - tiempoUltimaLectura) < COOLDOWN_MS) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  ultimaTarjetaLeida = uidString;
  tiempoUltimaLectura = millis();

  Serial.println("\n--------------------------------------------------------");
  Serial.printf("[LECTURA RFID] Tarjeta detectada con UID: %s\n", uidString.c_str());

  // Enviar lectura por HTTP/HTTPS POST al servidor
  enviarLecturaAlServidor(uidString);

  // Detener comunicación con la tarjeta actual
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void enviarLecturaAlServidor(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] Wi-Fi desconectado. Intentando reconectar...");
    WiFi.reconnect();
    emitirBeep(300, 1);
    return;
  }

  String endpoint = String(SERVER_ENDPOINT);
  endpoint.trim();

  // Asegurar que la URL tenga protocolo
  if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
    endpoint = "https://" + endpoint;
  }

  // Asegurar que termine en /api/lectura si solo se colocó el dominio
  if (!endpoint.endsWith("/api/lectura")) {
    endpoint += "/api/lectura";
  }

  bool isHttps = endpoint.startsWith("https://");

  Serial.println("[CONEXIÓN] Preparando envío...");
  Serial.printf("[PROTOCOLO] %s\n", isHttps ? "HTTPS Seguro (SSL/TLS con BearSSL)" : "HTTP Estándar");
  Serial.printf("[DESTINO]   %s\n", endpoint.c_str());

  HTTPClient http;
  http.setTimeout(15000); // 15 segundos para dar tiempo a la negociación SSL en la nube
  http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
  http.setReuse(false);

  bool beginOk = false;

  if (isHttps) {
    // Para conexiones HTTPS en la nube (Google Cloud Run, Vercel, Render, Railway, etc.):
    // Usamos WiFiClientSecure con setInsecure() para aceptar certificados SSL
    // sin agotar la memoria RAM del ESP8266 cargando certificados raíz pesados.
    WiFiClientSecure client;
    client.setInsecure();
    
    // CRÍTICO PARA ESP8266:
    // Reducir tamaño de buffers SSL a 2048 bytes para evitar que el ESP8266 se quede
    // sin memoria RAM durante el apretón de manos (handshake) TLS.
    client.setBufferSizes(2048, 1024);
    client.setTimeout(12000);

    beginOk = http.begin(client, endpoint);
    if (!beginOk) {
      Serial.println("[ERROR SSL] No se pudo iniciar el cliente HTTPS con la URL provista.");
    }
    realizarPeticionHttp(http, uid);
  } else {
    // Para conexiones locales HTTP (ej: 192.168.x.x o localhost)
    WiFiClient client;
    client.setTimeout(10000);

    beginOk = http.begin(client, endpoint);
    if (!beginOk) {
      Serial.println("[ERROR HTTP] No se pudo iniciar el cliente HTTP.");
    }
    realizarPeticionHttp(http, uid);
  }

  http.end();
}

void realizarPeticionHttp(HTTPClient &http, String uid) {
  http.addHeader("Content-Type", "application/json");
  http.addHeader("User-Agent", "ESP8266-RFID-Attendance/2.0");

  // Construir cuerpo JSON
  String payload = "{\"uid\":\"" + uid + "\",\"salon\":\"" + String(SALON_NAME) + "\",\"asignatura\":\"" + String(ASIGNATURA_NAME) + "\"}";
  Serial.printf("[PAYLOAD JSON] %s\n", payload.c_str());

  unsigned long tInicio = millis();
  int httpCode = http.POST(payload);
  unsigned long latencia = millis() - tInicio;

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("[RESPUESTA SERVIDOR] Código HTTP: %d (tiempo: %lu ms)\n", httpCode, latencia);
    Serial.printf("[CUERPO] %s\n", response.c_str());

    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      // Parsear respuesta JSON compatible con ArduinoJson v6 y v7
      #if defined(ARDUINOJSON_VERSION_MAJOR) && ARDUINOJSON_VERSION_MAJOR >= 7
        JsonDocument doc;
      #else
        StaticJsonDocument<512> doc;
      #endif
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        const char* estado = doc["estado"] | "desconocido";
        const char* nombre = doc["nombre"] | "";
        Serial.printf("[RESULTADO] Estado: %s | Estudiante: %s\n", estado, (strlen(nombre) > 0 ? nombre : "N/A"));

        if (strcmp(estado, "asistencia_registrada") == 0) {
          // Asistencia registrada con éxito
          digitalWrite(LED_PIN, HIGH);
          emitirBeep(120, 1);
          delay(200);
          digitalWrite(LED_PIN, LOW);
          Serial.println("[OK] ¡Asistencia registrada exitosamente en la página web!");
        } else if (strcmp(estado, "ya_registrada_hoy") == 0) {
          // Ya había registrado hoy
          emitirBeep(70, 2);
          Serial.println("[AVISO] El estudiante ya tenía asistencia registrada hoy.");
        } else if (strcmp(estado, "tarjeta_capturada") == 0 || strcmp(estado, "tarjeta_asignada") == 0) {
          // Modo registro o vinculación
          emitirBeep(60, 3);
          Serial.println("[MODO REGISTRO] Tarjeta capturada en la aplicación web para asignación.");
        } else if (strcmp(estado, "tarjeta_no_registrada") == 0) {
          // Tarjeta no vinculada
          emitirBeep(350, 1);
          Serial.println("[AVISO] Tarjeta no vinculada a ningún estudiante.");
        }
      } else {
        Serial.printf("[ERROR JSON] No se pudo parsear respuesta JSON: %s\n", error.c_str());
        emitirBeep(100, 1);
      }
    } else if (httpCode == 301 || httpCode == 302 || httpCode == 308) {
      Serial.println("[AVISO 301/302] El servidor solicitó una redirección.");
      Serial.println("                Asegúrate de que SERVER_ENDPOINT empiece directamente con 'https://'.");
      emitirBeep(150, 2);
    } else if (httpCode == 404) {
      Serial.println("[ERROR 404] Endpoint no encontrado.");
      Serial.println("            Verifica que la URL termine en '/api/lectura'.");
      emitirBeep(300, 2);
    } else {
      Serial.printf("[AVISO] El servidor respondió con código HTTP %d.\n", httpCode);
      emitirBeep(200, 1);
    }
  } else {
    // Si httpCode es negativo, ocurrió un error en la conexión física o TLS/SSL
    Serial.printf("\n[ERROR DE CONEXIÓN] Fallo al contactar el servidor: %s (código: %d)\n", 
                  http.errorToString(httpCode).c_str(), httpCode);
    Serial.println("================ DIAGNÓSTICO DE CAUSAS FRECUENTES ================");
    Serial.println("1. SSL / HTTPS en la nube:");
    Serial.println("   La página web utiliza HTTPS seguro. Este firmware ya incluye WiFiClientSecure");
    Serial.println("   y client.setInsecure() con buffers optimizados para solucionar este error.");
    Serial.println("2. URL incorrecta o incompleta:");
    Serial.printf("   Verifica que SERVER_ENDPOINT sea exactamente: %s\n", SERVER_ENDPOINT);
    Serial.println("   Debe tener 'https://' al inicio y '/api/lectura' al final.");
    Serial.println("3. Sin conexión a internet en la red Wi-Fi:");
    Serial.println("   Asegúrate de que la red Wi-Fi a la que se conectó el ESP8266 tenga acceso");
    Serial.println("   a internet para llegar al servidor público.");
    Serial.println("===================================================================\n");
    emitirBeep(400, 2); // 2 beeps largos = Error de conexión
  }
}
