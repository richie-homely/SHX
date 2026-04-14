// Shoreditch Exchange — Forecast Module (v26 — 14 Apr 2026)
// Placeholder — full build in next iteration

export default function Forecast({ db }) {
  const fmt = v => "£" + Math.round(v).toLocaleString();
  const currentMRR = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.mrr, 0);
  const occupiedDesks = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.desks, 0);
  const avgRate = occupiedDesks > 0 ? Math.round(currentMRR / occupiedDesks) : 0;
  const totalDesks = db.meta.totalDesks;
  const occPct = Math.round((occupiedDesks / totalDesks) * 100);

  const targets = [
    { label: "Conservative (Oneder)", rev: 700000, occ: 93, rate: 386, noi: null },
    { label: "Base Case (Arada)", rev: 750000, occ: 95, rate: 425, noi: 3054862 },
    { label: "Stretch Goal", rev: 825000, occ: 100, rate: 450, noi: null },
  ];

  const milestones = [
    { q: "Q1 2026", target: 570000, label: "Transition complete" },
    { q: "Q2 2026", target: 665000, label: "Brand launch + splits commence" },
    { q: "Q3 2026", target: 740000, label: "Broker 40% mix + ancillary firing" },
    { q: "Q4 2026", target: 750000, label: "Stabilised operations" },
  ];

  const Card = ({ children, style }) => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, ...style }}>{children}</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Revenue Forecast</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Arada management plan — 2026 targets vs current position</div>
          </div>
          <div style={{ fontSize: 9, padding: "4px 10px", background: "#E8A31722", color: "#E8A317", borderRadius: 4, fontWeight: 600 }}>Coming Soon — Full Module</div>
        </div>

        {/* Current vs Target */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Current MRR", value: fmt(currentMRR), sub: "Mapped offices", color: "var(--accent)" },
            { label: "Occupied Desks", value: `${occupiedDesks} / ${totalDesks}`, sub: `${occPct}% occupancy`, color: occPct >= 90 ? "var(--accent)" : "#E8A317" },
            { label: "Avg Desk Rate", value: fmt(avgRate), sub: "Target: £425-450", color: avgRate >= 425 ? "var(--accent)" : "#E8A317" },
            { label: "Dec 2026 Target", value: fmt(750000), sub: "Base case (Arada)", color: "#3B82F6" },
          ].map((k, i) => (
            <div key={i} style={{ background: "var(--bg)", borderRadius: 6, padding: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Scenario comparison */}
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>2026 Scenarios</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {targets.map((t, i) => {
            const gap = t.rev - currentMRR;
            const pct = Math.round((currentMRR / t.rev) * 100);
            return (
              <div key={i} style={{ background: "var(--bg)", borderRadius: 6, padding: 14, borderLeft: `3px solid ${i === 0 ? "var(--text-dim)" : i === 1 ? "var(--accent)" : "#3B82F6"}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>{t.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: i === 1 ? "var(--accent)" : "var(--text)" }}>{fmt(t.rev)}/m</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>Occ: {t.occ}% · Rate: {fmt(t.rate)}/d</div>
                <div style={{ marginTop: 8, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: i === 1 ? "var(--accent)" : "var(--text-dim)", borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{pct}% achieved · {fmt(gap)} gap</div>
              </div>
            );
          })}
        </div>

        {/* Quarterly milestones */}
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Quarterly Revenue Milestones</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {milestones.map((m, i) => {
            const hit = currentMRR >= m.target;
            return (
              <div key={i} style={{ background: "var(--bg)", borderRadius: 6, padding: 12, opacity: hit ? 0.6 : 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: hit ? "var(--accent)" : "var(--text)" }}>{m.q} {hit ? "✓" : ""}</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{fmt(m.target)}</div>
                <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{m.label}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Revenue bridge */}
      <Card>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Revenue Bridge: Current → £750K Base Case</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>Components of the £{Math.round((750000 - currentMRR)/1000)}K monthly uplift</div>
        {[
          { label: "Current Base", value: currentMRR, color: "var(--text-dim)", cumulative: currentMRR },
          { label: "Occupancy Uplift (+230 desks)", value: 100000, color: "var(--accent)", cumulative: currentMRR + 100000 },
          { label: "Yield Reset (re-gears)", value: 25000, color: "#3B82F6", cumulative: currentMRR + 125000 },
          { label: "Desk Densification (+130 net)", value: 60000, color: "#8B5CF6", cumulative: currentMRR + 185000 },
          { label: "Ancillary Revenue", value: 60000, color: "#E8A317", cumulative: currentMRR + 245000 },
        ].map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, fontWeight: i === 0 ? 400 : 500 }}>{r.label}</span>
            <div style={{ height: 18, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.cumulative / 800000) * 100}%`, background: r.color, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right", color: i === 0 ? "var(--text-dim)" : r.color }}>{i === 0 ? fmt(r.value) : "+" + fmt(r.value)}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 8, alignItems: "center", padding: "8px 0", marginTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Target Total</span>
          <div />
          <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: "var(--accent)" }}>{fmt(750000)}</span>
        </div>
      </Card>

      {/* Upcoming features note */}
      <Card style={{ background: "var(--bg)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--accent)" }}>Forecast Module — Next Build</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Editable desk rate per room · Re-gear assumption toggles (7% / 10% / 20% / 30%) ·
          Monthly revenue waterfall with scenario switching · Churn modelling ·
          Occupancy ramp curves · Ancillary revenue phasing ·
          NOI projection with opex assumptions · Export to Excel
        </div>
      </Card>
    </div>
  );
}
