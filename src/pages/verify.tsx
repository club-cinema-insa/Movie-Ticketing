import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { branding } from "@/config/branding";

type EventOption = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  issued: number;
  checkedIn: number;
};

type EventApiItem = {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  checkedInCount?: number;
  _count: { tickets: number };
};

type VerifyReason = "valid" | "already_used" | "wrong_event" | "not_found" | "forbidden";

type VerifyResponse = {
  valid?: boolean;
  reason?: VerifyReason;
  message?: string;
  error?: string;
  ticket?: {
    number?: number | null;
    participant?: { name: string };
    event?: { name: string };
    redeemedAt?: string | null;
  };
};

type FlashKind = "valid" | "used" | "wrong" | "unknown" | "error";

type Flash = { kind: FlashKind; title: string; detail: string; sub?: string };

type ScanResult = {
  code: string;
  kind: FlashKind;
  title: string;
  detail: string;
  time: string;
};

const READER_ID = "qr-reader";
const DUPLICATE_WINDOW_MS = 5000; // même code ignoré pendant 5 s
const RESTART_DELAY_MS = 2000; // le scanner repart 2 s après une vérification
const FLASH_DURATION_MS = 2200;
const POLL_INTERVAL_MS = 10000;
const STORAGE_KEY = "verify:eventId";
const MAX_HISTORY = 30;

const FLASH_STYLES: Record<FlashKind, { bg: string; badge: string; icon: string }> = {
  valid: { bg: "bg-green-600", badge: "text-green-600", icon: "✓" },
  used: { bg: "bg-red-600", badge: "text-red-600", icon: "✕" },
  wrong: { bg: "bg-amber-500", badge: "text-amber-600", icon: "!" },
  unknown: { bg: "bg-red-600", badge: "text-red-600", icon: "?" },
  error: { bg: "bg-gray-700", badge: "text-gray-700", icon: "!" },
};

const HISTORY_STYLES: Record<FlashKind, string> = {
  valid: "border-green-300 bg-green-50 text-green-800",
  used: "border-red-300 bg-red-50 text-red-800",
  wrong: "border-amber-300 bg-amber-50 text-amber-800",
  unknown: "border-red-300 bg-red-50 text-red-800",
  error: "border-gray-300 bg-gray-50 text-gray-700",
};

const formatTime = (value: Date) =>
  value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Séance la plus proche de maintenant : c'est presque toujours celle à contrôler. */
const pickDefaultEvent = (events: EventOption[]): string | null => {
  const now = Date.now();
  let best: EventOption | null = null;
  for (const event of events) {
    if (!best || Math.abs(new Date(event.date).getTime() - now) < Math.abs(new Date(best.date).getTime() - now)) {
      best = event;
    }
  }
  return best?.id ?? null;
};

/** Bip court (aigu = valide, grave = refusé) ; silencieux si le navigateur l'interdit. */
function beep(ok: boolean) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = ok ? 880 : 220;
    oscillator.type = ok ? "sine" : "square";
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (ok ? 0.12 : 0.35));
    oscillator.onended = () => void context.close();
  } catch {
    // Pas de son : le retour visuel suffit.
  }
}

