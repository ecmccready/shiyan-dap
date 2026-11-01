
export const DOMAIN_GROUPS = [
  // ... all existing Know / Know How / Show / Do groups exactly as they are ...
  {
    name: "Physical systems",
    entries: [
      {
        label: "Long-horizon robotics policies",
        path: "/workbench/robotics",
      },
    ],
  },
];

// Keep any existing DOMAIN_ITEMS export unchanged.
// If the file currently does something like:
// export const DOMAIN_ITEMS = DOMAIN_GROUPS.flatMap(g => g.entries);
// leave that line as-is.