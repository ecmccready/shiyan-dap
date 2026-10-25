import type { Metadata } from "next";
import EmergenceClient from "../../emergence/EmergenceClient";

export const metadata: Metadata = {
  title: "Music | Aethel Node Workbench",
  description: "Music and creative workbench for Aethel Node.",
};

export default function MusicPage() {
  return <EmergenceClient />;
}
