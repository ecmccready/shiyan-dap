 "use client";

import { useEffect, useState } from "react";

export default function StatusPage() {
  const [paths, setPaths] = useState<any[]>([]);
  const [lastPulse, setLastPulse] = useState(false);

  useEffect(() => {
    // existing load logic stays
  }, []);

  const focusLast = () => {
    if (!paths.length) return;
    const last = paths[paths.length - 1];
    // reuse existing z-key focus + expand + scroll
    document.getElementById(`path-${last.id}`)?.scrollIntoView({ behavior: "smooth" });
    setLastPulse(true);
    setTimeout(() => setLastPulse(false), 1200);
  };

  return (
    <div>
      {/* existing sticky strip */}
      <div className="sticky-summary">
        {/* existing chips */}
        {paths.length > 0 && (
          <button
            type="button"
            onClick={focusLast}
            className={lastPulse ? "pulse" : ""}
            data-roe-summary-last
          >
            Last ↓
          </button>
        )}
      </div>
      {/* existing table */}
    </div>
  );
}