export default function VerifyTicketPage() {
  const { data: session, status } = useSession();

  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });
  const selectedIdRef = useRef<string | null>(null);
  const cameraWantedRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const startScannerRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const selected = events.find((event) => event.id === selectedId) ?? null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // ── Séances ──
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      if (!res.ok) return;
      const data = (await res.json()) as EventApiItem[];
      const options = data.map<EventOption>((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        issued: event._count.tickets,
        checkedIn: event.checkedInCount ?? 0,
      }));
      setEvents(options);

      setSelectedId((current) => {
        if (current && options.some((event) => event.id === current)) return current;
        let stored: string | null = null;
        try {
          stored = window.localStorage.getItem(STORAGE_KEY);
        } catch {
          // stockage indisponible
        }
        if (stored && options.some((event) => event.id === stored)) return stored;
        return pickDefaultEvent(options);
      });
    } catch (error) {
      console.error("Erreur chargement des séances :", error);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void fetchEvents();
    // Plusieurs membres peuvent contrôler en même temps : on rafraîchit les compteurs.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void fetchEvents();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, fetchEvents]);

  const selectEvent = (id: string) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // stockage indisponible
    }
  };

  // ── Scanner ──
  const safeCreateReaderDiv = () => {
    const old = document.getElementById(READER_ID);
    if (old?.parentNode) old.parentNode.removeChild(old);
    const div = document.createElement("div");
    div.id = READER_ID;
    div.className =
      "w-full aspect-square max-w-sm rounded-2xl border bg-gray-100 shadow-inner overflow-hidden";
    document.getElementById("scanner-container")?.appendChild(div);
  };

  const releaseWakeLock = () => {
    void wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
  };

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // déjà arrêté
    } finally {
      scannerRef.current = null;
      setScanning(false);
      safeCreateReaderDiv();
    }
  }, []);

  const showFlash = useCallback((next: Flash) => {
    setFlash(next);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(null), FLASH_DURATION_MS);

    const ok = next.kind === "valid";
    beep(ok);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ok ? 120 : [200, 100, 200]);
    }
  }, []);

  // Le callback de la caméra est créé une seule fois : tout l'état lu ici passe par des refs.
  const handleVerify = useCallback(
    async (raw: string) => {
      const code = raw.trim().toUpperCase();
      if (!code || busyRef.current) return;

      const now = Date.now();
      if (code === lastScanRef.current.code && now - lastScanRef.current.time < DUPLICATE_WINDOW_MS) return;

      busyRef.current = true;
      lastScanRef.current = { code, time: now };
      setLoading(true);
      await stopScanner();

      let flashData: Flash;
      try {
        const res = await fetch("/api/tickets/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, eventId: selectedIdRef.current }),
        });
        const data = (await res.json()) as VerifyResponse;
        const name = data.ticket?.participant?.name ?? "";

        switch (data.reason) {
          case "valid":
            flashData = {
              kind: "valid",
              title: "VALIDE",
              detail: name,
              sub: data.ticket?.number ? `Billet n°${data.ticket.number}` : undefined,
            };
            break;
          case "already_used":
            flashData = {
              kind: "used",
              title: "DÉJÀ UTILISÉ",
              detail: name,
              sub: data.ticket?.redeemedAt
                ? `Validé à ${formatTime(new Date(data.ticket.redeemedAt))}`
                : undefined,
            };
            break;
          case "wrong_event":
            flashData = {
              kind: "wrong",
              title: "AUTRE SÉANCE",
              detail: data.ticket?.event?.name ?? "",
              sub: name ? `Billet de ${name}` : undefined,
            };
            break;
          case "not_found":
            flashData = { kind: "unknown", title: "BILLET INCONNU", detail: code };
            break;
          case "forbidden":
            flashData = { kind: "error", title: "NON AUTORISÉ", detail: "Vous ne pouvez pas contrôler ce billet." };
            break;
          default:
            flashData = { kind: "error", title: "ERREUR", detail: data.error ?? data.message ?? "Réponse inattendue." };
        }

        if (data.reason === "valid") {
          // Mise à jour immédiate du compteur ; le rafraîchissement périodique fait foi.
          setEvents((prev) =>
            prev.map((event) =>
              event.id === selectedIdRef.current ? { ...event, checkedIn: event.checkedIn + 1 } : event,
            ),
          );
        }
      } catch (error) {
        console.error("Erreur vérification ticket :", error);
        flashData = { kind: "error", title: "ERREUR RÉSEAU", detail: "Réessayez : le billet n'a pas été vérifié." };
        // Autorise un nouvel essai immédiat du même code.
        lastScanRef.current = { code: "", time: 0 };
      }

      showFlash(flashData);
      setHistory((prev) =>
        [
          { code, kind: flashData.kind, title: flashData.title, detail: flashData.detail, time: formatTime(new Date()) },
          ...prev,
        ].slice(0, MAX_HISTORY),
      );

      busyRef.current = false;
      setLoading(false);

      if (cameraWantedRef.current) {
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        restartTimerRef.current = setTimeout(() => void startScannerRef.current(), RESTART_DELAY_MS);
      }
    },
    [showFlash, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;
    cameraWantedRef.current = true;
    setCameraError("");
    safeCreateReaderDiv();

    const html5QrCode = new Html5Qrcode(READER_ID);
    scannerRef.current = html5QrCode;
    setScanning(true);
    try {
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => void handleVerify(decodedText),
        () => undefined,
      );
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        wakeLockRef.current = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        // écran non verrouillable : sans conséquence
      }
    } catch (error) {
      console.error("Impossible de démarrer le scanner :", error);
      scannerRef.current = null;
      setScanning(false);
      cameraWantedRef.current = false;
      setCameraError("Caméra inaccessible. Autorisez-la dans le navigateur ou saisissez le code à la main.");
    }
  }, [handleVerify]);

  useEffect(() => {
    startScannerRef.current = startScanner;
  }, [startScanner]);

  const handleStop = async () => {
    cameraWantedRef.current = false;
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    releaseWakeLock();
    await stopScanner();
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    safeCreateReaderDiv();
    return () => {
      cameraWantedRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      releaseWakeLock();
      void stopScanner();
    };
  }, [status, stopScanner]);

  const submitManual = () => {
    if (!manualCode.trim()) return;
    void handleVerify(manualCode);
    setManualCode("");
  };

  // ── Accès ──
  if (status === "loading") return <p className="mt-10 text-center">Chargement...</p>;

  if (!session)
    return (
      <div className="mt-20 text-center">
        <h1 className="mb-4 text-2xl font-semibold">🔒 Accès restreint</h1>
        <p className="mb-4 text-gray-600">Vous devez être connecté.</p>
        <button
          onClick={() => signIn("discord")}
          className="rounded bg-[var(--brand-primary)] px-4 py-2 text-white hover:bg-[var(--brand-secondary)]"
        >
          Se connecter avec Discord
        </button>
      </div>
    );

  const progress = selected && selected.issued > 0 ? Math.min(100, (selected.checkedIn / selected.issued) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      {/* Retour plein écran après chaque vérification */}
      {flash && (
        <button
          type="button"
          onClick={() => setFlash(null)}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 px-6 text-center text-white ${FLASH_STYLES[flash.kind].bg}`}
        >
          <span
            className={`flex h-32 w-32 items-center justify-center rounded-full bg-white text-8xl font-black leading-none ${FLASH_STYLES[flash.kind].badge}`}
          >
            {FLASH_STYLES[flash.kind].icon}
          </span>
          <span className="text-4xl font-extrabold tracking-wide">{flash.title}</span>
          {flash.detail && <span className="break-words text-2xl font-semibold">{flash.detail}</span>}
          {flash.sub && <span className="text-lg opacity-90">{flash.sub}</span>}
        </button>
      )}

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4">
        <header className="flex items-center justify-between">
          <div>
            <Link href="/admin/events" className="text-xs text-slate-500 hover:text-slate-800">
              ← Espace admin
            </Link>
            <h1 className="text-xl font-bold text-slate-800">Contrôle des billets</h1>
            <p className="text-xs text-slate-500">{branding.appShortName}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Déconnexion
          </button>
        </header>

        {/* Séance contrôlée */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <label htmlFor="event-select" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Séance contrôlée
          </label>
          <select
            id="event-select"
            value={selectedId ?? ""}
            onChange={(e) => selectEvent(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            disabled={events.length === 0}
          >
            {events.length === 0 && <option value="">Aucune projection</option>}
            {[...events]
              .sort(
                (a, b) =>
                  Math.abs(new Date(a.date).getTime() - Date.now()) -
                  Math.abs(new Date(b.date).getTime() - Date.now()),
              )
              .map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} — {formatEventDate(event.date)}
                </option>
              ))}
          </select>

          {selected && (
            <div className="mt-4">
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-slate-800">
                  {selected.checkedIn}
                  <span className="text-lg font-semibold text-slate-400"> / {selected.issued}</span>
                </p>
                <p className="text-sm text-slate-500">
                  {Math.max(0, selected.issued - selected.checkedIn)} restant(s)
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                billets contrôlés / émis{selected.location ? ` · ${selected.location}` : ""}
              </p>
            </div>
          )}
        </section>

        {/* Caméra */}
        <section className="flex flex-col items-center gap-3">
          <div id="scanner-container" className="flex w-full justify-center" />
          {cameraError && <p className="text-center text-sm text-red-600">{cameraError}</p>}
          {!scanning ? (
            <button
              onClick={() => void startScanner()}
              disabled={!selected}
              className="w-full rounded-xl bg-green-600 py-3 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              Démarrer le scanner
            </button>
          ) : (
            <button
              onClick={() => void handleStop()}
              className="w-full rounded-xl bg-red-600 py-3 text-lg font-semibold text-white hover:bg-red-700"
            >
              Arrêter le scanner
            </button>
          )}
        </section>

        {/* Saisie manuelle */}
        <section className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitManual();
            }}
            placeholder="Code du billet (TICKET-…)"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-center font-mono text-sm shadow-sm"
          />
          <button
            onClick={submitManual}
            disabled={loading || !selected}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "…" : "Vérifier"}
          </button>
        </section>

        {/* Historique */}
        {history.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Derniers contrôles</h2>
            {history.map((item, index) => (
              <div key={`${item.code}-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${HISTORY_STYLES[item.kind]}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-xs opacity-70">{item.time}</span>
                </div>
                <div className="truncate">{item.detail}</div>
                <div className="font-mono text-xs opacity-70">{item.code}</div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
