import { useCallback, useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { branding } from "@/config/branding";

type AdminUser = {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string | null;
  hasLoggedIn: boolean;
  eventsCount: number;
  isSelf: boolean;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers((await res.json()) as AdminUser[]);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void fetchUsers();
  }, [status, fetchUsers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'ajout.");
        return;
      }
      setDiscordId("");
      setName("");
      await fetchUsers();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    const label = user.name ?? user.discordId ?? "ce compte";
    if (!confirm(`Retirer l'accès de ${label} ? Cette personne sera déconnectée.`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchUsers();
    } else {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "Erreur lors de la suppression.");
    }
  };

  if (status === "loading") return <p className="text-center mt-10">Chargement...</p>;

  if (!session)
    return (
      <div className="text-center mt-20">
        <h1 className="text-2xl font-semibold mb-4">🔒 Accès restreint</h1>
        <button
          onClick={() => signIn("discord")}
          className="bg-[var(--brand-primary)] text-white px-4 py-2 rounded hover:bg-[var(--brand-secondary)]"
        >
          Se connecter avec Discord
        </button>
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto mt-10 px-4">
      <Link href="/admin/events" className="text-sm text-gray-600 hover:text-gray-900">
        ← Retour aux événements
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-gray-800">
        👥 Accès administrateurs — {branding.appShortName}
      </h1>
      <p className="mt-1 text-gray-600">
        Seuls les comptes Discord listés ici peuvent se connecter à l&apos;espace
        administrateur.
      </p>

      <form
        onSubmit={handleAdd}
        className="mt-6 rounded-lg border bg-white p-4 shadow-sm space-y-3"
      >
        <h2 className="font-semibold text-gray-800">Autoriser un compte Discord</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Identifiant Discord (ex. 252232868128882688)"
            inputMode="numeric"
            required
            className="rounded border px-3 py-2"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (facultatif)"
            maxLength={100}
            className="rounded border px-3 py-2"
          />
        </div>
        <p className="text-xs text-gray-500">
          Pour obtenir l&apos;identifiant : Discord → Paramètres → Avancés → Mode
          développeur, puis clic droit sur le profil → « Copier l&apos;identifiant ».
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-[var(--brand-primary)] px-4 py-2 text-white hover:bg-[var(--brand-secondary)] disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      <ul className="mt-6 space-y-2">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3 min-w-0">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-9 w-9 rounded-full border" />
              ) : (
                <div className="h-9 w-9 rounded-full border bg-gray-100" />
              )}
              <div className="min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {user.name ?? "Sans nom"}
                  {user.isSelf && (
                    <span className="ml-2 text-xs text-gray-500">(vous)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {user.discordId ?? "—"} •{" "}
                  {user.hasLoggedIn ? "déjà connecté" : "jamais connecté"} •{" "}
                  {user.eventsCount} événement(s)
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(user)}
              disabled={user.isSelf}
              title={user.isSelf ? "Vous ne pouvez pas retirer votre propre accès" : undefined}
              className="shrink-0 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
