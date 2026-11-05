"use client";

import React, { useState } from "react";

export default function OpportunityPage() {
  const [record, setRecord] = useState({
    prospect: "",
    problem: "",
    proposedValue: "",
    objective: "",
    baseline: "",
    successMetric: "",
    acceptanceThreshold: "",
  });

  const [saved, setSaved] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setRecord({ ...record, [e.target.name]: e.target.value });
    setSaved(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production this posts to /api/opportunity and persists server-side.
    console.log("Opportunity record:", record);
    setSaved(true);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
          Aethel Node · Opportunity Record
        </p>

        <h1 className="text-4xl font-semibold mb-6">Customer opportunity</h1>

        <p className="text-zinc-300 mb-10">
          Persist the prospect, their problem, proposed value, objective, baseline, success metric and acceptance threshold before any work begins.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Prospect</label>
            <input name="prospect" value={record.prospect} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Problem</label>
            <textarea name="problem" value={record.problem} onChange={handleChange} rows={3} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Proposed value</label>
            <input name="proposedValue" value={record.proposedValue} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Objective</label>
            <input name="objective" value={record.objective} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Baseline</label>
            <input name="baseline" value={record.baseline} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Success metric</label>
            <input name="successMetric" value={record.successMetric} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Acceptance threshold</label>
            <input name="acceptanceThreshold" value={record.acceptanceThreshold} onChange={handleChange} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2" />
          </div>

          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded">
            Save opportunity record
          </button>

          {saved && (
            <p className="text-emerald-400 text-sm">Record captured. Ready for proof contract.</p>
          )}
        </form>
      </main>
    </div>
  );
}