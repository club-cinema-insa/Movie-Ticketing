# Club Ciné INSA — billetterie

Application de réservation gratuite pour les séances du club : les étudiants réservent leur place et reçoivent un billet avec QR code (PDF, e-mail facultatif), le bureau gère les séances et contrôle les billets à l’entrée.

## Fonctionnalités

- **Site public** : liste des séances, réservation en quelques secondes, billet PDF téléchargeable, ajout à l’agenda.
- **Espace bureau** (connexion Discord, réservé aux comptes autorisés) :
  - création, modification, publication et suppression des séances (préremplies à partir de la dernière) ;
  - liste des réservations : recherche, validation manuelle, annulation, ajout, export CSV ;
  - gestion des comptes Discord autorisés (page « Accès »).
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

## Déploiement

Vercel, région `cdg1` (Paris), branche `main` uniquement (`vercel.json`). `NEXT_PUBLIC_BRAND=clubcine` pour l’identité du club.

## Licence

MIT, voir [LICENSE](./LICENSE).
