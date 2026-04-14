import { useState, useEffect, useCallback } from "react";
import { SEED_DATA, FLOOR_PLAN_IMAGES } from "./data.js";
import Forecast from "./Forecast.jsx";

const STORAGE_KEY = "shoreditch-exchange-db-v28";

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmt = (n) => n != null ? "£" + Math.round(n).toLocaleString() : "—";
const fmtPct = (n) => n != null ? n.toFixed(1) + "%" : "—";
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const TODAY = "2026-04-05";

function statusColor(s) {
  return { occupied: "#1D9E75", pipeline: "#E8A317", vacant: "#E74C3C", signed: "#1D9E75", approved: "#3B82F6", pending: "#E8A317", active: "#1D9E75", rolling: "#3B82F6", not_renewed: "#E74C3C", terminated: "#6B7A94", up_for_renewal: "#E8A317", sold_not_occupied: "#8B5CF6" }[s] || "#6B7A94";
}

function csvExport(data, headers, filename) {
  const rows = [headers.join(","), ...data.map(r => headers.map(h => { const v = r[h] ?? ""; return typeof v === "string" && (v.includes(",") || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v; }).join(","))];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })); a.download = filename; a.click();
}

// ─── Shared chart component ─────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, height = 150, color, targetLine, formatVal }) {
  const vals = data.map(d => d[valueKey]);
  const max = Math.max(...vals) * 1.12;
  const min = Math.min(...vals) * 0.92;
  const range = max - min || 1;
  const step = Math.max(1, Math.ceil(data.length / 5));
  return (
    <div>
      <div style={{ position: "relative", height }}>
        {targetLine != null && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: `${((targetLine - min) / range) * height}px`, borderBottom: "1.5px dashed #E8A31788", zIndex: 1 }}>
            <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, color: "#E8A317" }}>Target: {formatVal ? formatVal(targetLine) : targetLine}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
          {data.map((d, i) => {
            const h = ((d[valueKey] - min) / range) * height;
            const isLast = i === data.length - 1;
            const showVal = i === 0 || i === data.length - 1 || i % step === 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                {showVal && <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-dim)", marginBottom: 2, whiteSpace: "nowrap" }}>{formatVal ? formatVal(d[valueKey]) : d[valueKey]}</div>}
                <div title={`${d[labelKey]}: ${formatVal ? formatVal(d[valueKey]) : d[valueKey]}`} style={{
                  width: "100%", height: Math.max(2, h), borderRadius: "3px 3px 0 0", cursor: "default",
                  background: isLast ? (color || "var(--accent)") : i >= data.length - 3 ? "#F87171" : "var(--border)",
                  transition: "height 0.3s ease",
                }} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 8, color: "var(--text-dim)", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap" }}>{d[labelKey]}</div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, valueKey, labelKey, height = 150, color, targetLine, formatVal }) {
  const vals = data.map(d => d[valueKey]);
  const max = Math.max(...vals) * 1.08;
  const min = Math.min(...vals) * 0.92;
  const range = max - min || 1;
  const w = 600;
  const step = Math.max(1, Math.ceil(data.length / 5));
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - ((d[valueKey] - min) / range) * height;
    return { x, y, ...d };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = pathD + ` L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`;
  return (
    <div>
      <div style={{ position: "relative" }}>
        {targetLine != null && (() => {
          const ty = height - ((targetLine - min) / range) * height;
          return <div style={{ position: "absolute", left: 0, right: 0, top: ty, borderBottom: "1.5px dashed #E8A31788", zIndex: 1 }}>
            <span style={{ position: "absolute", right: 0, top: -14, fontSize: 9, color: "#E8A317" }}>Target: {formatVal ? formatVal(targetLine) : targetLine}</span>
          </div>;
        })()}
        <svg viewBox={`0 0 ${w} ${height}`} style={{ width: "100%", height }}>
          <path d={areaD} fill={(color || "var(--accent)") + "18"} />
          <path d={pathD} fill="none" stroke={color || "var(--accent)"} strokeWidth="2.5" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 5 : 3} fill={i === pts.length - 1 ? (color || "var(--accent)") : "var(--chart-dot)"} stroke={color || "var(--accent)"} strokeWidth="1.5">
              <title>{`${p[labelKey]}: ${formatVal ? formatVal(p[valueKey]) : p[valueKey]}`}</title>
            </circle>
          ))}
          {pts.map((p, i) => {
            if (i !== 0 && i !== pts.length - 1 && i % step !== 0) return null;
            const label = formatVal ? formatVal(p[valueKey]) : p[valueKey];
            const yOff = p.y > 30 ? -10 : 16;
            return <text key={"l" + i} x={p.x} y={p.y + yOff} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-dim)">{label}</text>;
          })}
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8, color: "var(--text-dim)" }}>
        {data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i}>{d[labelKey]}</span>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────
function KPICard({ label, value, target, good }) {
  const ok = good !== undefined ? good : true;
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: ok ? "var(--accent)" : "var(--warn)", lineHeight: 1.1 }}>{value}</div>
      {target && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>{target}</div>}
    </div>
  );
}

function MiniBar({ value, max, color }) {
  return (
    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, width: "100%", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: color || "var(--accent)", borderRadius: 3, transition: "width 0.4s" }} />
    </div>
  );
}


