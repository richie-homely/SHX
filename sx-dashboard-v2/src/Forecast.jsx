// Shoreditch Exchange — Forecast Module (v26 — 14 Apr 2026)
// Built from Yonobi SX 2026 Model + Arada Strategy targets
import { useState, useMemo } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const MODEL = {
  deskRevenue:    [481481,485726,513757,523109,539942,558442,584067,601163,613775,635288,655648,664125],
  stepIncreases:  [0,2089,4537,860,180,3667,5610,500,500,0,0,2186],
  renewalUplifts: [277,356,393,842,2478,459,2440,1971,1087,2539,335,665],
  newDeals:       [0,1800,23100,7650,14175,14375,17575,14625,11025,18975,20025,5625],
  occupiedDesks:  [1355,1355,1367,1384,1426,1460,1515,1563,1624,1711,1789,1789],
  interest:       [0,3000,0,0,3000,0,0,3000,0,0,3000,0],
  agencyFees:     [8730,8434,8434,34187,11779,24493,25200,30750,20515,18134,25816,27432],
  salariesCore:   [14406,14568,14568,14568,14568,14568,15442,15442,15442,39499,39499,39499],
  salariesTrans:  [0,0,12533,12533,12533,12533,12533,12533,12533,0,0,0],
  security:       [11774,11774,11774,12363,12363,12363,12363,12363,12363,12363,12363,12363],
  internet:       [3873,4000,5000,5000,5000,5000,5000,5000,5000,5000,5000,5000],
  compliance:     [13036,12917,12917,12917,12917,12917,12917,12917,12917,12917,12917,12917],
  repairs:        [12535,15283,15283,17063,17063,17063,20563,20563,20563,20563,20563,23563],
  cleaning:       [28874,31851,31851,31851,31851,31851,31851,31851,31851,31851,31851,31851],
  recycling:      [1262,1999,1999,1999,1999,1999,1999,1999,1999,1999,1999,1999],
  utilities:      [19745,29457,29457,29457,29457,29457,29457,29457,29457,29457,29457,29457],
  fAndB:          [14096,13711,13711,13711,13711,13711,13711,13711,13711,13711,13711,13711],
  admin:          [8721,16971,16971,16971,16971,16971,16971,16971,16971,16971,16971,16971],
  marketing:      [10763,12613,12613,12613,12613,12613,12613,12613,12613,12613,12613,12613],
  rates: 149500, serviceCharge: 3970, groundRent: 25833,
};

const SCENARIOS = {
  conservative: {
    meetings: [6283,7000,7350,7718,8103,9500,8000,8000,8103,8509,8934,7500],
    events:   [3679,7500,7500,7500,7500,7500,7500,7500,7500,5000,5000,5000],
    sauna:    [0,0,0,0,0,0,0,0,0,0,0,0],
    conc:     [0,0,0,0,0,0,0,0,0,0,0,0],
    deals:    [27717,30500,30958,31422,31893,32372,32857,32857,33350,33850,34358,27500],
  },
  base: {
    meetings: [6283,7000,7350,7718,8103,9500,8000,8000,12500,12500,12500,12500],
    events:   [3679,7500,7500,7500,7500,7500,7500,7500,12500,12500,12500,12500],
    sauna:    [0,0,0,0,0,0,0,0,0,0,10000,10000],
    conc:     [0,0,0,0,0,0,0,0,0,0,10000,10000],
    deals:    [27717,30500,30958,31422,35000,37500,37500,37500,40000,40000,42500,42500],
  },
  stretch: {
    meetings: [6283,7000,7350,8500,9000,10500,10000,10000,15000,15000,18000,18000],
    events:   [3679,7500,7500,8000,8500,9000,10000,10000,15000,15000,18000,18000],
    sauna:    [0,0,0,0,0,0,0,0,0,0,12000,12000],
    conc:     [0,0,0,0,0,0,0,0,0,0,12000,12000],
    deals:    [27717,30500,30958,40000,40000,45000,50000,55000,65000,80000,90000,100000],
  },
};

