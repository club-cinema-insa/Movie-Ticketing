import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { CalendarDays, CalendarPlus, CircleCheck, Clapperboard, Clock, DoorOpen, Download, MapPin } from "lucide-react";
import { db } from "@/server/db";
import { CANCEL_MESSAGES, cancelState, isValidCancelToken } from "@/server/tickets/cancel";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { TicketStub } from "@/components/ticket/TicketStub";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { buildIcs, downloadTextFile } from "@/lib/ics";
import { eventSchedule, formatDayWithYear } from "@/lib/format";

// Même forme que le code du QR code.
const TICKET_CODE_PATTERN = /^TICKET-[A-Z0-9]{8,16}$/;

type TicketPageProps =
  | { state: "gone" }
  | {
      state: "ok";
      ticket: { code: string; number: number | null; qrCode: string; participantName: string };
      event: { id: string; name: string; date: string; location: string | null };
      /** Jeton d'annulation, présent seulement s'il est valide. */
      token: string | null;
      /** Motif pour lequel l'annulation n'est plus possible (billet utilisé, séance commencée). */
      cancelBlocked: string | null;
    };

export const getServerSideProps: GetServerSideProps<TicketPageProps> = async (ctx) => {
  ctx.res.setHeader("Cache-Control", "private, no-store");
  ctx.res.setHeader("X-Robots-Tag", "noindex");

  const code = ctx.params?.code;
  if (typeof code !== "string" || !TICKET_CODE_PATTERN.test(code)) return { notFound: true };

  const ticket = await db.ticket.findUnique({
    where: { code },
    include: { event: true, participant: true },
  });
  if (!ticket) {
    ctx.res.statusCode = 404;
    return { props: { state: "gone" } };
  }

  const given = ctx.query.t;
  const token = typeof given === "string" && isValidCancelToken(code, given) ? given : null;
  const state = cancelState(ticket, ticket.event);

  return {
    props: {
      state: "ok",
      ticket: {
        code: ticket.code,
        number: ticket.number,
        qrCode: ticket.qrCode,
        participantName: ticket.participant.name,
      },
      event: {
        id: ticket.event.id,
        name: ticket.event.name,
        date: ticket.event.date.toISOString(),
        location: ticket.event.location,
      },
      token,
      cancelBlocked: token && state !== "allowed" ? CANCEL_MESSAGES[state] : null,
    },
  };
};

function Gone() {
  return (
    <PublicLayout title="Réservation introuvable" noindex>
      <div className="mx-auto max-w-lg px-4 pt-16">
        <EmptyState
          icon={Clapperboard}
          title="Réservation introuvable"
          description="Ce billet n’existe pas ou la réservation a été annulée. Vous pouvez réserver une autre place."
          action={
            <Button asChild>
              <Link href="/events">Voir les séances</Link>
            </Button>
          }
        />
      </div>
    </PublicLayout>
  );
}

export default function TicketPage(props: TicketPageProps) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState("");

  if (props.state === "gone") return <Gone />;
  const { ticket, event, token, cancelBlocked } = props;

  const schedule = eventSchedule(event.date);

  if (cancelled) {
    return (
      <PublicLayout title="Réservation annulée" noindex>
        <div className="mx-auto max-w-lg px-4 pt-16">
          <EmptyState
            icon={CircleCheck}
            title="Réservation annulée"
            description={`Votre place pour « ${event.name} » est libérée et votre QR code n’est plus valable. Merci de nous avoir prévenus.`}
            action={
              <Button asChild>
                <Link href="/events">Voir les séances</Link>
              </Button>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  const cancelReservation = async () => {
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticket.code}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok || res.status === 404) {
        setCancelled(true);
        return;
      }
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "L’annulation a échoué. Réessayez.");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  const addToCalendar = () => {
    const details = schedule.doors
      ? `Ouverture des portes à ${schedule.doors}, ${schedule.startLabel.toLowerCase()} à ${schedule.start}.`
      : `Séance à ${schedule.start}.`;
    downloadTextFile(
      "seance.ics",
      buildIcs({ id: event.id, title: event.name, start: new Date(event.date), location: event.location, description: details }),
    );
  };

  return (
    <PublicLayout title="Votre billet" noindex>
      <div className="mx-auto max-w-md space-y-5 px-4 pt-6 sm:pt-10">
        <div>
          <h1 className="text-3xl font-extrabold">Votre billet</h1>
          <p className="mt-1 text-[0.95rem] text-subtle">Présentez ce QR code à l’entrée, sur votre téléphone ou imprimé.</p>
        </div>

        <TicketStub ticket={ticket} eventName={event.name} />

        <ul className="space-y-2.5 rounded-2xl border border-line bg-surface p-4 text-[0.95rem] shadow-card">
          <li className="flex items-center gap-3">
            <CalendarDays className="size-5 shrink-0 text-brand" aria-hidden />
            <span className="first-letter:uppercase">{formatDayWithYear(event.date)}</span>
          </li>
          {schedule.doors ? (
            <li className="flex items-center gap-3">
              <DoorOpen className="size-5 shrink-0 text-brand" aria-hidden />
              <span>
                Portes à {schedule.doors}, {schedule.startLabel.toLowerCase()} à {schedule.start}
              </span>
            </li>
          ) : (
            <li className="flex items-center gap-3">
              <Clock className="size-5 shrink-0 text-brand" aria-hidden />
              <span>{schedule.start}</span>
            </li>
          )}
          {event.location && (
            <li className="flex items-center gap-3">
              <MapPin className="size-5 shrink-0 text-brand" aria-hidden />
              <span>{event.location}</span>
            </li>
          )}
        </ul>

        <div className="grid gap-2.5">
          <Button asChild size="lg" block>
            <a href={`/api/tickets/${ticket.code}/pdf`} download>
              <Download aria-hidden />
              Télécharger le billet (PDF)
            </a>
          </Button>
          <Button variant="secondary" size="lg" block onClick={addToCalendar}>
            <CalendarPlus aria-hidden />
            Ajouter au calendrier
          </Button>
        </div>

        {token && (
          <Card className="p-5">
            <h2 className="text-lg font-bold">Un empêchement ?</h2>
            {cancelBlocked ? (
              <p className="mt-1 text-sm text-subtle">{cancelBlocked}</p>
            ) : (
              <>
                <p className="mt-1 text-sm text-subtle">
                  Libérez votre place pour un autre étudiant. L’annulation est possible jusqu’à l’ouverture des portes.
                </p>
                {error && (
                  <Alert tone="danger" className="mt-3">
                    {error}
                  </Alert>
                )}
                <Button variant="danger-soft" block className="mt-4" onClick={() => setConfirming(true)}>
                  Annuler ma réservation
                </Button>
              </>
            )}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Annuler votre réservation ?"
        description={`Votre place pour « ${event.name} » sera libérée et ce QR code ne sera plus valable. Vous pourrez réserver à nouveau s’il reste de la place.`}
        confirmLabel="Oui, annuler"
        cancelLabel="Garder ma place"
        loading={cancelling}
        onConfirm={cancelReservation}
      />
    </PublicLayout>
  );
}
