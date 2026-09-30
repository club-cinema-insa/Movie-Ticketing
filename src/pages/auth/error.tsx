import Link from "next/link";
import { useRouter } from "next/router";
import { branding } from "@/config/branding";

export default function AuthErrorPage() {
  const { query } = useRouter();
  const denied = query.error === "AccessDenied";

  return (
    <div className="mx-auto mt-20 max-w-md px-6 text-center">
      <h1 className="mb-3 text-2xl font-semibold">
        {denied ? "⛔ Accès refusé" : "Erreur de connexion"}
      </h1>
      <p className="mb-6 text-gray-600">
        {denied
          ? `Ce compte Discord n'est pas autorisé à accéder à l'espace administrateur de ${branding.appShortName}. Demandez à un administrateur de l'ajouter.`
          : "La connexion a échoué. Réessayez dans un instant."}
      </p>
      <Link
        href="/events"
        className="rounded bg-[var(--brand-primary)] px-4 py-2 text-white hover:bg-[var(--brand-secondary)]"
      >
        Retour aux événements
      </Link>
    </div>
  );
}