const fmt = v => "£" + Math.round(v).toLocaleString();
const fmtK = v => "£" + Math.round(v / 1000) + "K";

export default function Forecast({ db }) {
  const [scenario, setScenario] = useState("base");
  const [regearPct, setRegearPct] = useState(10);
  const [newDealRate, setNewDealRate] = useState(450);
  const [showOpex, setShowOpex] = useState(false);

  const currentMRR = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.mrr, 0);
  const occupiedDesks = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.desks, 0);

  const forecast = useMemo(() => {
    const S = SCENARIOS[scenario];
    const rateAdj = newDealRate / 450;
    const regearAdj = regearPct / 10;

    return MONTHS.map((m, i) => {
      const baseDesk = MODEL.deskRevenue[0];
      const cumSteps = MODEL.stepIncreases.slice(0, i + 1).reduce((a, b) => a + b, 0);
      const cumRenewals = MODEL.renewalUplifts.slice(0, i + 1).reduce((a, b) => a + b, 0) * regearAdj;
      const cumNew = MODEL.newDeals.slice(0, i + 1).reduce((a, b) => a + b, 0) * rateAdj;
      const deskRev = baseDesk + cumSteps + cumRenewals + cumNew;
      const totalRev = deskRev + S.meetings[i] + S.events[i] + S.sauna[i] + S.conc[i] + MODEL.interest[i];

      const opex = MODEL.agencyFees[i] + MODEL.salariesCore[i] + MODEL.salariesTrans[i] +
        MODEL.security[i] + MODEL.internet[i] + MODEL.compliance[i] + MODEL.repairs[i] +
        MODEL.cleaning[i] + MODEL.recycling[i] + MODEL.utilities[i] + MODEL.fAndB[i] +
        MODEL.admin[i] + MODEL.marketing[i];
      const propCosts = MODEL.rates + MODEL.serviceCharge + MODEL.groundRent;
      const noi = totalRev - opex - propCosts;

      return {
        month: m, deskRev: Math.round(deskRev),
        meetings: S.meetings[i], events: S.events[i], sauna: S.sauna[i], conc: S.conc[i],
        interest: MODEL.interest[i], totalRev: Math.round(totalRev),
        opex: Math.round(opex), propCosts, totalExp: Math.round(opex + propCosts),
        noi: Math.round(noi), occ: MODEL.occupiedDesks[i],
        occPct: Math.round((MODEL.occupiedDesks[i] / 1789) * 100),
        deskRate: Math.round(deskRev / MODEL.occupiedDesks[i]),
      };
    });
  }, [scenario, regearPct, newDealRate]);

  const annualRev = forecast.reduce((s, f) => s + f.totalRev, 0);
  const annualNOI = forecast.reduce((s, f) => s + f.noi, 0);
  const decRev = forecast[11].totalRev;
  const noiMargin = Math.round((annualNOI / annualRev) * 100);
  const yonobiFee = Math.round(annualNOI * 0.075);

  const Card = ({ children, style }) => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, ...style }}>{children}</div>
  );

  const SC = { conservative: { label: "Conservative", color: "var(--text-dim)" }, base: { label: "Base Case", color: "var(--accent)" }, stretch: { label: "Stretch", color: "#3B82F6" } };
  const maxRev = Math.max(...forecast.map(f => f.totalRev)) * 1.08;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>2026 Revenue Forecast</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Yonobi SX Model · Editable assumptions · {SC[scenario].label}</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(SC).map(([key, cfg]) => (
              <button key={key} onClick={() => setScenario(key)} style={{
                padding: "6px 14px", fontSize: 11, fontWeight: scenario === key ? 700 : 400, borderRadius: 5, cursor: "pointer",
                background: scenario === key ? cfg.color : "transparent", color: scenario === key ? "#fff" : "var(--text-dim)",
                border: `1px solid ${scenario === key ? cfg.color : "var(--border)"}`,
              }}>{cfg.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16, padding: 14, background: "var(--bg)", borderRadius: 6 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>New deal desk rate</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" min={350} max={550} step={25} value={newDealRate} onChange={e => setNewDealRate(Number(e.target.value))} style={{ flex: 1, accentColor: SC[scenario].color }} />
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 50 }}>{fmt(newDealRate)}</span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>Model default: £450 · Current blended: {fmt(occupiedDesks > 0 ? Math.round(currentMRR / occupiedDesks) : 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>Re-gear uplift</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[7, 10, 20, 30].map(p => (
                <button key={p} onClick={() => setRegearPct(p)} style={{
                  padding: "5px 12px", fontSize: 11, fontWeight: regearPct === p ? 700 : 400, borderRadius: 4, cursor: "pointer",
                  background: regearPct === p ? SC[scenario].color : "transparent", color: regearPct === p ? "#fff" : "var(--text-dim)",
                  border: `1px solid ${regearPct === p ? SC[scenario].color : "var(--border)"}`,
                }}>{p}%</button>
              ))}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>Oneder: 7% blanket · Arada: 10-30% targeted</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {[
          { label: "Dec 2026 Rev", value: fmtK(decRev), color: SC[scenario].color },
          { label: "Annual Revenue", value: fmtK(annualRev), color: "var(--text)" },
          { label: "Annual NOI", value: fmtK(annualNOI), color: "var(--accent)" },
          { label: "NOI Margin", value: noiMargin + "%", color: noiMargin >= 35 ? "var(--accent)" : "#E8A317" },
          { label: "Yonobi Fee", value: fmtK(yonobiFee), color: "var(--text-dim)" },
          { label: "Landlord Net", value: fmtK(annualNOI - yonobiFee), color: "var(--accent)" },
        ].map((k, i) => (
          <Card key={i} style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color, marginTop: 4 }}>{k.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Monthly Revenue — {SC[scenario].label}</div>
        <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 200 }}>
          {forecast.map((f, i) => {
            const h = (f.totalRev / maxRev) * 200;
            const isActual = i < 3;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-dim)", marginBottom: 2 }}>{fmtK(f.totalRev)}</div>
                <div style={{ width: "100%", height: Math.max(2, h), borderRadius: "3px 3px 0 0", background: isActual ? "#F87171" : SC[scenario].color, opacity: isActual ? 0.7 : 1 }} />
                <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>{f.month}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10, color: "var(--text-dim)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#F87171", opacity: 0.7 }} />Actuals</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: SC[scenario].color }} />Forecast</span>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Monthly P&L Breakdown</div>
          <button onClick={() => setShowOpex(!showOpex)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 4, cursor: "pointer", background: showOpex ? SC[scenario].color : "transparent", color: showOpex ? "#fff" : "var(--text-dim)", border: `1px solid ${showOpex ? SC[scenario].color : "var(--border)"}` }}>{showOpex ? "Hide Opex" : "Show Opex & NOI"}</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "6px 4px", color: "var(--text-dim)" }}></th>
                {MONTHS.map(m => <th key={m} style={{ textAlign: "right", padding: "6px 3px", color: "var(--text-dim)", fontWeight: 600 }}>{m}</th>)}
                <th style={{ textAlign: "right", padding: "6px 4px", fontWeight: 700, color: "var(--text-dim)" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Desk Revenue", key: "deskRev" },
                { label: "Meeting Rooms", key: "meetings" },
                { label: "Events", key: "events" },
                { label: "Sauna", key: "sauna" },
                { label: "Concessions", key: "conc" },
                { label: "Interest", key: "interest" },
                { label: "Total Revenue", key: "totalRev", bold: true, color: SC[scenario].color },
              ].map(row => (
                <tr key={row.key} style={{ borderBottom: row.bold ? "2px solid var(--border)" : "1px solid var(--border)" }}>
                  <td style={{ padding: "3px 4px", fontWeight: row.bold ? 700 : 400, color: row.color || "var(--text)", whiteSpace: "nowrap" }}>{row.label}</td>
                  {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "3px 3px", fontWeight: row.bold ? 700 : 400, color: f[row.key] === 0 ? "var(--border)" : (row.color || "var(--text)") }}>{f[row.key] === 0 ? "—" : fmtK(f[row.key])}</td>)}
                  <td style={{ textAlign: "right", padding: "3px 4px", fontWeight: 700, color: row.color || "var(--text)" }}>{fmtK(forecast.reduce((s, f) => s + f[row.key], 0))}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "3px 4px", color: "var(--text-dim)" }}>Occupancy</td>
                {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "3px 3px", color: f.occPct >= 95 ? "var(--accent)" : f.occPct >= 85 ? "var(--text)" : "#E8A317" }}>{f.occPct}%</td>)}
                <td></td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "3px 4px", color: "var(--text-dim)" }}>Desk Rate</td>
                {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "3px 3px", color: f.deskRate >= 425 ? "var(--accent)" : f.deskRate >= 400 ? "var(--text)" : "#E8A317" }}>{fmt(f.deskRate)}</td>)}
                <td></td>
              </tr>
              {showOpex && <>
                <tr><td colSpan={14} style={{ padding: "8px 4px 2px", fontWeight: 600, color: "var(--text-dim)" }}>Operating Expenses</td></tr>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <td style={{ padding: "3px 4px", fontWeight: 700 }}>Total Opex</td>
                  {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "3px 3px", fontWeight: 600, color: "#E74C3C" }}>{fmtK(f.opex)}</td>)}
                  <td style={{ textAlign: "right", padding: "3px 4px", fontWeight: 700, color: "#E74C3C" }}>{fmtK(forecast.reduce((s, f) => s + f.opex, 0))}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "3px 4px" }}>Property Costs</td>
                  {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "3px 3px", color: "var(--text-dim)" }}>{fmtK(f.propCosts)}</td>)}
                  <td style={{ textAlign: "right", padding: "3px 4px", fontWeight: 600 }}>{fmtK(forecast.reduce((s, f) => s + f.propCosts, 0))}</td>
                </tr>
                <tr style={{ background: "var(--bg)" }}>
                  <td style={{ padding: "6px 4px", fontWeight: 700, color: "var(--accent)" }}>NOI</td>
                  {forecast.map((f, i) => <td key={i} style={{ textAlign: "right", padding: "6px 3px", fontWeight: 700, color: f.noi > 0 ? "var(--accent)" : "#E74C3C" }}>{fmtK(f.noi)}</td>)}
                  <td style={{ textAlign: "right", padding: "6px 4px", fontWeight: 700, color: "var(--accent)" }}>{fmtK(annualNOI)}</td>
                </tr>
              </>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Revenue Bridge: Current → Dec 2026</div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 14 }}>{fmtK(currentMRR)} → {fmtK(decRev)}</div>
        {[
          { label: "Current MRR (mapped)", value: currentMRR, color: "var(--text-dim)", base: true },
          { label: "Step increases", value: MODEL.stepIncreases.reduce((a, b) => a + b, 0), color: "#8B5CF6" },
          { label: `Re-gear uplifts (${regearPct}%)`, value: Math.round(MODEL.renewalUplifts.reduce((a, b) => a + b, 0) * (regearPct / 10)), color: "#3B82F6" },
          { label: `New deals (@ ${fmt(newDealRate)}/d)`, value: Math.round(MODEL.newDeals.reduce((a, b) => a + b, 0) * (newDealRate / 450)), color: "var(--accent)" },
          { label: "Ancillary (meetings + events)", value: forecast[11].meetings + forecast[11].events, color: "#E8A317" },
          { label: "Sauna + concessions", value: forecast[11].sauna + forecast[11].conc, color: "#EC4899" },
        ].reduce((acc, item) => {
          const prev = acc.length > 0 ? acc[acc.length - 1].cum : 0;
          acc.push({ ...item, cum: item.base ? item.value : prev + item.value });
          return acc;
        }, []).map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, fontWeight: r.base ? 400 : 500 }}>{r.label}</span>
            <div style={{ height: 14, background: "var(--bg)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(r.cum / (decRev * 1.05)) * 100}%`, background: r.color, borderRadius: 3, transition: "width 0.4s" }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, textAlign: "right", color: r.color }}>{r.base ? fmtK(r.value) : "+" + fmtK(r.value)}</span>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px", gap: 8, padding: "8px 0", marginTop: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Dec 2026</span><div />
          <span style={{ fontSize: 14, fontWeight: 700, textAlign: "right", color: SC[scenario].color }}>{fmtK(decRev)}</span>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Opex: Oneder vs Arada</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 65px 1fr", gap: 3, fontSize: 10 }}>
          {["Category","Oneder","Arada","Delta","Driver"].map(h => <div key={h} style={{ fontWeight: 600, color: "var(--text-dim)", padding: "4px 0", borderBottom: "2px solid var(--border)", textAlign: h === "Category" || h === "Driver" ? "left" : "right" }}>{h}</div>)}
          {[
            ["Agency Fees",231321,243904,"Higher volume"],["Salaries",179898,252069,"Better GM + team"],["Transition",0,87733,"7-month cost"],
            ["Security",146586,146589,"Fixed"],["Internet",57873,57873,"Fixed"],["Compliance",155120,155123,"Fixed"],
            ["Repairs",181239,221015,"Preventative"],["Cleaning",382212,382212,"Fixed"],["Utilities",353482,353484,"Fixed"],
            ["F&B",164533,164533,"Fixed"],["Admin",151154,203654,"Arada systems"],["Marketing",103054,151354,"Social-first"],
          ].map(([cat,on,ar,dr], i) => {
            const d = ar - on;
            return [
              <div key={`c${i}`} style={{ padding: "3px 0", borderBottom: "1px solid var(--border)" }}>{cat}</div>,
              <div key={`o${i}`} style={{ textAlign: "right", padding: "3px 0", borderBottom: "1px solid var(--border)" }}>{fmtK(on)}</div>,
              <div key={`a${i}`} style={{ textAlign: "right", padding: "3px 0", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{fmtK(ar)}</div>,
              <div key={`d${i}`} style={{ textAlign: "right", padding: "3px 0", borderBottom: "1px solid var(--border)", color: d > 5000 ? "#E8A317" : "var(--text-dim)", fontWeight: 600 }}>{d === 0 ? "—" : "+" + fmtK(d)}</div>,
              <div key={`n${i}`} style={{ padding: "3px 0", borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>{dr}</div>,
            ];
          }).flat()}
          <div style={{ padding: "5px 0", fontWeight: 700 }}>Total</div>
          <div style={{ textAlign: "right", padding: "5px 0", fontWeight: 700 }}>{fmtK(2130458)}</div>
          <div style={{ textAlign: "right", padding: "5px 0", fontWeight: 700 }}>{fmtK(2443529)}</div>
          <div style={{ textAlign: "right", padding: "5px 0", fontWeight: 700, color: "#E8A317" }}>+{fmtK(313071)}</div>
          <div style={{ padding: "5px 0", color: "var(--text-dim)", fontWeight: 600 }}>+14%</div>
        </div>
      </Card>

      <Card style={{ background: "var(--bg)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>Next Build</div>
        <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.6 }}>
          Per-room editable desk rates · Drag-and-drop occupancy timeline · Churn modelling · Capex planning · Scenario overlay chart · Excel export
        </div>
      </Card>
    </div>
  );
}
