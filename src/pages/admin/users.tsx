import { useCallback, useEffect, useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { PageSpinner } from "@/components/ui/spinner";

type AdminUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  hasLoggedIn: boolean;
  eventsCount: number;
  isSelf: boolean;
};

function Avatar({ user }: { user: AdminUser }) {
  if (user.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.image} alt="" className="size-11 shrink-0 rounded-full ring-1 ring-line" />;
  }
  const initials = (user.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
      {initials}
    </span>
  );
}

function UsersContent() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<AdminUser | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(String(res.status));
      setUsers((await res.json()) as AdminUser[]);
    } catch {
      setLoadError("Impossible de charger la liste. Rechargez la page.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAdding(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setAddError(data.error ?? "L’ajout a échoué. Réessayez.");
        return;
      }
      setDiscordId("");
      setName("");
      await load();
    } catch {
      setAddError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    setRemoveError("");
    try {
      const res = await fetch(`/api/admin/users/${toRemove.id}`, { method: "DELETE" });
      if (res.ok) {
        setToRemove(null);
        await load();
      } else {
        const data = (await res.json()) as { error?: string };
        setToRemove(null);
        setRemoveError(data.error ?? "Le retrait a échoué. Réessayez.");
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Accès au bureau"
        description="Seuls les comptes Discord listés ici peuvent se connecter à l’espace bureau."
      />

      <Card className="mb-8 p-5 sm:p-6">
        <h2 className="text-lg font-bold">Autoriser un compte</h2>
        <form onSubmit={handleAdd} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Identifiant Discord" htmlFor="discord-id">
              <Input
                id="discord-id"
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="252232868128882688"
                required
              />
            </Field>
            <Field label="Nom" htmlFor="user-name" optional>
              <Input
                id="user-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="Camille"
              />
            </Field>
          </div>
          <p className="text-sm text-subtle">
            Pour trouver l’identifiant : dans Discord, ouvrez Paramètres, Avancés, activez le mode développeur, puis faites un clic
            droit sur le profil et choisissez « Copier l’identifiant utilisateur ».
          </p>
          {addError && <Alert tone="danger">{addError}</Alert>}
          <Button type="submit" loading={adding}>
            <UserPlus aria-hidden />
            Autoriser
          </Button>
        </form>
      </Card>

      <section aria-labelledby="users-title">
        <h2 id="users-title" className="mb-4 text-xl font-bold">
          Comptes autorisés
          {users && <span className="ml-2 text-base font-semibold text-subtle">({users.length})</span>}
        </h2>

        {removeError && (
          <Alert tone="danger" className="mb-4">
            {removeError}
          </Alert>
        )}

        {!users ? (
          loadError ? (
            <Alert tone="danger">{loadError}</Alert>
          ) : (
            <PageSpinner />
          )
        ) : (
          <ul className="space-y-3">
            {users.map((user) => (
              <li key={user.id}>
                <Card className="flex items-center gap-3.5 p-3.5 sm:p-4">
                  <Avatar user={user} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{user.name ?? "Sans nom"}</span>
                      {user.isSelf && <Badge tone="brand">Vous</Badge>}
                    </p>
                    <p className="truncate font-mono text-xs text-subtle">{user.discordId ?? "Identifiant inconnu"}</p>
                    <p className="mt-0.5 text-sm text-subtle">
                      {user.hasLoggedIn ? "S’est déjà connecté" : "Jamais connecté"} · {user.eventsCount} séance
                      {user.eventsCount > 1 ? "s" : ""} créée{user.eventsCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="danger-soft"
                    disabled={user.isSelf}
                    aria-label={user.isSelf ? "Vous ne pouvez pas retirer votre propre accès" : `Retirer l’accès de ${user.name ?? "ce compte"}`}
                    title={user.isSelf ? "Vous ne pouvez pas retirer votre propre accès" : "Retirer l’accès"}
                    onClick={() => setToRemove(user)}
                  >
                    <UserMinus aria-hidden />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toRemove !== null}
        onOpenChange={(open) => !open && setToRemove(null)}
        title={`Retirer l’accès de ${toRemove?.name ?? "ce compte"} ?`}
        description="Cette personne sera déconnectée tout de suite et ne pourra plus accéder à l’espace bureau."
        confirmLabel="Retirer l’accès"
        loading={removing}
        onConfirm={confirmRemove}
      />
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminLayout title="Accès au bureau">
      <UsersContent />
    </AdminLayout>
  );
}
