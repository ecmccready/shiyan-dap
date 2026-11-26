import Link from "next/link";
import { LICENSING_PARAGRAPHS, LICENSING_TITLE, OWNER_CONTACT_URL, PILOT_PATH, TRAJECTORY_PARAGRAPHS, TRAJECTORY_TITLE } from "@/lib/licensing";

/** Renders the published licensing and trajectory text. The last licensing sentence links the owner profile and the pilot page. */
export default function LicensingNotice() {
  const [intro, welcome, commercial, closing] = LICENSING_PARAGRAPHS;
  const contact = "https://github.com/ecmccready";
  const pilot = "/workbench/pilot";
  const before = closing.slice(0, closing.indexOf(contact));
  const afterContact = closing.slice(closing.indexOf(contact) + contact.length, closing.indexOf(pilot));
  const afterPilot = closing.slice(closing.indexOf(pilot) + pilot.length);
  return (
    <section className="space-y-3 text-sm text-zinc-300">
      <h2 className="text-xl font-semibold text-white">{LICENSING_TITLE}</h2>
      <p>{intro}</p>
      <p>{welcome}</p>
      <p>{commercial}</p>
      <p>
        {before}
        <a className="underline" href={OWNER_CONTACT_URL}>{contact}</a>
        {afterContact}
        <Link className="underline" href={PILOT_PATH}>{pilot}</Link>
        {afterPilot}
      </p>
      <h2 className="text-xl font-semibold text-white">{TRAJECTORY_TITLE}</h2>
      {TRAJECTORY_PARAGRAPHS.map((p) => <p key={p}>{p}</p>)}
    </section>
  );
}
