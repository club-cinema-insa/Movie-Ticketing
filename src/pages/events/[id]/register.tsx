// src/pages/events/[id]/register.tsx
import { useState } from "react";
import type { GetServerSideProps } from "next";
import { db } from "@/server/db";
import { branding } from "@/config/branding";
import BrandHeader from "@/components/branding/BrandHeader";
import BrandFooter from "@/components/branding/BrandFooter";

type EventPageProps = {
  event: {
    id: string;
    name: string;
    date: string;
    location?: string | null;
    description?: string | null;
    image?: string | null;
    logoUrl?: string | null;
  } | null;
};

export const getServerSideProps: GetServerSideProps<EventPageProps> = async (
  ctx,
) => {
  const id = ctx.params?.id as string | undefined;

  if (!id) {
    return { notFound: true };
  }

  const event = await db.event.findUnique({
    where: { id },
  });

  if (!event || event.show === false) {
    // si tu veux permettre l'inscription même quand show = false, enlève ce check
    return { notFound: true };
  }

  return {
    props: {
      event: {
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        location: event.location ?? null,
        description: event.description ?? null,
        image: event.image ?? null,
        logoUrl: event.logoUrl ?? null,
      },
    },
  };
};

export default function RegisterPage({ event }: EventPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketData, setTicketData] = useState<any>(null);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Événement introuvable</h1>
          <p className="text-gray-600">
            Cet événement n’existe pas ou n’est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/events/${event.id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      setTicketData(data);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setError("Une erreur est survenue, veuillez réessayer.");
    }
  };

  const handleDownload = () => {
    if (!ticketData?.pdfBase64) return;

    const byteCharacters = atob(ticketData.pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: "application/pdf",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = ticketData.ticket.eventName
      ? ticketData.ticket.eventName.replace(/\s+/g, "_")
      : "ticket";
    a.download = `${safeName}_ticket.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <BrandHeader />
        {/* En-tête événement */}
        <div className="bg-white shadow rounded-2xl overflow-hidden border border-slate-200">
          {event.image && (
            <div className="h-56 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={event.image}
                alt={`Affiche de l’événement ${event.name}`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-6 md:p-8 flex flex-col gap-4 md:flex-row md:items-start">
            {event.logoUrl && (
              <div className="flex-shrink-0 flex items-center justify-center md:mr-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.logoUrl}
                  alt={`Logo ${event.name}`}
                  className="w-20 h-20 object-contain rounded-lg border border-slate-200 bg-white p-2"
                />
              </div>
            )}

            <div className="flex-1 space-y-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                {event.name}
              </h1>

              <div className="flex flex-col gap-1 text-sm text-slate-700">
                <p>
                  📅 <span className="font-medium">{formattedDate}</span>
                </p>
                <p>
                  ⏰ <span className="font-medium">{formattedTime}</span>
                </p>
                {event.location && (
                  <p>
                    📍 <span className="font-medium">{event.location}</span>
                  </p>
                )}
              </div>

              {event.description && (
                <p className="text-slate-700 text-sm leading-relaxed border-t border-slate-200 pt-3">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bloc inscription / confirmation */}
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {/* Formulaire ou confirmation */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
            {!ticketData ? (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  📝 Inscription à l’événement
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)]"
                      placeholder="Votre nom"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Adresse e-mail
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-[var(--brand-primary)]"
                      placeholder="vous@example.com"
                      required
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex justify-center items-center gap-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)] text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? "Inscription en cours..." : "S’inscrire"}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4">
                <h2 className="text-xl font-semibold">
                  🎟️ Votre inscription est confirmée
                </h2>
                <p className="text-sm text-slate-700">
                  Bonjour{" "}
                  <strong>{ticketData.ticket.participantName}</strong>,<br />
                  Votre ticket pour{" "}
                  <strong>{ticketData.ticket.eventName}</strong> a été
                  enregistré.
                </p>

                {ticketData.reused && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    ⚠ Vous aviez déjà un billet pour cet événement, nous vous
                    avons renvoyé le même ticket.
                  </p>
                )}

                {ticketData.emailSent ? (
                  <p className="text-xs text-slate-600">
                    Un e-mail a été envoyé à{" "}
                    <strong>{ticketData.ticket.participantEmail}</strong> avec
                    votre billet en pièce jointe.
                  </p>
                ) : (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    L’e-mail n’a pas pu être envoyé : téléchargez votre billet
                    ci-dessous et conservez-le. Vous pouvez aussi vous
                    réinscrire avec la même adresse pour le récupérer.
                  </p>
                )}

                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm"
                >
                  Télécharger mon ticket PDF
                </button>
              </div>
            )}
          </div>

          {/* Petit récap / “infos pratiques” */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold">ℹ️ Informations pratiques</h2>
            <ul className="text-sm text-slate-700 space-y-2">
              <li>
                ✅ Merci de venir avec votre{" "}
                <span className="font-medium">ticket PDF</span> (sur
                votre téléphone).
              </li>
              <li>
                ⏱️ Pensez à arriver quelques minutes en avance pour faciliter
                l’accueil.
              </li>
              {event.location && (
                <li>
                  📍 Lieu : <span className="font-medium">{event.location}</span>
                </li>
              )}
              {branding.eventTermsText && (
                <li>📌 {branding.eventTermsText}</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      <BrandFooter />
    </div>
  );
}
