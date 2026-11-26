import type { Metadata } from "next";
import SemiconductorDoor from "@/components/SemiconductorDoor";

export const metadata: Metadata = {
  title: "Shiyan DAP — Computational Intelligence. Semiconductor Proof.",
  description:
    "Optimize, verify and move computational designs toward hardware. Powered by Aethel Node · 4D-SCP · FPGA implementation and measurement. A semiconductor optimization and verification platform connecting intelligent computation, FPGA implementation and evidence-driven performance improvement.",
};

export default function HomePage() {
  return <SemiconductorDoor />;
}
