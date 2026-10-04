import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { AttendanceView } from './components/AttendanceView';
import { StudentsView } from './components/StudentsView';
import { HardwareGuideModal } from './components/HardwareGuideModal';
import { SimulatorBar } from './components/SimulatorBar';
import { AttendanceKioskOverlay } from './components/AttendanceKioskOverlay';
import { AdminLoginModal } from './components/AdminLoginModal';
import { ParentNotificationsModal } from './components/ParentNotificationsModal';
import { EmailConfigModal } from './components/EmailConfigModal';
import { SettingsModal } from './components/SettingsModal';
import { Estudiante, Asistencia, Lectura, ModoInfo, SystemStats, AppSettings } from './types';
import { playScanSound } from './utils/audio';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'asistencia' | 'estudiantes' | 'hardware'>('asistencia');
  const [showSimulator, setShowSimulator] = useState(true);

  // App Customization Settings State
  const [appSettings, setAppSettings] = useState<AppSettings>({
    nombre_colegio: 'I.E. SAN NICOLÁS DE TOLENTINO',
    lema_colegio: 'Interioridad • Amor • Trascendencia',
    logo_url: '/static/logo.svg',
    grado: '6° - 1',
    salon: 'Salón de Informática',
    asignatura: 'Informática y Tecnología',
    profesor: 'Prof. Roberto Gómez',
    hora_entrada: '08:30',
    minutos_tolerancia: 10,
    hora_limite: '08:40',
    esp_endpoint_url: ''
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // System Mode State
  const [modoInfo, setModoInfo] = useState<ModoInfo>({
    modo: 'asistencia',
    segundos_restantes: 0
  });
  const [pendingCardUid, setPendingCardUid] = useState<string | null>(null);

  // Data States
  const [students, setStudents] = useState<Estudiante[]>([]);
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [salones, setSalones] = useState<string[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Filter States
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [selectedSalon, setSelectedSalon] = useState<string>('todos');
  const [isLoadingAsistencias, setIsLoadingAsistencias] = useState(false);

  // Latest Scan / Kiosk Overlay
  const [activeKioskLectura, setActiveKioskLectura] = useState<Lectura | null>(null);
  const lastLecturaIdRef = useRef<number | null>(null);
  const isFirstLoadRef = useRef(true);

  // Admin authentication for Protected Tabs & Settings
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'estudiantes' | 'ajustes' | null>(null);
  const [showParentNotificationsModal, setShowParentNotificationsModal] = useState(false);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);

  // Fetch App Settings
  const fetchAppSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/app-config');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setAppSettings(data.settings);
        }
      }
    } catch (e) {
      console.error('Error fetching app settings:', e);
    }
  }, []);

  // Last reading state for Students notification (e.g. tarjeta_ya_asignada)
  const [lastLecturaState, setLastLecturaState] = useState<{
    estado: string;
    nombre: string | null;
    uid: string;
  } | null>(null);

  // 1. Fetch Students
  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/estudiantes');
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (e) {
      console.error('Error fetching students:', e);
    }
  }, []);

  // 2. Fetch Salones
  const fetchSalones = useCallback(async () => {
    try {
      const res = await fetch('/api/salones');
      if (res.ok) {
        const data = await res.json();
        setSalones(data);
      }
    } catch (e) {
      console.error('Error fetching salones:', e);
    }
  }, []);

  // 3. Fetch Asistencias
  const fetchAsistencias = useCallback(async () => {
    setIsLoadingAsistencias(true);
    try {
      const url = `/api/asistencias?fecha=${selectedDate}&salon=${selectedSalon}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAsistencias(data);
      }
    } catch (e) {
      console.error('Error fetching attendances:', e);
    } finally {
      setIsLoadingAsistencias(false);
    }
  }, [selectedDate, selectedSalon]);

  // 4. Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAppSettings();
    fetchStudents();
    fetchSalones();
    fetchStats();
  }, [fetchAppSettings, fetchStudents, fetchSalones, fetchStats]);

  useEffect(() => {
    fetchAsistencias();
  }, [fetchAsistencias]);

  // 5. Polling Loop: GET /api/ultima-lectura (every 1.5s as specified) & GET /api/modo
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        // Poll Modo
        const modoRes = await fetch('/api/modo');
        if (modoRes.ok) {
          const modoData: ModoInfo = await modoRes.json();
          setModoInfo(modoData);

          // If in registration mode, check for pending card
          if (modoData.modo === 'registro') {
            const cardRes = await fetch('/api/tarjeta-pendiente');
            if (cardRes.ok) {
              const cardData = await cardRes.json();
              setPendingCardUid(cardData.uid);
            }
          } else {
            setPendingCardUid(null);
          }
        }

        // Poll Ultima Lectura (1.5s requirement)
        const scanRes = await fetch('/api/ultima-lectura');
        if (scanRes.ok) {
          const scan: Lectura | null = await scanRes.json();

          if (scan && scan.id) {
            // First load: just sync last id without popping up alert
            if (isFirstLoadRef.current) {
              lastLecturaIdRef.current = scan.id;
              isFirstLoadRef.current = false;
              return;
            }

            // New scan detected!
            if (lastLecturaIdRef.current !== scan.id) {
              lastLecturaIdRef.current = scan.id;

              // Save latest state for registration assistance
              setLastLecturaState({
                estado: scan.estado,
                nombre: scan.nombre || null,
                uid: scan.uid
              });

              // Play appropriate sound
              playScanSound(scan.estado as any);

              // Behavior depends on system mode:
              // Rule: "Si el modo es 'registro', mostrar un banner naranja bien visible y NO mostrar estas pantallas como asistencia."
              if (modoInfo.modo === 'asistencia') {
                setActiveKioskLectura(scan);
                // Refresh attendance list so new row appears immediately
                fetchAsistencias();
                fetchStats();
              }
            }
          }
        }
      } catch (err) {
        // Network polling error - safely continue
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [modoInfo.modo, fetchAsistencias, fetchStats]);

  // Handle Mode Controls
  const handleActivateModoRegistro = async () => {
    try {
      const res = await fetch('/api/modo/registro', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setModoInfo({ modo: 'registro', segundos_restantes: 60 });
        setPendingCardUid(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelModoRegistro = async () => {
    try {
      const res = await fetch('/api/modo/asistencia', { method: 'POST' });
      if (res.ok) {
        setModoInfo({ modo: 'asistencia', segundos_restantes: 0 });
        setPendingCardUid(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearPendingCard = async () => {
    try {
      await fetch('/api/tarjeta-pendiente/limpiar', { method: 'POST' });
      setPendingCardUid(null);
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger simulated scan from Simulator Bar
  const handleTriggerSimulatedScan = async (uid: string, salon: string) => {
    const res = await fetch('/api/lectura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, salon })
    });
    const json = await res.json();
    return json;
  };

  // Handle Tab Navigation with simple password protection
  const handleSelectTab = (tab: 'asistencia' | 'estudiantes' | 'hardware') => {
    if (tab === 'estudiantes' && !isAdminAuth) {
      setPendingAction('estudiantes');
      setShowAuthModal(true);
      return;
    }
    setCurrentTab(tab);
  };

  // Open Settings with password protection
  const handleOpenSettings = () => {
    if (!isAdminAuth) {
      setPendingAction('ajustes');
      setShowAuthModal(true);
      return;
    }
    setShowSettingsModal(true);
  };

  const handleAuthSuccess = () => {
    setIsAdminAuth(true);
    setShowAuthModal(false);
    if (pendingAction === 'estudiantes') {
      setCurrentTab('estudiantes');
      setPendingAction(null);
    } else if (pendingAction === 'ajustes') {
      setShowSettingsModal(true);
      setPendingAction(null);
    }
  };

  // Save Settings handler
  const handleSaveSettings = async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    try {
      const res = await fetch('/api/app-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setAppSettings(data.settings);
        fetchSalones();
        fetchAsistencias();
        fetchStats();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error saving settings:', err);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* 5-second Big Kiosk Overlay for incoming card scans */}
      <AttendanceKioskOverlay
        lectura={activeKioskLectura}
        onClose={() => setActiveKioskLectura(null)}
        appSettings={appSettings}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={showAuthModal}
        onSuccess={handleAuthSuccess}
        onCancel={() => {
          setShowAuthModal(false);
          setPendingAction(null);
        }}
      />

      {/* General Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentSettings={appSettings}
        onSaveSettings={handleSaveSettings}
        onLogoUploaded={(newLogoUrl) => {
          setAppSettings((prev) => ({ ...prev, logo_url: newLogoUrl }));
        }}
      />

      {/* Parent Notifications & WhatsApp Center Modal */}
      <ParentNotificationsModal
        isOpen={showParentNotificationsModal}
        onClose={() => setShowParentNotificationsModal(false)}
        students={students}
      />

      {/* Email SMTP Configuration & Testing Modal */}
      <EmailConfigModal
        isOpen={showEmailConfigModal}
        onClose={() => setShowEmailConfigModal(false)}
      />

      {/* Main School Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        modoInfo={modoInfo}
        onCancelModoRegistro={handleCancelModoRegistro}
        showSimulator={false}
        onToggleSimulator={() => setShowSimulator(false)}
        pendingCardUid={pendingCardUid}
        onOpenParentNotifications={() => setShowParentNotificationsModal(true)}
        onOpenEmailConfig={() => setShowEmailConfigModal(true)}
        appSettings={appSettings}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {currentTab === 'asistencia' && (
          <AttendanceView
            asistencias={asistencias}
            stats={stats}
            salones={salones}
            students={students}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            selectedSalon={selectedSalon}
            onSalonChange={setSelectedSalon}
            onRefresh={() => {
              fetchAsistencias();
              fetchStats();
            }}
            isLoading={isLoadingAsistencias}
            appSettings={appSettings}
          />
        )}

        {currentTab === 'estudiantes' && (
          <StudentsView
            students={students}
            modoInfo={modoInfo}
            onActivateModoRegistro={handleActivateModoRegistro}
            onCancelModoRegistro={handleCancelModoRegistro}
            pendingCardUid={pendingCardUid}
            onClearPendingCard={handleClearPendingCard}
            onRefreshStudents={async () => {
              await fetchStudents();
              await fetchStats();
            }}
            lastLecturaState={lastLecturaState}
          />
        )}

        {currentTab === 'hardware' && <HardwareGuideModal />}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">Sistema de Asistencia RFID en Línea</span>
            <span>• Base de datos SQLite activa</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Node Express / Python Flask • Puerto 5000 (o 3000) • 0.0.0.0
          </div>
        </div>
      </footer>
    </div>
  );
}
