async function watch() {
    setBusy(true);
    try {
      const rpc = httpTransport("/api/mcp");
      await connectHost(rpc);
      const cold = await act(rpc, "mark_boundary", "watch-b1");
      const coldFinal = cold?.e_next ?? cold?.e ?? 0;
      const reuse = await reuseOutsideSelf(rpc, coldFinal, "watch-b1");
      const better = Boolean(reuse.better);
      setPrinted({
        y: "mark_boundary, then sealed sequence outside Self()",
        z: String(reuse.z ?? cold?.z ?? "none"),
        eBefore: String(cold?.e ?? "none"),
        eAfter: String(reuse.final_e),
        deltaE: String(reuse.delta_e),
        cold: String(coldFinal),
        reuse: String(reuse.final_e),
        phi: String(reuse.phi),
        better,
      });
      setNote(
        better
          ? "Final e fell on this plant. That is the only listing test here."
          : "Final e did not fall. Do not call this experience reusable.",
      );
    } catch (err) {
      setPrinted(null);
      setNote(String(err));
    } finally {
      setBusy(false);
    }
  }