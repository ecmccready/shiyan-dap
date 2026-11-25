import type { Metadata } from "next";
import SemiconductorDoor from "@/components/SemiconductorDoor";

export const metadata: Metadata = {
  title: "Shiyan DAP | Computational Intelligence. Semiconductor Proof.",
  description:
    "A semiconductor optimization and verification platform connecting intelligent computation, FPGA implementation and evidence-driven performance improvement. Powered by Aethel Node and 4D-SCP.",
};

export default function HomePage() {
  return <SemiconductorDoor />;
}
