
"use client";

import { useState } from "react";

export default function MedicarePage() {
  const [rows, setRows] = useState<any[]>([]);
  const [lastPulse, setLastPulse] = useState(false);

  const jumpToLast = () => {
    if (!rows.length) return;
    const last = rows[rows.length - 1];
    // reuse existing z-key jump
    document.getElementById(`row-${last.id}`)?.scrollIntoView({ behavior: "smooth" });
    setLastPulse(true);
    setTimeout(() => setLastPulse(false), 1200);
  };

  return (
    <div>
      {/* existing Win strip */}
      <div className="win-strip">
        {/* existing chips */}
        {rows.length > 0 && (
          <button
            type="button"
            onClick={jumpToLast}
            className={lastPulse ? "pulse" : ""}
            data-medicare-last
          >
            Last ↓
          </button>
        )}
      </div>
      {/* existing table */}
    </div>
  );
}