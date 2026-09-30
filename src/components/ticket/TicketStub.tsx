import { UserRound } from "lucide-react";
import { branding } from "@/config/branding";
import { Badge } from "@/components/ui/badge";

export type TicketStubData = {
  code: string;
  number: number | null;
  qrCode: string;
  participantName: string;
};

/** Le billet, tel que l'étudiant le présentera à l'entrée. */
export function TicketStub({ ticket, eventName }: { ticket: TicketStubData; eventName: string }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-pop ring-1 ring-line">
      <div className="flex items-center gap-3 bg-brand-strong px-5 py-4 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={branding.logoUrl} alt="" width={36} height={36} className="size-9 rounded-lg ring-1 ring-white/30" />
        <span className="font-display font-bold">{branding.appShortName}</span>
        {ticket.number !== null && (
          <Badge tone="inverse" className="ml-auto">
            Billet n°{ticket.number}
          </Badge>
        )}
      </div>

      <div className="h-[3px] bg-accent" aria-hidden />

      <div className="px-5 pt-5">
        <p className="font-display text-xl font-bold leading-tight">{eventName}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-subtle">
          <UserRound className="size-4" aria-hidden />
          {ticket.participantName}
        </p>
      </div>

      <div className="relative my-5" aria-hidden>
        <span className="absolute -left-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-canvas" />
        <span className="absolute -right-3 top-1/2 size-6 -translate-y-1/2 rounded-full bg-canvas" />
        <div className="mx-6 border-t-2 border-dashed border-line-strong" />
      </div>

      <div className="flex flex-col items-center px-5 pb-6">
        <div className="rounded-2xl border border-line bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ticket.qrCode}
            alt={`QR code du billet ${ticket.code}`}
            width={224}
            height={224}
            className="size-56 [image-rendering:pixelated]"
          />
        </div>
        <p className="mt-3 font-mono text-sm font-semibold tracking-wider text-ink/80">{ticket.code}</p>
      </div>
    </div>
  );
}