// ─── Floor Plan Modal ────────────────────────────────────────────────
function FloorPlanModal({ floor, onClose, offices }) {
  const floorLabel = floor === "Grd" ? "Ground Floor" : floor === "LG" ? "Lower Ground" : floor + " Floor";
  const fo = offices.filter(o => o.floor === floor);
  const occ = fo.filter(o => o.status === "occupied");
  const totalDesks = fo.reduce((s, o) => s + o.desks, 0);
  const occDesks = occ.reduce((s, o) => s + o.desks, 0);
  const totalMRR = occ.reduce((s, o) => s + o.mrr, 0);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, maxWidth: "95vw", maxHeight: "95vh", overflow: "auto", width: 1100 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{floorLabel}</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
              {occDesks}/{totalDesks} desks occupied · {occ.length} tenants · {fmt(totalMRR)}/m
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text)", padding: "4px 12px", cursor: "pointer", fontSize: 13 }}>✕ Close</button>
        </div>
        <div style={{ padding: 16 }}>
          <img src={FLOOR_PLAN_IMAGES[floor]} alt={floorLabel} style={{ width: "100%", borderRadius: 6, background: "#fff" }} />
        </div>
        {fo.length > 0 && (
          <div style={{ padding: "0 20px 16px", maxHeight: 300, overflow: "auto" }}>
            {/* Multi-room tenant summary */}
            {(() => {
              const tc = {};
              fo.filter(o => o.tenant && o.status === "occupied").forEach(o => {
                if (!tc[o.tenant]) tc[o.tenant] = { desks: 0, mrr: 0, rooms: [] };
                tc[o.tenant].desks += o.desks;
                tc[o.tenant].mrr += o.mrr;
                tc[o.tenant].rooms.push(o.id);
              });
              const multi = Object.entries(tc).filter(([, v]) => v.rooms.length > 1);
              if (multi.length === 0) return null;
              return (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Multi-room tenants</div>
                  {multi.map(([tenant, info]) => (
                    <div key={tenant} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#1D9E7511", borderRadius: 4, marginBottom: 3, fontSize: 11 }}>
                      <span><strong>{tenant}</strong> <span style={{ color: "var(--text-dim)" }}>({info.rooms.length} rooms: {info.rooms.map(r => r.replace(/^0/,"")).join(" + ")})</span></span>
                      <span style={{ whiteSpace: "nowrap" }}>{info.desks}d · {fmt(info.mrr)}/m · £{info.desks > 0 ? Math.round(info.mrr / info.desks) : 0}/d</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Offices on this floor</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
              {fo.map(o => (
                <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 5, background: statusColor(o.status) + "11", border: "1px solid " + statusColor(o.status) + "33", fontSize: 11 }}>
                  <div>
                    <span style={{ fontWeight: 600, color: statusColor(o.status) }}>{o.id.replace(/^0/,"")}</span>
                    <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>{o.tenant || "Vacant"}</span>
                    {o.partTime && <span style={{ marginLeft: 4, fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#8B5CF622", color: "#8B5CF6", fontWeight: 600 }}>PT</span>}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--text-dim)" }}>{o.estimated ? "~" : ""}{o.desks}d</span>
                    {o.deskRate > 0 && <span style={{ marginLeft: 4, color: o.deskRate >= 425 ? "#1D9E75" : o.deskRate >= 350 ? "#E8A317" : "#E74C3C", fontWeight: 600 }}>£{o.deskRate}{o.estimated ? "~" : ""}</span>}
                    {o.contractEnd && <span style={{ marginLeft: 4, fontSize: 9, color: (() => { const d = Math.round((new Date(o.contractEnd) - new Date("2026-04-05")) / 86400000); return d <= 30 ? "#E74C3C" : d <= 90 ? "#E8A317" : "var(--text-dim)"; })() }}>{o.contractEnd.slice(0,7)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Floor Map ───────────────────────────────────────────────────────────
function FloorMap({ offices, floorDesks, totalDesks, onFloorClick, meetingRooms }) {
  const floors = ["LG", "Grd", "1st", "2nd", "3rd", "4th", "5th", "6th"];
  let grandMapped = 0, grandOcc = 0, grandPipe = 0, grandFloorTotal = 0;
  return (
    <div>
      {floors.map(floor => {
        const fo = offices.filter(o => o.floor === floor);
        const floorTotal = (floorDesks && floorDesks[floor]) || fo.reduce((s, o) => s + o.desks, 0);
        const mappedDesks = fo.reduce((s, o) => s + o.desks, 0);
        const occ = fo.filter(o => o.status === "occupied").reduce((s, o) => s + o.desks, 0);
        const pipe = fo.filter(o => o.status === "pipeline").reduce((s, o) => s + o.desks, 0);
        const unmapped = floorTotal - mappedDesks;
        const pct = floorTotal > 0 ? (occ / floorTotal) * 100 : 0;
        grandMapped += mappedDesks; grandOcc += occ; grandPipe += pipe; grandFloorTotal += floorTotal;
        const floorLabel = floor === "Grd" ? "Ground" : floor === "LG" ? "Basement / LG" : floor + " Floor";
        return (
          <div key={floor} style={{ marginBottom: 12, opacity: floorTotal === 0 ? 0.45 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span onClick={() => { if (typeof onFloorClick === "function") onFloorClick(floor); }} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: "var(--border)", textUnderlineOffset: 3 }}>{floorLabel} ↗</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {floorTotal === 0 ? "TBD" : <>{occ}/{floorTotal} desks ({Math.round(pct)}%)</>}
                {pipe > 0 && <span style={{ color: "#E8A317" }}> +{pipe} pipeline</span>}
                {unmapped > 0 && <span style={{ color: "#6B7A94" }}> · {unmapped} not mapped</span>}
              </span>
            </div>
            {floorTotal > 0 && <MiniBar value={occ} max={floorTotal} color={pct >= 90 ? "#1D9E75" : pct >= 70 ? "#3B82F6" : "#E74C3C"} />}
            {/* Floor-level desk rate & weighted expiry */}
            {(() => {
              const occFo = fo.filter(o => o.status === "occupied" && o.deskRate > 0);
              const totD = occFo.reduce((s, o) => s + o.desks, 0);
              if (totD === 0) return null;
              const wRate = Math.round(occFo.reduce((s, o) => s + o.deskRate * o.desks, 0) / totD);
              const floorMRR = occFo.reduce((s, o) => s + o.mrr, 0);
              const withExp = occFo.filter(o => o.contractEnd);
              const now = new Date("2026-04-05");
              let expInfo = null;
              if (withExp.length > 0) {
                const tDays = withExp.reduce((s, o) => s + Math.round((new Date(o.contractEnd) - now) / 86400000) * o.desks, 0);
                const tD = withExp.reduce((s, o) => s + o.desks, 0);
                const avg = Math.round(tDays / tD);
                const dt = new Date(now.getTime() + avg * 86400000);
                expInfo = { days: avg, label: dt.toISOString().slice(0, 7) };
              }
              return (
                <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10, flexWrap: "wrap" }}>
                  <span style={{ color: wRate >= 425 ? "#1D9E75" : wRate >= 350 ? "#E8A317" : "#E74C3C" }}>Avg rate: <strong>£{wRate}/d</strong></span>
                  <span style={{ color: "var(--text-dim)" }}>MRR: <strong>{fmt(floorMRR)}</strong></span>
                  {expInfo && <span style={{ color: expInfo.days <= 90 ? "#E74C3C" : expInfo.days <= 180 ? "#E8A317" : "var(--text-dim)" }}>Wtd expiry: <strong>{expInfo.label}</strong> ({expInfo.days}d)</span>}
                  {withExp.length < occFo.length && <span style={{ color: "#6B7A94" }}>{withExp.length}/{occFo.length} with end date</span>}
                  {(() => { const est = occFo.filter(o => o.estimated).length; return est > 0 ? <span style={{ color: "#E8A317" }}>{est} est. desk counts</span> : null; })()}
                </div>
              );
            })()}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
              {(() => {
                // Group offices by tenant for multi-room indication
                const tenantCount = {};
                fo.forEach(o => { if (o.tenant) tenantCount[o.tenant] = (tenantCount[o.tenant] || 0) + 1; });
                let lastTenant = null;
                return fo.map((o, idx) => {
                  const isMulti = o.tenant && tenantCount[o.tenant] > 1;
                  const isFirstOfGroup = isMulti && o.tenant !== lastTenant;
                  const isLastOfGroup = isMulti && (idx === fo.length - 1 || fo[idx + 1]?.tenant !== o.tenant);
                  lastTenant = o.tenant;
                  const totalForTenant = isFirstOfGroup ? fo.filter(x => x.tenant === o.tenant).reduce((s, x) => s + x.desks, 0) : 0;
                  const totalMRR = isFirstOfGroup ? fo.filter(x => x.tenant === o.tenant).reduce((s, x) => s + x.mrr, 0) : 0;
                  return (
                    <span key={o.id} style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                      {isFirstOfGroup && <span style={{ fontSize: 7, color: statusColor(o.status), marginRight: 2, opacity: 0.7 }} title={`${o.tenant}: ${tenantCount[o.tenant]} rooms, ${totalForTenant}d, ${fmt(totalMRR)}/m`}>⟨</span>}
                      <div title={`${o.id}: ${o.tenant || "Vacant"} (${o.estimated ? "~" : ""}${o.desks}d${o.deskRate ? " @ " + fmt(o.deskRate) + "/d" : ""}${o.partTime ? " PT" : ""}${o.estimated ? " EST" : ""}${o.contractEnd ? " · Exp: " + o.contractEnd.slice(0,7) : ""}${isMulti ? " · " + tenantCount[o.tenant] + " rooms" : ""})`} style={{
                        width: Math.max(18, Math.min(90, o.desks * 2.5)), height: 20,
                        background: statusColor(o.status) + "22", border: `1.5px solid ${statusColor(o.status)}`,
                        borderRadius: 3, fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center",
                        color: statusColor(o.status), fontWeight: 600, cursor: "default",
                        borderStyle: o.estimated ? "dashed" : "solid",
                      }}>
                        {o.id.replace(/^0/, "")}{o.partTime ? "·PT" : ""}
                      </div>
                      {isLastOfGroup && <span style={{ fontSize: 7, color: statusColor(o.status), marginLeft: 2, opacity: 0.7 }}>⟩</span>}
                      {isLastOfGroup && <span style={{ fontSize: 7, color: statusColor(o.status), marginLeft: 1, marginRight: 4, opacity: 0.6 }}>{o.tenant.split(" ")[0]}</span>}
                    </span>
                  );
                });
              })()}
              {/* Meeting rooms on this floor */}
              {meetingRooms && (() => {
                const floorRooms = meetingRooms.filter(r => r.floor === floor);
                if (floorRooms.length === 0) return null;
                return floorRooms.map(r => (
                  <div key={r.name} title={`${r.name} (${r.capacity} seats · £${r.hourlyRate}/hr · ${r.avgHoursPerMonth}h/m avg)`} style={{
                    width: Math.max(30, r.capacity * 2), height: 20,
                    background: "#3B82F622", border: "1.5px solid #3B82F6",
                    borderRadius: 3, fontSize: 7, display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#3B82F6", fontWeight: 600, cursor: "default",
                  }}>
                    {r.name.replace("Room ", "").replace(" The Lounge", "").replace(" The Classroom", "").replace(" - Conversation Room", "")}
                  </div>
                ));
              })()}
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 10, color: "var(--text-dim)" }}>
        {[["#1D9E75", "Occupied"], ["#E8A317", "Pipeline"], ["#E74C3C", "Vacant"], ["#3B82F6", "Meeting Room"]].map(([c, l]) => (
          <span key={l}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: c, marginRight: 4 }} />{l}</span>
        ))}
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, border: "1.5px dashed #E8A317", marginRight: 4 }} />Est. desks</span>
        <span><span style={{ display: "inline-block", fontSize: 7, padding: "0 3px", borderRadius: 2, background: "#8B5CF622", color: "#8B5CF6", fontWeight: 600, marginRight: 4 }}>PT</span>Part-time</span>
      </div>
      {/* Total row */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "2px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>{grandFloorTotal.toLocaleString()}</div><div style={{ fontSize: 9, color: "var(--text-dim)" }}>Floor Desks</div></div>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>{grandMapped.toLocaleString()}</div><div style={{ fontSize: 9, color: "var(--text-dim)" }}>Mapped</div></div>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: totalDesks ? (grandFloorTotal === totalDesks ? "#1D9E75" : "#E8A317") : "var(--text)" }}>{totalDesks ? totalDesks.toLocaleString() : "—"}</div><div style={{ fontSize: 9, color: "var(--text-dim)" }}>Building Total</div></div>
        <div><div style={{ fontSize: 16, fontWeight: 700, color: totalDesks && grandFloorTotal !== totalDesks ? "#E74C3C" : "var(--text-dim)" }}>{totalDesks ? (totalDesks - grandFloorTotal) : "—"}</div><div style={{ fontSize: 9, color: "var(--text-dim)" }}>Unaccounted</div></div>
      </div>
    </div>
  );
}

// ─── Sold Not Occupied ──────────────────────────────────────────────────
function SoldNotOccupied({ deals }) {
  const now = new Date(TODAY);
  const pending = deals.filter(d => {
    if (d.status !== "signed" && d.status !== "approved") return false;
    const start = new Date(d.startDate);
    if (start <= now) {
      // Started but might be in rent-free
      if (d.rentFree && d.rentFree !== "None") return true;
      return false;
    }
    return true; // Future start date
  }).map(d => {
    const start = new Date(d.startDate);
    const daysToStart = daysBetween(now, d.startDate);
    let reason = "";
    if (start > now) {
      reason = `Starts ${d.startDate.slice(0, 7)}`;
    } else if (d.rentFree && d.rentFree !== "None") {
      reason = `Rent-free: ${d.rentFree}`;
    }
    return { ...d, daysToStart, reason };
  }).sort((a, b) => a.daysToStart - b.daysToStart);

  const totalDesks = pending.reduce((s, d) => s + (d.desks || 0), 0);
  const totalMRR = pending.reduce((s, d) => s + (d.newMRR || 0), 0);
  const totalIncremental = pending.reduce((s, d) => s + (d.incrementalMRR != null ? d.incrementalMRR : (d.newMRR || 0) - (d.oldMRR || 0)), 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#8B5CF622", border: "1px solid #8B5CF644", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#8B5CF6" }}>{pending.length}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Deals pending</div>
        </div>
        <div style={{ background: "#8B5CF622", border: "1px solid #8B5CF644", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#8B5CF6" }}>{totalDesks}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Desks sold, not occupied</div>
        </div>
        <div style={{ background: "#8B5CF622", border: "1px solid #8B5CF644", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#8B5CF6" }}>{fmt(totalMRR)}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Total MRR incoming</div>
        </div>
        <div style={{ background: "#1D9E7522", border: "1px solid #1D9E7544", borderRadius: 8, padding: 12, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1D9E75" }}>{fmt(totalIncremental)}</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Incremental MRR</div>
        </div>
      </div>
      {pending.map((d, i) => {
        const incr = d.incrementalMRR != null ? d.incrementalMRR : (d.newMRR || 0) - (d.oldMRR || 0);
        return (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 50px 70px 60px 70px 1fr", gap: 6, padding: "8px 0", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 12 }}>
          <span style={{ fontWeight: 500 }}>{d.tenant}</span>
          <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{d.desks}d</span>
          <span style={{ textAlign: "right", fontWeight: 600 }}>{fmt(d.newMRR)}</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "#1D9E75" }}>+{fmt(incr)}</span>
          <span style={{ textAlign: "right" }}>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, background: statusColor(d.status) + "22", color: statusColor(d.status) }}>{d.status}</span>
          </span>
          <span style={{ color: "#8B5CF6", fontSize: 11, textAlign: "right" }}>{d.reason}</span>
        </div>
        );
      })}
      {pending.length === 0 && <div style={{ color: "var(--text-dim)", fontSize: 12 }}>All signed deals are currently occupied and paying</div>}
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────
export default function ShoreditchDashboard() {
  const [db, setDb] = useState(null);
  const [tab, setTab] = useState("overview");
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDb(JSON.parse(stored));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
        setDb(SEED_DATA);
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
      setDb(SEED_DATA);
    }
    setLoading(false);
  }, []);

  const doExport = useCallback((type) => {
    if (!db) return;
    const map = {
      offices: [db.offices, ["id", "floor", "desks", "status", "tenant", "mrr", "deskRate", "contractEnd", "partTime", "estimated"], "shoreditch_offices.csv"],
      contracts: [db.contracts, ["tenant", "office", "desks", "currentMRR", "steppedMRR", "stepDate", "contractEnd", "type", "status", "noticeMonths"], "shoreditch_contracts.csv"],
      deals: [db.deals, ["tenant", "type", "desks", "office", "oldMRR", "newMRR", "incrementalMRR", "newDeskRate", "term", "rentFree", "startDate", "status", "broker"], "shoreditch_deals.csv"],
    };
    if (map[type]) csvExport(...map[type]);
  }, [db]);

  const resetData = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_DATA));
    setDb(SEED_DATA);
  }, []);

  if (loading || !db) return <div style={{ padding: 40, textAlign: "center", color: "#6B7A94", fontFamily: "system-ui" }}>{loading ? "Loading..." : "Error"}</div>;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "floors", label: "Floors" },
    { id: "renewals", label: "Renewals" },
    { id: "rates", label: "Rates" },
    { id: "deals", label: "Deals" },
    { id: "sold", label: "Sold / Not Occupied" },
    { id: "vacant", label: "Vacant" },
    { id: "revenue", label: "Revenue" },
    { id: "meetings", label: "Meeting Rooms" },
    { id: "ancillary", label: "Ancillary" },
    { id: "usage", label: "Usage" },
    { id: "forecast", label: "Forecast" },
  ];

  // Use KPI occupied desks (1,529) as the building-wide number, not just mapped offices
  const buildingOcc = db.kpi.occupiedDesks;
  const totalPipe = db.offices.filter(o => o.status === "pipeline").reduce((s, o) => s + o.desks, 0);
  const buildingVac = db.meta.totalDesks - buildingOcc - totalPipe;
  // Mapped office stats (for floor map & rates tabs)
  const totalOcc = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.desks, 0);
  const totalVac = db.offices.filter(o => o.status === "vacant").reduce((s, o) => s + o.desks, 0);
  const totalMapped = totalOcc + totalPipe + totalVac;
  const mrrMapped = db.offices.filter(o => o.status === "occupied").reduce((s, o) => s + o.mrr, 0);
  const dealMRR = db.deals.reduce((s, d) => s + (d.newMRR || 0), 0);
  const dealIncremental = db.deals.reduce((s, d) => s + (d.incrementalMRR != null ? d.incrementalMRR : (d.newMRR || 0) - (d.oldMRR || 0)), 0);

  const Btn = ({ onClick, children }) => (
    <button onClick={onClick} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 5, cursor: "pointer", background: "var(--accent)", color: "#fff", border: "none", fontWeight: 600 }}>{children}</button>
  );

  const Card = ({ children, style }) => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, ...style }}>{children}</div>
  );

  const dark = { bg: "#0C0F14", card: "#151921", border: "#1E2533", text: "#E8ECF1", dim: "#6B7A94", accent: "#1D9E75", accentDim: "#1D9E7566", warn: "#E74C3C", chartDot: "#0C0F14" };
  const light = { bg: "#F4F5F7", card: "#FFFFFF", border: "#DDE1E8", text: "#1A1D23", dim: "#6B7280", accent: "#0E8A63", accentDim: "#0E8A6344", warn: "#DC2626", chartDot: "#FFFFFF" };
  const t = theme === "dark" ? dark : light;

  return (
    <div style={{
      "--bg": t.bg, "--bg-card": t.card, "--border": t.border,
      "--text": t.text, "--text-dim": t.dim, "--accent": t.accent,
      "--accent-dim": t.accentDim, "--warn": t.warn, "--chart-dot": t.chartDot,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      background: "var(--bg)", color: "var(--text)", minHeight: "100vh",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ padding: "20px 24px 0", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 600, marginBottom: 2 }}>Shoreditch Exchange</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>Asset Management</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 10px", cursor: "pointer", color: "var(--text-dim)", fontSize: 16, lineHeight: 1 }} title="Toggle theme">{theme === "dark" ? "☀️" : "🌙"}</button>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Updated</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{db.meta.lastUpdated}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, overflow: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 14px", fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "var(--accent)" : "var(--text-dim)",
              background: "none", border: "none", cursor: "pointer",
              borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 24px 24px" }}>

        {/* ── OVERVIEW ────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
              <KPICard label="Occupancy" value={fmtPct(db.kpi.occupancyPct)} target={`Target: ${fmtPct(db.kpi.occupancyTarget)}`} good={db.kpi.occupancyPct >= 85} />
              <KPICard label="Occupied" value={db.kpi.occupiedDesks.toLocaleString()} target={`of ${db.meta.totalDesks}`} />
              <KPICard label="Office Rev" value={fmt(db.kpi.officeRevenue)} target={`Target: ${fmt(db.kpi.officeRevenueTarget)}`} good={db.kpi.officeRevenue >= db.kpi.officeRevenueTarget * 0.85} />
              <KPICard label="Total Rev" value={fmt(db.kpi.totalRevenue)} target={`Target: ${fmt(db.kpi.totalRevenueTarget)}`} good={db.kpi.totalRevenue >= db.kpi.totalRevenueTarget * 0.8} />
              <KPICard label="Avg Rate" value={fmt(db.kpi.avgDeskRate)} target={`Target: >${fmt(db.kpi.avgDeskRateTarget)}`} good={db.kpi.avgDeskRate >= db.kpi.avgDeskRateTarget} />
              <KPICard label="Churn" value={fmtPct(db.kpi.churnPct)} target={`Target: <${fmtPct(db.kpi.churnTarget)}`} good={db.kpi.churnPct <= db.kpi.churnTarget} />
              <KPICard label="Proposals" value={fmt(db.kpi.proposalsOut)} />
              <KPICard label="OpEx /psf" value={`£${db.kpi.opexPsf}`} target={`Budget: £${db.kpi.opexBudget}`} good={db.kpi.opexPsf <= db.kpi.opexBudget * 1.15} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Desk Summary <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-dim)" }}>of {db.meta.totalDesks.toLocaleString()}</span></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{buildingOcc.toLocaleString()}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Occupied</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: "#E8A317" }}>{totalPipe}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Pipeline</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: "#E74C3C" }}>{buildingVac}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Vacant</div></div>
                </div>
                <div style={{ marginTop: 10 }}><MiniBar value={buildingOcc} max={db.meta.totalDesks} /></div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>Office MRR: {fmt(mrrMapped)} · Deal pipeline: {fmt(dealIncremental)}/m incremental</div>
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Revenue</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 10 }}>Office revenue (green) · Total includes DD, meetings, events</div>
                <BarChart data={db.revenue.historicOffice} valueKey="amount" labelKey="month" formatVal={fmt} />
                {db.revenue.historicTotal && (() => {
                  const latestTotal = db.revenue.historicTotal[db.revenue.historicTotal.length - 1]?.amount || 0;
                  const latestOffice = db.revenue.historicOffice[db.revenue.historicOffice.length - 1]?.amount || 0;
                  const ancillary = latestTotal - latestOffice;
                  return (
                    <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "var(--text-dim)" }}>
                      <span>Total: <strong style={{ color: "var(--text)" }}>{fmt(latestTotal)}</strong></span>
                      <span>Office: <strong style={{ color: "var(--accent)" }}>{fmt(latestOffice)}</strong></span>
                      <span>Other: <strong style={{ color: "#8B5CF6" }}>{fmt(ancillary)}</strong></span>
                    </div>
                  );
                })()}
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Occupancy Trend</div>
                <LineChart data={db.occupancyTrend.map(d => ({ ...d, pct: Math.round((d.occupied / d.total) * 100) }))} valueKey="pct" labelKey="month" targetLine={93} formatVal={v => v + "%"} />
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Avg Desk Rate Trend</div>
                <LineChart data={db.deskRateTrend} valueKey="rate" labelKey="month" targetLine={425} formatVal={fmt} color="#3B82F6" />
              </Card>
            </div>
          </div>
        )}

        {/* ── FLOORS ──────────────────────────────────────────────── */}
        {tab === "floors" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Occupancy by Floor</div>
              <Btn onClick={() => doExport("offices")}>Export CSV</Btn>
            </div>
            <FloorMap offices={db.offices} floorDesks={db.meta.floorDesks} totalDesks={db.meta.totalDesks} onFloorClick={setSelectedFloor} meetingRooms={db.revenue.meetingRoomDetails} />
          </Card>
        )}

        {/* ── RENEWALS ────────────────────────────────────────────── */}
        {tab === "renewals" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Renewal & Contract Timeline</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>Days until end · Red = below £400/desk</div>
              </div>
              <Btn onClick={() => doExport("contracts")}>Export CSV</Btn>
            </div>
            {(() => {
              const now = new Date(TODAY);
              const all = db.contracts.filter(c => c.type === "renewal" && c.contractEnd)
                .map(c => ({ ...c, daysLeft: daysBetween(now, c.contractEnd), deskRate: c.desks > 0 ? Math.round(c.currentMRR / c.desks) : 0 }))
                .sort((a, b) => a.daysLeft - b.daysLeft);
              const upcoming = all.filter(r => r.daysLeft > 0);
              const expired = all.filter(r => r.daysLeft <= 0);
              const Row = ({ r, dim }) => (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 45px 60px 60px 60px", gap: 4, padding: "6px 0", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 12, opacity: dim ? 0.45 : 1 }}>
                  <span style={{ fontWeight: 500 }}>{r.tenant}</span>
                  <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{r.desks}d</span>
                  <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{fmt(r.currentMRR)}</span>
                  <span style={{ textAlign: "right", color: r.deskRate < 400 ? "#E74C3C" : "var(--text-dim)" }}>{fmt(r.deskRate)}/d</span>
                  {dim ? (
                    <span style={{ textAlign: "right", fontSize: 9, padding: "2px 5px", borderRadius: 3, background: statusColor(r.status) + "22", color: statusColor(r.status) }}>{r.status.replace("_", " ")}</span>
                  ) : (
                    <span style={{ textAlign: "right", fontWeight: 600, fontSize: 11, color: r.daysLeft <= 30 ? "#E74C3C" : r.daysLeft <= 90 ? "#E8A317" : "var(--text-dim)" }}>{r.daysLeft}d</span>
                  )}
                </div>
              );
              return (
                <div>
                  <div style={{ fontWeight: 600, fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Upcoming ({upcoming.length})</div>
                  {upcoming.map((r, i) => <Row key={i} r={r} />)}
                  {expired.length > 0 && <div style={{ fontWeight: 600, fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 14, marginBottom: 6 }}>Expired / Churned ({expired.length})</div>}
                  {expired.map((r, i) => <Row key={i} r={r} dim />)}
                </div>
              );
            })()}
          </Card>
        )}

        {/* ── DESK RATES ──────────────────────────────────────────── */}
        {tab === "rates" && (
          <Card>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Desk Rate Distribution</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>Target: £425+/desk · Sorted lowest → highest</div>
            {(() => {
              const estCount = db.offices.filter(o => o.status === "occupied" && o.deskRate > 0 && o.estimated).length;
              if (estCount > 0) return (
                <div style={{ padding: "8px 10px", marginBottom: 12, background: "#E8A31711", border: "1px solid #E8A31733", borderRadius: 6, fontSize: 11, color: "#E8A317" }}>
                  ⚠ <strong>Data quality:</strong> {estCount} office{estCount > 1 ? "s have" : " has"} estimated desk count{estCount > 1 ? "s" : ""} (marked <strong>~</strong>). All other counts verified from Feb 2026 analysis sheet.
                </div>
              );
              return null;
            })()}
            {(() => {
              // Build multi-room lookup
              const tenantCount = {};
              db.offices.filter(o => o.status === "occupied" && o.tenant).forEach(o => {
                if (!tenantCount[o.tenant]) tenantCount[o.tenant] = [];
                tenantCount[o.tenant].push(o.id);
              });
              const rated = db.offices.filter(o => o.status === "occupied" && o.deskRate > 0)
                .map(o => {
                  const rooms = tenantCount[o.tenant] || [o.id];
                  const roomIndex = rooms.indexOf(o.id) + 1;
                  const roomLabel = rooms.length > 1 ? `${roomIndex}/${rooms.length}` : null;
                  return { id: o.id, tenant: o.tenant, rate: o.deskRate, desks: o.desks, estimated: o.estimated, roomLabel };
                })
                .sort((a, b) => a.rate - b.rate);
              const below = rated.filter(r => r.rate < 425);
              const estCount = rated.filter(r => r.estimated).length;
              return (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10 }}>
                    {below.length} tenants ({below.reduce((s, r) => s + r.desks, 0)} desks) below target{estCount > 0 ? ` · ${estCount} with estimated desk counts` : ""}
                  </div>
                  {rated.map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid var(--border)", opacity: r.estimated ? 0.65 : 1 }}>
                      <span style={{ fontSize: 10, color: "var(--text-dim)", minWidth: 42, fontFamily: "monospace" }}>{r.id.replace(/^0/, "")}</span>
                      <span style={{ fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.tenant}
                        {r.roomLabel && <span style={{ marginLeft: 4, fontSize: 9, color: "#8B5CF6", fontWeight: 600 }}>{r.roomLabel}</span>}
                        {r.estimated && <span style={{ marginLeft: 4, fontSize: 9, color: "#E8A317" }} title="Desk count estimated — awaiting verification">~est</span>}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-dim)", minWidth: 28, textAlign: "right" }}>{r.estimated ? "~" : ""}{r.desks}d</span>
                      <div style={{ width: 80 }}><MiniBar value={r.rate} max={550} color={r.rate >= 425 ? "#1D9E75" : r.rate >= 350 ? "#E8A317" : "#E74C3C"} /></div>
                      <span style={{ fontSize: 11, fontWeight: 600, minWidth: 40, textAlign: "right", color: r.rate >= 425 ? "#1D9E75" : r.rate >= 350 ? "#E8A317" : "#E74C3C" }}>£{r.rate}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}

        {/* ── DEALS ───────────────────────────────────────────────── */}
        {tab === "deals" && (
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Deals Pipeline</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{db.deals.length} deals · {db.deals.reduce((s, d) => s + (d.desks || 0), 0)} desks · {fmt(dealMRR)}/m total · <span style={{ color: "var(--accent)" }}>{fmt(dealIncremental)}/m incremental</span></div>
              </div>
              <Btn onClick={() => doExport("deals")}>Export CSV</Btn>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Tenant", "Type", "Desks", "Office", "Current", "New MRR", "+Incr.", "Rate/d", "Term", "Start", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 6px", color: "var(--text-dim)", fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {db.deals.map((d, i) => {
                    const incr = d.incrementalMRR != null ? d.incrementalMRR : (d.newMRR || 0) - (d.oldMRR || 0);
                    return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 6px", fontWeight: 500 }}>{d.tenant}</td>
                      <td style={{ padding: "7px 6px" }}>
                        <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, background: d.type === "New" ? "#3B82F622" : d.type === "Growth" ? "#1D9E7522" : "#E8A31722", color: d.type === "New" ? "#3B82F6" : d.type === "Growth" ? "#1D9E75" : "#E8A317" }}>{d.type}</span>
                      </td>
                      <td style={{ padding: "7px 6px", textAlign: "right" }}>{d.desks}</td>
                      <td style={{ padding: "7px 6px", color: "var(--text-dim)", fontSize: 10 }}>{d.office || "—"}</td>
                      <td style={{ padding: "7px 6px", textAlign: "right", color: "var(--text-dim)" }}>{d.oldMRR ? fmt(d.oldMRR) : "—"}</td>
                      <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600 }}>{fmt(d.newMRR)}</td>
                      <td style={{ padding: "7px 6px", textAlign: "right", fontWeight: 600, color: "#1D9E75" }}>+{fmt(incr)}</td>
                      <td style={{ padding: "7px 6px", textAlign: "right", color: d.newDeskRate && d.newDeskRate < 400 ? "#E74C3C" : "var(--text)" }}>{d.newDeskRate ? `£${d.newDeskRate}` : "—"}</td>
                      <td style={{ padding: "7px 6px" }}>{d.term}</td>
                      <td style={{ padding: "7px 6px", color: "var(--text-dim)" }}>{d.startDate?.slice(0, 7) || "—"}</td>
                      <td style={{ padding: "7px 6px" }}><span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 600, background: statusColor(d.status) + "22", color: statusColor(d.status) }}>{d.status}</span></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── SOLD NOT OCCUPIED ────────────────────────────────────── */}
        {tab === "sold" && (
          <Card>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Sold but Not Yet Occupied</div>
            <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>Signed/approved deals with future start dates or active rent-free periods</div>
            <SoldNotOccupied deals={db.deals} />
          </Card>
        )}

        {/* ── VACANT UNITS ──────────────────────────────────────── */}
        {tab === "vacant" && (
          <div>
            {(() => {
              const TARGET_RATE = 425;
              const allOffices = db.offices;
              const vacant = allOffices.filter(o => o.status === "vacant");
              const occupied = allOffices.filter(o => o.status === "occupied");
              const pipeline = allOffices.filter(o => o.status === "pipeline");
              const pt = allOffices.filter(o => o.partTime && o.status === "occupied");
              const totalVacDesks = vacant.reduce((s, o) => s + o.desks, 0);
              const totalOccDesks = occupied.reduce((s, o) => s + o.desks, 0);
              const totalPipeDesks = pipeline.reduce((s, o) => s + o.desks, 0);
              const potentialMRR = totalVacDesks * TARGET_RATE;
              const floors = ["Grd", "1st", "2nd", "3rd", "4th", "5th", "6th"];
              const floorDesks = db.meta.floorDesks || {};

              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                    <div style={{ background: "#E74C3C22", border: "1px solid #E74C3C44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#E74C3C" }}>{vacant.length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Vacant offices</div>
                    </div>
                    <div style={{ background: "#E74C3C22", border: "1px solid #E74C3C44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#E74C3C" }}>{totalVacDesks}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Vacant desks</div>
                    </div>
                    <div style={{ background: "#E8A31722", border: "1px solid #E8A31744", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#E8A317" }}>{fmt(potentialMRR)}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Potential MRR @£{TARGET_RATE}/d</div>
                    </div>
                    <div style={{ background: "#8B5CF622", border: "1px solid #8B5CF644", borderRadius: 8, padding: 12, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#8B5CF6" }}>{pt.length}</div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Part-time offices</div>
                    </div>
                  </div>

                  <Card style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Vacant Units by Floor</div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>Feb 2026 snapshot — some units may have been let since. Potential at £{TARGET_RATE}/desk target rate.</div>
                    {floors.map(fl => {
                      const flVac = vacant.filter(o => o.floor === fl);
                      if (flVac.length === 0) return null;
                      const flDesks = flVac.reduce((s, o) => s + o.desks, 0);
                      const flPotential = flDesks * TARGET_RATE;
                      const floorLabel = fl === "Grd" ? "Ground" : fl === "LG" ? "Basement / LG" : fl + " Floor";
                      return (
                        <div key={fl} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{floorLabel}</span>
                            <span style={{ fontSize: 11, color: "#E74C3C" }}>{flDesks} desks vacant · {fmt(flPotential)}/m potential</span>
                          </div>
                          {flVac.map(o => (
                            <div key={o.id} style={{ display: "grid", gridTemplateColumns: "80px 50px 80px 1fr", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)", alignItems: "center", fontSize: 12 }}>
                              <span style={{ fontWeight: 600, color: "#E74C3C" }}>{o.id.replace(/^0/,"")}</span>
                              <span style={{ textAlign: "right", color: "var(--text-dim)" }}>{o.desks}d</span>
                              <span style={{ textAlign: "right", color: "#E8A317", fontWeight: 600 }}>{fmt(o.desks * TARGET_RATE)}/m</span>
                              <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
                                {o.partTime && <span style={{ padding: "1px 4px", borderRadius: 3, background: "#8B5CF622", color: "#8B5CF6", fontWeight: 600, marginRight: 4 }}>PT</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </Card>

                  <Card>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Building Reconciliation</div>
                    {(() => {
                      const rows = floors.map(fl => {
                        const total = floorDesks[fl] || 0;
                        const occ = allOffices.filter(o => o.floor === fl && o.status === "occupied").reduce((s, o) => s + o.desks, 0);
                        const vac = allOffices.filter(o => o.floor === fl && o.status === "vacant").reduce((s, o) => s + o.desks, 0);
                        const pipe = allOffices.filter(o => o.floor === fl && o.status === "pipeline").reduce((s, o) => s + o.desks, 0);
                        const mapped = occ + vac + pipe;
                        const gap = total - mapped;
                        return { fl, total, occ, vac, pipe, mapped, gap };
                      });
                      const totals = rows.reduce((s, r) => ({ total: s.total + r.total, occ: s.occ + r.occ, vac: s.vac + r.vac, pipe: s.pipe + r.pipe, mapped: s.mapped + r.mapped }), { total: 0, occ: 0, vac: 0, pipe: 0, mapped: 0 });
                      return (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                                {["Floor", "Total", "Occupied", "Vacant", "Pipeline", "Mapped", "Gap"].map(h => (
                                  <th key={h} style={{ textAlign: h === "Floor" ? "left" : "right", padding: "6px 8px", color: "var(--text-dim)", fontWeight: 600, fontSize: 9, textTransform: "uppercase" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r.fl} style={{ borderBottom: "1px solid var(--border)" }}>
                                  <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.fl === "Grd" ? "Ground" : r.fl}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.total}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#1D9E75", fontWeight: 600 }}>{r.occ}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#E74C3C", fontWeight: 600 }}>{r.vac || "—"}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: "#E8A317" }}>{r.pipe || "—"}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.mapped}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", color: r.gap > 0 ? "#E74C3C" : r.gap < 0 ? "#E8A317" : "#1D9E75", fontWeight: 600 }}>{r.gap === 0 ? "✓" : r.gap > 0 ? `+${r.gap}` : r.gap}</td>
                                </tr>
                              ))}
                              <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700 }}>
                                <td style={{ padding: "8px 8px" }}>Total</td>
                                <td style={{ padding: "8px 8px", textAlign: "right" }}>{totals.total}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: "#1D9E75" }}>{totals.occ}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: "#E74C3C" }}>{totals.vac}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: "#E8A317" }}>{totals.pipe}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right" }}>{totals.mapped}</td>
                                <td style={{ padding: "8px 8px", textAlign: "right", color: "var(--text-dim)" }}>{db.meta.totalDesks - totals.mapped}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8 }}>
                            Building total: {db.meta.totalDesks} desks · Mapped: {totals.mapped} · Unmapped: {db.meta.totalDesks - totals.mapped} (DD areas: 01-122 hot desks 53d, 01-126 dedi desks 22d, 02-112 shared 33d, co-working 33d)
                          </div>
                        </div>
                      );
                    })()}
                  </Card>
                </>
              );
            })()}
          </div>
        )}

        {/* ── REVENUE ─────────────────────────────────────────────── */}
        {tab === "revenue" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Total Revenue — Jan 2025 to Mar 2026</div>
              {db.revenue.historicTotal && <BarChart data={db.revenue.historicTotal} valueKey="amount" labelKey="month" height={170} formatVal={fmt} color="#8B5CF6" />}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6" }}>{fmt(db.revenue.historicTotal?.[db.revenue.historicTotal.length - 1]?.amount)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Total (Mar 26)</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{fmt(db.revenue.historicOffice[db.revenue.historicOffice.length - 1].amount)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Offices</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#E8A317" }}>{fmt((db.revenue.historicTotal?.[db.revenue.historicTotal.length - 1]?.amount || 0) - db.revenue.historicOffice[db.revenue.historicOffice.length - 1].amount)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Ancillary</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1D9E75" }}>+{Math.round(((db.revenue.historicTotal?.[db.revenue.historicTotal.length - 1]?.amount || 1) / (db.revenue.historicTotal?.[0]?.amount || 1) - 1) * 100)}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Growth (15m)</div>
                </div>
              </div>
            </Card>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Office Revenue</div>
              <BarChart data={db.revenue.historicOffice} valueKey="amount" labelKey="month" height={130} formatVal={fmt} />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Occupancy Trend</div>
                <LineChart data={db.occupancyTrend.map(d => ({ ...d, pct: Math.round((d.occupied / d.total) * 100) }))} valueKey="pct" labelKey="month" height={130} targetLine={93} formatVal={v => v + "%"} />
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Avg Desk Rate Trend</div>
                <LineChart data={db.deskRateTrend} valueKey="rate" labelKey="month" height={130} targetLine={425} formatVal={fmt} color="#3B82F6" />
              </Card>
            </div>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Profit & Loss — Mar 2026 Actuals</div>
              <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 12 }}>From 10 April KPI report</div>
              {db.pnl && db.pnl.length > 0 && (() => {
                const latest = db.pnl[db.pnl.length - 1];
                const prev = db.pnl.length > 1 ? db.pnl[db.pnl.length - 2] : null;
                const opexLabels = { agencyFees: "Agency Fees", salaries: "Salaries", security: "Security", internet: "Internet", complianceAndME: "Compliance & M&E", repairs: "Repairs & Maintenance", cleaning: "Cleaning", recycling: "Recycling", utilities: "Utilities", fAndB: "F&B", adminExpense: "Admin Expense", marketing: "Marketing & Experience" };
                const propLabels = { rates: "Rates", serviceCharge: "Service Charge", groundRent: "Ground Rent" };
                const PnlRow = ({ label, value, prevValue, bold, color }) => {
                  const pct = prevValue && prevValue > 0 ? Math.round(((value / prevValue) - 1) * 100) : null;
                  return (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: bold ? "6px 0" : "3px 0", borderBottom: bold ? "2px solid var(--border)" : "1px solid var(--border)", fontWeight: bold ? 700 : 400 }}>
                      <span style={{ flex: 1, fontSize: bold ? 12 : 11, color: color || "var(--text)" }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: bold ? 700 : 600, minWidth: 65, textAlign: "right", color: color || "var(--text)" }}>{fmt(value)}</span>
                      {prev && <span style={{ fontSize: 9, minWidth: 45, textAlign: "right", color: pct > 0 ? "#1D9E75" : pct < 0 ? "#E74C3C" : "var(--text-dim)" }}>{pct != null ? (pct > 0 ? "+" : "") + pct + "%" : ""}</span>}
                    </div>
                  );
                };
                return (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Revenue {prev ? `(vs ${prev.month})` : ""}</div>
                    {Object.entries(latest.revenue).map(([k, v]) => <PnlRow key={k} label={k === "ddHotDesks" ? "DD & Hot Desks" : k === "meetingRooms" ? "Meeting Rooms" : k === "offices" ? "Private Offices" : k.charAt(0).toUpperCase() + k.slice(1)} value={v} prevValue={prev?.revenue[k]} />)}
                    <PnlRow label="Total Revenue" value={latest.totalRevenue} prevValue={prev?.totalRevenue} bold color="#1D9E75" />
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 10, marginBottom: 4 }}>Building OpEx</div>
                    {Object.entries(latest.opex).map(([k, v]) => <PnlRow key={k} label={opexLabels[k] || k} value={v} prevValue={prev?.opex[k]} />)}
                    <PnlRow label="Total Building OpEx" value={latest.totalOpex} prevValue={prev?.totalOpex} bold color="#E74C3C" />
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 10, marginBottom: 4 }}>Property Costs</div>
                    {Object.entries(latest.propertyCosts).map(([k, v]) => <PnlRow key={k} label={propLabels[k] || k} value={v} prevValue={prev?.propertyCosts[k]} />)}
                    <PnlRow label="Total Property Costs" value={latest.totalPropertyCosts} prevValue={prev?.totalPropertyCosts} bold />
                    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 6, background: latest.noi > 0 ? "#1D9E7511" : "#E74C3C11", border: `1px solid ${latest.noi > 0 ? "#1D9E7533" : "#E74C3C33"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>NOI</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: latest.noi > 0 ? "#1D9E75" : "#E74C3C" }}>{fmt(latest.noi)}</span>
                      </div>
                      {prev && <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>vs {prev.month}: {fmt(prev.noi)} ({Math.round(((latest.noi / prev.noi) - 1) * 100) > 0 ? "+" : ""}{Math.round(((latest.noi / prev.noi) - 1) * 100)}%)</div>}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* ── MEETING ROOMS ──────────────────────────────────────── */}
        {tab === "meetings" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Meeting Room Revenue</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>Monthly revenue (from credit pack purchases) — all bookings are credit-based, zero direct cash payments at booking level</div>
              {db.revenue.meetingRooms && (
                <>
                  <BarChart data={db.revenue.meetingRooms} valueKey="amount" labelKey="month" height={140} formatVal={fmt} color="#3B82F6" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#3B82F6" }}>{fmt(db.revenue.meetingRooms[db.revenue.meetingRooms.length - 1].amount)}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Latest Month</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(Math.round(db.revenue.meetingRooms.reduce((s, d) => s + d.amount, 0) / db.revenue.meetingRooms.length))}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Monthly Avg</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(Math.max(...db.revenue.meetingRooms.map(d => d.amount)))}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Peak</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>35</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Rooms (236 seats)</div></div>
                  </div>
                </>
              )}
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Occupied Hours / Month</div>
                {db.revenue.meetingRoomHours && <BarChart data={db.revenue.meetingRoomHours} valueKey="hours" labelKey="month" height={120} formatVal={v => v + "h"} color="#3B82F6" />}
                {db.revenue.meetingRoomHours && (() => {
                  const avg = Math.round(db.revenue.meetingRoomHours.reduce((s, d) => s + d.hours, 0) / db.revenue.meetingRoomHours.length);
                  const latest = db.revenue.meetingRoomHours[db.revenue.meetingRoomHours.length - 1];
                  return <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Latest: <strong>{latest.hours}h</strong> · Avg: <strong>{avg}h/m</strong></div>;
                })()}
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Bookings / Month</div>
                {db.revenue.meetingRoomHours && <BarChart data={db.revenue.meetingRoomHours} valueKey="bookings" labelKey="month" height={120} formatVal={v => v} color="#8B5CF6" />}
                {db.revenue.meetingRoomHours && (() => {
                  const avg = Math.round(db.revenue.meetingRoomHours.reduce((s, d) => s + d.bookings, 0) / db.revenue.meetingRoomHours.length);
                  return <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Avg: <strong>{avg} bookings/m</strong></div>;
                })()}
              </Card>
            </div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Room-by-Room Utilisation</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Sorted by avg hours/month · Avail ~160h/m per room (8h × 20 days)</div>
              </div>
              <div style={{ padding: "8px 10px", marginBottom: 8, background: "#E74C3C11", border: "1px solid #E74C3C33", borderRadius: 6, fontSize: 11, color: "#E74C3C" }}>
                ⚠ <strong>Booking control gap:</strong> 100% of bookings use credits — zero direct cash payments detected. Revenue comes from credit pack purchases, not individual bookings. Rooms can be booked and occupied without generating trackable revenue.
              </div>
              <div style={{ padding: "8px 10px", marginBottom: 8, background: "#3B82F611", border: "1px solid #3B82F633", borderRadius: 6, fontSize: 11, color: "#3B82F6" }}>
                ℹ <strong>Action in progress:</strong> Working to tighten enforcement on meeting room bookings and improve data quality on usage, credit vs cash payment split, and unbilled occupancy. Target: full visibility of revenue per room per month.
              </div>
              {db.revenue.meetingRoomDetails && (() => {
                const maxHours = 160;
                const sorted = [...db.revenue.meetingRoomDetails].sort((a, b) => b.avgHoursPerMonth - a.avgHoursPerMonth);
                const floors = ["LG", "1st", "2nd", "3rd", "5th", "6th"];
                return floors.map(fl => {
                  const floorRooms = sorted.filter(r => r.floor === fl);
                  if (floorRooms.length === 0) return null;
                  const totalSeats = floorRooms.reduce((s, r) => s + r.capacity, 0);
                  const avgUtil = Math.round(floorRooms.reduce((s, r) => s + r.avgHoursPerMonth, 0) / floorRooms.length);
                  const floorLabel = fl === "LG" ? "Basement / LG" : fl + " Floor";
                  return (
                    <div key={fl} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", marginBottom: 4 }}>
                        {floorLabel} — {floorRooms.length} rooms, {totalSeats} seats, avg {avgUtil}h/m
                      </div>
                      {floorRooms.map((r, i) => {
                        const utilPct = Math.round((r.avgHoursPerMonth / maxHours) * 100);
                        const impliedRev = r.avgHoursPerMonth * r.hourlyRate;
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", borderBottom: "1px solid var(--border)", fontSize: 11 }}>
                            <span style={{ width: 155, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name.replace("Room ", "")}</span>
                            <span style={{ width: 35, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>{r.capacity}p</span>
                            <span style={{ width: 50, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>£{r.hourlyRate}/h</span>
                            <div style={{ width: 80 }}><MiniBar value={r.avgHoursPerMonth} max={maxHours} color={utilPct >= 30 ? "#1D9E75" : utilPct >= 15 ? "#E8A317" : "#E74C3C"} /></div>
                            <span style={{ width: 40, textAlign: "right", fontWeight: 600, color: utilPct >= 30 ? "#1D9E75" : utilPct >= 15 ? "#E8A317" : "#E74C3C" }}>{r.avgHoursPerMonth}h</span>
                            <span style={{ width: 30, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>{utilPct}%</span>
                            <span style={{ width: 55, textAlign: "right", color: "var(--text-dim)", fontSize: 10 }}>~{fmt(impliedRev)}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
              {db.revenue.meetingRoomDetails && (() => {
                const total = db.revenue.meetingRoomDetails;
                const totalImplied = total.reduce((s, r) => s + r.avgHoursPerMonth * r.hourlyRate, 0);
                const totalHours = total.reduce((s, r) => s + r.avgHoursPerMonth, 0);
                const actualRev = db.revenue.meetingRooms ? Math.round(db.revenue.meetingRooms.reduce((s, d) => s + d.amount, 0) / db.revenue.meetingRooms.length) : 0;
                return (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "2px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ fontWeight: 700 }}>Total implied revenue (at rack rate)</span>
                      <span style={{ fontWeight: 700 }}>{fmt(totalImplied)}/m ({totalHours}h)</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, color: "var(--text-dim)" }}>
                      <span>Actual meeting room revenue (avg)</span>
                      <span>{fmt(actualRev)}/m</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, color: "#E74C3C" }}>
                      <span style={{ fontWeight: 600 }}>Revenue gap (implied vs actual)</span>
                      <span style={{ fontWeight: 600 }}>{fmt(totalImplied - actualRev)}/m ({Math.round((1 - actualRev / totalImplied) * 100)}% leakage)</span>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        )}

        {/* ── ANCILLARY REVENUE ────────────────────────────────────── */}
        {tab === "ancillary" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Ancillary Revenue</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 14 }}>Non-office income: dedicated desks, hot desks, events, meeting rooms</div>
              {db.revenue.historicTotal && (() => {
                const ancillary = db.revenue.historicTotal.map((t, i) => ({
                  month: t.month,
                  amount: t.amount - (db.revenue.historicOffice[i]?.amount || 0),
                }));
                const latest = ancillary[ancillary.length - 1];
                const avg = Math.round(ancillary.reduce((s, d) => s + d.amount, 0) / ancillary.length);
                return (
                  <>
                    <BarChart data={ancillary} valueKey="amount" labelKey="month" height={160} formatVal={fmt} color="#8B5CF6" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 14 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#8B5CF6" }}>{fmt(latest.amount)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Latest (Mar 26)</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(avg)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Monthly Avg</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round((latest.amount / db.revenue.historicTotal[db.revenue.historicTotal.length - 1].amount) * 100)}%</div>
                        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>of Total Rev</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>DD & Hot Desks</div>
                {db.revenue.ddHotDesks && <BarChart data={db.revenue.ddHotDesks} valueKey="amount" labelKey="month" height={120} formatVal={fmt} color="#E8A317" />}
                {db.revenue.ddHotDesks && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: "center", color: "#E8A317" }}>{fmt(db.revenue.ddHotDesks[db.revenue.ddHotDesks.length - 1].amount)}/m</div>}
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Events & Filming</div>
                {db.revenue.events && <BarChart data={db.revenue.events} valueKey="amount" labelKey="month" height={120} formatVal={fmt} color="#E74C3C" />}
                {db.revenue.events && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, textAlign: "center", color: "#E74C3C" }}>{fmt(db.revenue.events[db.revenue.events.length - 1].amount)}/m</div>}
              </Card>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Day Passes — Monthly</div>
                {db.revenue.dayPasses && <BarChart data={db.revenue.dayPasses} valueKey="count" labelKey="month" height={120} formatVal={v => v} color="#9333EA" />}
                {db.revenue.dayPasses && (() => {
                  const total = db.revenue.dayPasses.reduce((s, d) => s + d.count, 0);
                  const avg = Math.round(total / db.revenue.dayPasses.length);
                  return <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Total: <strong>{total}</strong> · Avg: <strong>{avg}/m</strong> · Peak: <strong>{Math.max(...db.revenue.dayPasses.map(d => d.count))}</strong></div>;
                })()}
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Day Passes — Weekly (13w)</div>
                {db.revenue.dayPassesWeekly && <BarChart data={db.revenue.dayPassesWeekly} valueKey="count" labelKey="week" height={120} formatVal={v => v} color="#9333EA" />}
                {db.revenue.dayPassesWeekly && (() => {
                  const avg = Math.round(db.revenue.dayPassesWeekly.reduce((s, d) => s + d.count, 0) / db.revenue.dayPassesWeekly.length);
                  return <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 8, textAlign: "center" }}>Avg: <strong>{avg}/wk</strong> · At £30/pass ≈ <strong>{fmt(avg * 30 * 4.3)}/m</strong></div>;
                })()}
              </Card>
            </div>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Revenue Mix — Latest Month</div>
              {(() => {
                const items = [
                  { label: "Private Offices", amount: db.revenue.historicOffice[db.revenue.historicOffice.length - 1]?.amount || 0, color: "var(--accent)" },
                  { label: "DD & Hot Desks", amount: db.revenue.ddHotDesks?.[db.revenue.ddHotDesks.length - 1]?.amount || 0, color: "#E8A317" },
                  { label: "Meeting Rooms", amount: db.revenue.meetingRooms?.[db.revenue.meetingRooms.length - 1]?.amount || 0, color: "#3B82F6" },
                  { label: "Events & Other", amount: db.revenue.events?.[db.revenue.events.length - 1]?.amount || 0, color: "#E74C3C" },
                ];
                const total = items.reduce((s, i) => s + i.amount, 0);
                return items.map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12 }}>{item.label}</span>
                    <div style={{ width: 100 }}><MiniBar value={item.amount} max={items[0].amount} color={item.color} /></div>
                    <span style={{ fontSize: 12, fontWeight: 600, minWidth: 55, textAlign: "right" }}>{fmt(item.amount)}</span>
                    <span style={{ fontSize: 10, color: "var(--text-dim)", minWidth: 35, textAlign: "right" }}>{total > 0 ? Math.round((item.amount / total) * 100) : 0}%</span>
                  </div>
                ));
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "2px solid var(--border)", fontWeight: 700, fontSize: 13 }}>
                <span>Total Revenue</span>
                <span>{fmt(db.revenue.historicTotal?.[db.revenue.historicTotal.length - 1]?.amount)}</span>
              </div>
            </Card>
          </div>
        )}

        {/* ── USAGE / ENTRY-EXIT ─────────────────────────────────── */}
        {tab === "usage" && (
          <div>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Building Usage & Entry/Exit</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 16 }}>Check-in patterns and floor-level usage heatmap</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#9333EA22", border: "1px solid #9333EA44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#9333EA" }}>1,220</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Check-ins (30d)</div>
                </div>
                <div style={{ background: "#9333EA22", border: "1px solid #9333EA44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#9333EA" }}>41</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Avg daily</div>
                </div>
                <div style={{ background: "#9333EA22", border: "1px solid #9333EA44", borderRadius: 8, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#9333EA" }}>99.8%</div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Via Kiosk/App</div>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Peak Hours (check-ins by hour)</div>
              {(() => {
                const hourly = [
                  { hour: "5am", count: 19 }, { hour: "6am", count: 53 }, { hour: "7am", count: 163 },
                  { hour: "8am", count: 273 }, { hour: "9am", count: 179 }, { hour: "10am", count: 89 },
                  { hour: "11am", count: 85 }, { hour: "12pm", count: 102 }, { hour: "1pm", count: 54 },
                  { hour: "2pm", count: 48 }, { hour: "3pm", count: 29 }, { hour: "4pm", count: 33 },
                  { hour: "5pm", count: 29 }, { hour: "6pm", count: 26 }, { hour: "7pm", count: 17 },
                ];
                return <BarChart data={hourly} valueKey="count" labelKey="hour" height={130} formatVal={v => v + " check-ins"} color="#9333EA" />;
              })()}
            </Card>
            <Card style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Day Passes Sold — Monthly</div>
              {db.revenue.dayPasses && <BarChart data={db.revenue.dayPasses} valueKey="count" labelKey="month" height={140} formatVal={v => v + " passes"} color="#9333EA" />}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
                {db.revenue.dayPasses && (() => {
                  const total = db.revenue.dayPasses.reduce((s, d) => s + d.count, 0);
                  const avg = Math.round(total / db.revenue.dayPasses.length);
                  const peak = db.revenue.dayPasses.reduce((best, d) => d.count > best.count ? d : best);
                  return (<>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, color: "#9333EA" }}>{total}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Total (15m)</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{avg}/m</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Monthly avg</div></div>
                    <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700 }}>{peak.count}</div><div style={{ fontSize: 10, color: "var(--text-dim)" }}>Peak ({peak.month})</div></div>
                  </>);
                })()}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Floor & Office Usage Heatmap</div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>Requires floorpath / access control data</div>
              <div style={{ padding: "24px 16px", background: "var(--border)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Coming Soon</div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", maxWidth: 400, margin: "0 auto" }}>
                  Entry/exit heatmap by floor and office requires access control data from the building management system. This has been requested from Dan Cohen (Platform/Oneder) for next week.
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 12, padding: "8px 12px", background: "var(--bg-card)", borderRadius: 6, display: "inline-block" }}>
                  Planned: Hourly heatmap by floor · Peak usage by office · Weekday vs weekend patterns · Utilisation vs contracted desks
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── FORECAST ─────────────────────────────────────────── */}
        {tab === "forecast" && (
          <Forecast db={db} />
        )}

        {/* Floor Plan Modal */}
        {selectedFloor && <FloorPlanModal floor={selectedFloor} onClose={() => setSelectedFloor(null)} offices={db.offices} />}

        {/* Footer */}
        <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "var(--text-dim)" }}>
          <span>Persistent storage · Exportable to CSV</span>
          <button onClick={resetData} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, cursor: "pointer", background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border)" }}>Reset data</button>
        </div>
      </div>
    </div>
  );
}
