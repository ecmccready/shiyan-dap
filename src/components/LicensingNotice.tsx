"use client";

import Link from "next/link";
import {
  LICENSING_PARAGRAPHS,
  LICENSING_TITLE,
  OWNER_CONTACT_URL,
  PILOT_PATH,
  TRAJECTORY_PARAGRAPHS,
  TRAJECTORY_TITLE,
} from "@/lib/licensing";

/** Renders the published licensing text. Trajectory is opt-in so only the surfaces that publish it show it. */
export default function LicensingNotice({ showTrajectory = false }: { showTrajectory?: boolean }) {
  const [intro, welcome, commercial, closing] = LICENSING_PARAGRAPHS;
  const contactAt = closing.indexOf(OWNER_CONTACT_URL);
  const pilotAt = closing.indexOf(PILOT_PATH);
  const linked = contactAt >= 0 && pilotAt > contactAt;
  return (
    <section className="mt-8 space-y-3 text-sm">
      <h2 className="text-lg font-semibold">{LICENSING_TITLE}</h2>
      <p>{intro}</p>
      <p>{welcome}</p>
      <p>{commercial}</p>
      {linked ? (
        <p>
          {closing.slice(0, contactAt)}
          <a className="underline" href={OWNER_CONTACT_URL}>{OWNER_CONTACT_URL}</a>
          {closing.slice(contactAt + OWNER_CONTACT_URL.length, pilotAt)}
          <Link className="underline" href={PILOT_PATH}>{PILOT_PATH}</Link>
          {closing.slice(pilotAt + PILOT_PATH.length)}
        </p>
      ) : (
        <p>{closing}</p>
      )}
      {showTrajectory ? (
        <>
          <h2 className="text-lg font-semibold">{TRAJECTORY_TITLE}</h2>
          {TRAJECTORY_PARAGRAPHS.map((p) => <p key={p}>{p}</p>)}
        </>
      ) : null}
    </section>
  );
}
