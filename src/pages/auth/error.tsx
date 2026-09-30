import Link from "next/link";
import { useRouter } from "next/router";
import { CircleAlert, ShieldX } from "lucide-react";
import { branding } from "@/config/branding";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AuthErrorPage() {
  const { query, isReady } = useRouter();
  const denied = query.error === "AccessDenied";
  const Icon = denied ? ShieldX : CircleAlert;

  return (
    <PublicLayout title={denied ? "Accès refusé" : "Connexion impossible"}>
      <div className="mx-auto max-w-md px-4 pt-12 sm:pt-20">
        <Card className="p-7 text-center sm:p-9">
          <span
            className={`mx-auto mb-5 inline-flex size-16 items-center justify-center rounded-2xl ${
              denied ? "bg-danger-soft text-danger" : "bg-warning-soft text-[#8a6100]"
            }`}
          >
            <Icon className="size-8" aria-hidden />
          </span>
          {isReady && (
            <>
              <h1 className="text-2xl font-extrabold">{denied ? "Accès refusé" : "Connexion impossible"}</h1>
              <p className="mt-2 text-[0.95rem] text-subtle">
                {denied
                  ? `Ce compte Discord n’est pas autorisé à accéder à l’espace bureau de ${branding.appShortName}. Demandez à un membre du bureau de l’ajouter.`
                  : "La connexion a échoué. Réessayez dans un instant."}
              </p>
            </>
          )}
          <Button asChild block className="mt-6">
            <Link href="/events">Retour aux séances</Link>
          </Button>
        </Card>
      </div>
    </PublicLayout>
  );
}
