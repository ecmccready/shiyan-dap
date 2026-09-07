import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <p className="text-xs tracking-[0.28em] uppercase text-emerald-400 mb-5">
          Shiyan AI Assist
        </p>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] max-w-4xl">
          Create. Assist. Prove.
          <br />
          Release. Learn.
        </h1>
        <p className="text-zinc-400 text-lg md:text-xl max-w-3xl mt-7 leading-relaxed">
          Shiyan AI Assist is a creator operating system that turns a creative
          work into a living project. Start with a song, idea, or work in
          progress.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/upload"
            className="h-12 px-8 rounded-full bg-emerald-600 text-white text-sm font-medium inline-flex items-center"
          >
            Upload a song →
          </Link>
          <Link
            href="/single"
            className="h-12 px-8 rounded-full border border-zinc-700 text-zinc-300 text-sm font-medium inline-flex items-center"
          >
            Open First Single
          </Link>
        </div>
      </main>
    </div>
  );
}
