import Link from "next/link";
import { ChevronRight, Ticket } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { formatDayShort } from "@/lib/format";
import { useSavedTickets } from "@/lib/savedTickets";

/**
 * Raccourci vers les billets gardés sur cet appareil. Sans `eventId` : la liste de tous les billets ;
 * avec : un simple lien pour cette séance. Rien ne s'affiche tant qu'aucun billet n'est enregistré.
 */
export function MyTickets({ eventId, className }: { eventId?: string; className?: string }) {
  const tickets = useSavedTickets().filter((t) => !eventId || t.eventId === eventId);
  const first = tickets[0];
  if (!first) return null;

  if (eventId) {
    return (
      <Alert className={className}>
        Vous avez déjà un billet pour cette séance.{" "}
        <Link href={`/billet/${first.code}`} className="font-semibold text-brand underline underline-offset-2">
          Voir mon billet
        </Link>
      </Alert>
    );
  }

  return (
    <Card className={className}>
      <h2 className="flex items-center gap-2 px-4 pt-4 text-lg font-bold sm:px-5">
        <Ticket className="size-5 text-brand" aria-hidden />
        {tickets.length > 1 ? "Mes billets" : "Mon billet"}
      </h2>
      <ul className="divide-y divide-line px-2 pb-2 pt-1">
        {tickets.map((t) => (
          <li key={t.code}>
            <Link href={`/billet/${t.code}`} className="flex items-center gap-3 rounded-xl px-2.5 py-3 hover:bg-brand-tint">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.eventName}</span>
                <span className="block text-sm text-subtle first-letter:uppercase">{formatDayShort(t.date)}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
