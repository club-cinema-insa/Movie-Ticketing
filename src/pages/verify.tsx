import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { useSession } from "next-auth/react";
import {
  Camera,
  Check,
  CircleHelp,
  QrCode,
  Search,
  Square,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDayTimeShort } from "@/lib/format";
import { cn } from "@/lib/utils";

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

const FLASH_STYLES: Record<FlashKind, { bg: string; text: string; badge: string; icon: LucideIcon }> = {
  valid: { bg: "bg-success", text: "text-white", badge: "text-success", icon: Check },
  used: { bg: "bg-danger", text: "text-white", badge: "text-danger", icon: X },
  wrong: { bg: "bg-accent", text: "text-ink", badge: "text-accent-strong", icon: TriangleAlert },
  unknown: { bg: "bg-danger", text: "text-white", badge: "text-danger", icon: CircleHelp },
  error: { bg: "bg-ink", text: "text-white", badge: "text-ink", icon: TriangleAlert },
};

const HISTORY_STYLES: Record<FlashKind, string> = {
  valid: "bg-success-soft text-success",
  used: "bg-danger-soft text-danger",
  wrong: "bg-accent-soft text-[#7a4300]",
  unknown: "bg-danger-soft text-danger",
  error: "bg-muted text-subtle",
};

const formatTime = (value: Date) =>
  value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

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

function VerifyContent() {
  const { status } = useSession();

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
        // Lien direct depuis la liste des inscrits : /verify?event=<id>
        const requested = new URLSearchParams(window.location.search).get("event");
        if (requested && options.some((event) => event.id === requested)) return requested;
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
    div.className = "size-full";
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
              sub: name ? `Billet ${/^[aeiouyàâäéèêëîïôöùûüh]/i.test(name) ? "d’" : "de "}${name}` : undefined,
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
        console.error("Erreur de vérification du billet :", error);
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

    // La bibliothèque de lecture (~110 Ko) n'est chargée qu'au premier démarrage de la caméra.
    const { Html5Qrcode } = await import("html5-qrcode");
    if (scannerRef.current || !cameraWantedRef.current) return;
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

  const progress = selected && selected.issued > 0 ? Math.min(100, (selected.checkedIn / selected.issued) * 100) : 0;
  const flashStyle = flash ? FLASH_STYLES[flash.kind] : null;
  const FlashIcon = flashStyle?.icon;

  return (
    <>
      {/* Retour plein écran après chaque vérification */}
      {flash && flashStyle && FlashIcon && (
        <button
          type="button"
          onClick={() => setFlash(null)}
          aria-live="assertive"
          className={cn(
            "fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 px-6 text-center",
            flashStyle.bg,
            flashStyle.text,
          )}
        >
          <span className={cn("flex size-36 items-center justify-center rounded-full bg-white shadow-pop", flashStyle.badge)}>
            <FlashIcon className="size-20" strokeWidth={3} aria-hidden />
          </span>
          <span className="font-display text-4xl font-extrabold tracking-wide">{flash.title}</span>
          {flash.detail && <span className="max-w-full break-words text-2xl font-semibold">{flash.detail}</span>}
          {flash.sub && <span className="text-lg opacity-90">{flash.sub}</span>}
          <span className="mt-6 text-sm opacity-70">Touchez l’écran pour continuer</span>
        </button>
      )}

      <PageHeader title="Contrôle" description="Scannez les billets à l’entrée de la salle." />

      <div className="space-y-5">
        {/* Séance contrôlée */}
        <Card className="p-4 sm:p-5">
          <Field label="Séance contrôlée" htmlFor="event-select">
            <Select
              id="event-select"
              value={selectedId ?? ""}
              onChange={(e) => selectEvent(e.target.value)}
              disabled={events.length === 0}
            >
              {events.length === 0 && <option value="">Aucune séance</option>}
              {[...events]
                .sort(
                  (a, b) =>
                    Math.abs(new Date(a.date).getTime() - Date.now()) - Math.abs(new Date(b.date).getTime() - Date.now()),
                )
                .map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} — {formatDayTimeShort(event.date)}
                  </option>
                ))}
            </Select>
          </Field>

          {selected && (
            <div className="mt-5">
              <div className="flex items-end justify-between gap-3">
                <p className="font-display text-5xl font-extrabold leading-none tabular">
                  {selected.checkedIn}
                  <span className="ml-1.5 text-2xl font-semibold text-subtle">/ {selected.issued}</span>
                </p>
                <p className="pb-1 text-sm font-semibold text-subtle">
                  {Math.max(0, selected.issued - selected.checkedIn)} restant{selected.issued - selected.checkedIn > 1 ? "s" : ""}
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-success transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-subtle">
                billets contrôlés sur billets émis{selected.location ? ` · ${selected.location}` : ""}
              </p>
            </div>
          )}
        </Card>

        {/* Caméra */}
        <section className="space-y-3" aria-label="Scanner">
          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-3xl bg-ink shadow-card">
            <div id="scanner-container" className="absolute inset-0 [&_video]:size-full [&_video]:object-cover" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center text-white">
                <QrCode className="size-16 text-white/60" aria-hidden />
                <div>
                  <p className="font-display text-xl font-bold">Prêt à scanner</p>
                  <p className="mt-1 text-sm text-white/70">Le QR code du billet se lit directement avec la caméra.</p>
                </div>
                <Button size="lg" variant="cta" onClick={() => void startScanner()} disabled={!selected}>
                  <Camera aria-hidden />
                  Démarrer le scanner
                </Button>
              </div>
            )}
          </div>

          {cameraError && <Alert tone="danger">{cameraError}</Alert>}

          {scanning && (
            <Button size="lg" block variant="danger-soft" onClick={() => void handleStop()}>
              <Square aria-hidden />
              Arrêter le scanner
            </Button>
          )}
        </section>

        {/* Saisie manuelle */}
        <Card className="p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitManual();
            }}
            className="space-y-3"
          >
            <Field label="Saisir un code à la main" htmlFor="manual-code">
              <Input
                id="manual-code"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="TICKET-…"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
            <Button type="submit" variant="secondary" block loading={loading} disabled={!selected || !manualCode.trim()}>
              <Search aria-hidden />
              Vérifier
            </Button>
          </form>
        </Card>

        {/* Historique */}
        {history.length > 0 && (
          <section aria-labelledby="history-title">
            <h2 id="history-title" className="mb-3 text-lg font-bold">
              Derniers contrôles
            </h2>
            <Card>
              <ul className="divide-y divide-line">
                {history.map((item, index) => {
                  const Icon = FLASH_STYLES[item.kind].icon;
                  return (
                    <li key={`${item.code}-${index}`} className="flex items-center gap-3 p-3.5">
                      <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-full", HISTORY_STYLES[item.kind])}>
                        <Icon className="size-5" strokeWidth={2.6} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{item.detail || item.title}</p>
                        <p className="truncate text-xs text-subtle">
                          {item.title} · <span className="font-mono">{item.code}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs tabular text-subtle">{item.time}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}

export default function VerifyTicketPage() {
  return (
    <AdminLayout title="Contrôle" width="narrow">
      <VerifyContent />
    </AdminLayout>
  );
}
