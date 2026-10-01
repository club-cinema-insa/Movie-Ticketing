# Club Ciné INSA — billetterie

Application de réservation gratuite pour les séances du club : les étudiants réservent leur place et reçoivent un billet avec QR code (PDF, e-mail facultatif), le bureau gère les séances et contrôle les billets à l’entrée.

## Fonctionnalités

- **Site public** : liste des séances, réservation en quelques secondes, billet PDF téléchargeable, ajout à l’agenda.
- **Espace bureau** (connexion Discord, réservé aux comptes autorisés) :
  - création, modification, publication et suppression des séances (préremplies à partir de la dernière), avec envoi de l’affiche depuis le formulaire (réduite dans le navigateur puis stockée dans la base, sans service externe) ;
  - liste des réservations : recherche, validation manuelle, annulation, ajout, export CSV ;
  - gestion des comptes Discord autorisés (page « Accès ») ;
  - historique des actions du bureau (qui a créé, modifié, publié, supprimé ou annulé quoi), conservé 12 mois.
- **Annulation par l’étudiant** : lien dans l’e-mail (et sur la page de confirmation) vers `/billet/<code>`, valable jusqu’à l’ouverture des portes.
- **Contrôle** : scanner de QR codes par séance, anti double-scan, compteur de présents.
- **Identité** : couleurs, logo et textes se règlent dans `src/config/branding/` (variable `NEXT_PUBLIC_BRAND`).

## Stack

Next.js 15 (Pages Router pour les pages, App Router pour l’API d’administration) · React 19 · TypeScript · Tailwind CSS 4 · Prisma + PostgreSQL (Supabase) · NextAuth (Discord) · pdfkit · nodemailer · html5-qrcode.

## Démarrer en local

```bash
npm install
cp .env.example .env     # puis renseigner les valeurs
npx prisma db push       # crée les tables
npm run dev
```

Variables obligatoires : `DATABASE_URL`, `AUTH_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`. Pour amorcer un environnement vide, listez des identifiants Discord dans `INITIAL_ADMIN_DISCORD_IDS`. Les autres variables (partage des séances entre admins, SMTP) sont décrites dans `.env.example`.

## Vérifications

```bash
npm run check   # ESLint + TypeScript (le build échoue aussi en cas d’erreur)
```

GitHub Actions rejoue cette vérification et le build à chaque envoi (`.github/workflows/ci.yml`).

## Déploiement

Vercel, région `cdg1` (Paris), branche `main` uniquement (`vercel.json`). `NEXT_PUBLIC_BRAND=clubcine` pour l’identité du club.

## Données personnelles

- La page `/confidentialite` explique ce qui est collecté (nom, e-mail) et pour combien de temps.
- Chaque lundi à 3 h, Vercel appelle `/api/cron/purge` : les participants dont toutes les séances datent de plus de `RETENTION_MONTHS` (`src/config/retention.ts`, 12 mois) sont anonymisés. Leurs billets restent, donc les statistiques aussi. Les participants sans billet (réservation annulée) sont supprimés après le même délai.
- Pour l’activer : définir `CRON_SECRET` (16 caractères minimum) dans les variables d’environnement Vercel. Sans lui, la route refuse tout appel.
- Pour voir ce qui serait effacé sans rien modifier : `curl -H "Authorization: Bearer $CRON_SECRET" "https://<site>/api/cron/purge?dryRun=1"`.

## Sauvegardes

Chaque dimanche, GitHub Actions exporte les données de l’application, les chiffre et les conserve 90 jours (`.github/workflows/backup.yml`, onglet Actions, artefact `sauvegarde-chiffree`). Le dépôt étant public, rien n’est stocké en clair.

Secrets à créer dans GitHub (Settings, Secrets and variables, Actions) :

- `BACKUP_DATABASE_URL` : chaîne de connexion « Session pooler » de Supabase (le serveur d’exécution GitHub n’est pas en IPv6).
- `BACKUP_PASSPHRASE` : mot de passe de chiffrement. À garder dans un gestionnaire de mots de passe : sans lui, la sauvegarde est inutilisable.

Les sessions et jetons de connexion ne sont pas sauvegardés. Pour restaurer :

```bash
gpg --decrypt sauvegarde-AAAA-MM-JJ.dump.gpg | pg_restore --no-owner --clean --if-exists -d "<chaîne de connexion>"
```

## Annonces Discord

Quand une séance est publiée pour la première fois, le site crée une séance Discord (affiche, date, lieu) et poste dans le salon des annonces un message avec @everyone et le lien de cette séance. Modifier ou supprimer la séance met à jour ou supprime la séance Discord. Quand le dernier billet d'une séance est pris, une alerte (sans donnée personnelle) part dans un salon privé du bureau. Une panne de Discord n'empêche jamais de publier ou de réserver.

Mise en place (gratuite) :

1. Sur [discord.com/developers/applications](https://discord.com/developers/applications), créer une application, puis dans « Bot » générer un jeton (à copier tout de suite).
2. Inviter le bot sur le serveur : `https://discord.com/oauth2/authorize?client_id=<ID de l'application>&scope=bot&permissions=17600776129536` (voir les salons, envoyer des messages, intégrer des liens, mentionner @everyone, gérer et créer des événements).
3. Dans Discord (Paramètres, Avancés), activer le mode développeur, puis clic droit sur le serveur et sur les salons, « Copier l'identifiant ».
4. Dans Vercel, définir `DISCORD_BOT_TOKEN` (cocher Sensitive), `DISCORD_GUILD_ID`, `DISCORD_ANNOUNCE_CHANNEL_ID` et, pour les alertes, `DISCORD_STAFF_CHANNEL_ID`, puis redéployer.
5. Vérifier que le bot a accès aux deux salons (surtout le salon privé du bureau).

## Licence

MIT, voir [LICENSE](./LICENSE).
