import { branding } from "@/config/branding";
import { RETENTION_MONTHS } from "@/config/retention";
import { PublicLayout } from "@/components/layout/PublicLayout";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-bold">{title}</h2>
      <div className="space-y-2 text-[0.95rem] leading-relaxed text-ink/85">{children}</div>
    </section>
  );
}

const linkClass = "font-semibold text-brand underline underline-offset-2";

export default function PrivacyPage() {
  const contact = branding.contact;
  const means: React.ReactNode[] = [];
  if (contact?.email) {
    means.push(
      <a key="email" href={`mailto:${contact.email}`} className={linkClass}>
        {contact.email}
      </a>,
    );
  }
  if (contact?.discordUrl) {
    means.push(
      <a key="discord" href={contact.discordUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Discord
      </a>,
    );
  }
  if (contact?.instagramUrl) {
    means.push(
      <a key="instagram" href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
        Instagram{contact.instagramHandle ? ` (${contact.instagramHandle})` : ""}
      </a>,
    );
  }
  // « a, b ou c »
  const contactMeans = means.flatMap((item, index) => [
    index === 0 ? null : index === means.length - 1 ? " ou " : ", ",
    item,
  ]);

  return (
    <PublicLayout title="Confidentialité" description="Les données collectées lors d’une réservation, et ce qu’elles deviennent.">
      <div className="mx-auto max-w-2xl space-y-8 px-4 pt-8 sm:pt-12">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Confidentialité</h1>
          <p className="mt-2 text-[0.95rem] text-subtle">
            Ce que {branding.appName} retient quand vous réservez une place, et pendant combien de temps.
          </p>
        </div>

        <Section title="Les données collectées">
          <p>
            Votre <strong>nom</strong> et votre <strong>adresse e-mail</strong>, saisis lors de la réservation. Le site
            enregistre aussi le numéro de votre billet et l’heure de sa validation à l’entrée.
          </p>
          <p>Il n’y a ni publicité, ni suivi, ni cookie sur le site public.</p>
          <p>
            Pour que votre billet reste affichable sans réseau, la page de votre billet est enregistrée sur votre appareil,
            dans le stockage de votre navigateur. Rien n’est envoyé ailleurs, et vous pouvez l’effacer en vidant les données du
            site.
          </p>
        </Section>

        <Section title="À quoi elles servent">
          <p>
            À émettre votre billet, à vous l’envoyer par e-mail et à contrôler les entrées le soir de la séance. Elles ne sont
            ni revendues ni utilisées pour vous envoyer autre chose que votre billet.
          </p>
        </Section>

        <Section title="Combien de temps elles sont gardées">
          <p>
            Votre nom et votre adresse e-mail sont effacés {RETENTION_MONTHS} mois après votre dernière séance. Seuls des
            chiffres anonymes subsistent (nombre de réservations et de présents par séance).
          </p>
          <p>
            Le journal des actions du bureau (qui a créé, modifié ou annulé quoi, avec le nom de la personne concernée) est effacé au
            même rythme, après {RETENTION_MONTHS} mois.
          </p>
          <p>Vous pouvez aussi annuler votre réservation vous-même depuis le lien reçu dans l’e-mail de votre billet.</p>
        </Section>

        <Section title="Qui y a accès">
          <p>
            Les membres du bureau du club, pour organiser les séances. Pour fonctionner, le site s’appuie sur trois services :
            Vercel (hébergement), Supabase (base de données, hébergée à Paris) et Brevo (envoi des e-mails).
          </p>
        </Section>

        <Section title="Vos droits">
          <p>
            Vous pouvez demander à consulter, corriger ou effacer vos données à tout moment en contactant le bureau du club
            {contactMeans.length > 0 && <> : {contactMeans}</>}.
          </p>
        </Section>
      </div>
    </PublicLayout>
  );
}
