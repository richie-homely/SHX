// Shoreditch Exchange — Forecast Module v2 (14 Apr 2026)
// Per-room rates, scenario overlay, churn, capex, Excel export
import { useState, useMemo, useCallback } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = v => "£" + Math.round(v).toLocaleString();
const fmtK = v => "£" + Math.round(v / 1000) + "K";

const MODEL = {
  deskRevenue:[481481,485726,513757,523109,539942,558442,584067,601163,613775,635288,655648,664125],
  stepIncreases:[0,2089,4537,860,180,3667,5610,500,500,0,0,2186],
  renewalUplifts:[277,356,393,842,2478,459,2440,1971,1087,2539,335,665],
  newDeals:[0,1800,23100,7650,14175,14375,17575,14625,11025,18975,20025,5625],
  occupiedDesks:[1355,1355,1367,1384,1426,1460,1515,1563,1624,1711,1789,1789],
  interest:[0,3000,0,0,3000,0,0,3000,0,0,3000,0],
  opex:{
    agencyFees:[8730,8434,8434,34187,11779,24493,25200,30750,20515,18134,25816,27432],
    salariesCore:[14406,14568,14568,14568,14568,14568,15442,15442,15442,39499,39499,39499],
    salariesTrans:[0,0,12533,12533,12533,12533,12533,12533,12533,0,0,0],
    security:[11774,11774,11774,12363,12363,12363,12363,12363,12363,12363,12363,12363],
    internet:[3873,4000,5000,5000,5000,5000,5000,5000,5000,5000,5000,5000],
    compliance:[13036,12917,12917,12917,12917,12917,12917,12917,12917,12917,12917,12917],
    repairs:[12535,15283,15283,17063,17063,17063,20563,20563,20563,20563,20563,23563],
    cleaning:[28874,31851,31851,31851,31851,31851,31851,31851,31851,31851,31851,31851],
    recycling:[1262,1999,1999,1999,1999,1999,1999,1999,1999,1999,1999,1999],
    utilities:[19745,29457,29457,29457,29457,29457,29457,29457,29457,29457,29457,29457],
    fAndB:[14096,13711,13711,13711,13711,13711,13711,13711,13711,13711,13711,13711],
    admin:[8721,16971,16971,16971,16971,16971,16971,16971,16971,16971,16971,16971],
    marketing:[10763,12613,12613,12613,12613,12613,12613,12613,12613,12613,12613,12613],
  },
  rates:149500, serviceCharge:3970, groundRent:25833,
};

const SCENARIOS = {
  conservative:{
    meetings:[6283,7000,7350,7718,8103,9500,8000,8000,8103,8509,8934,7500],
    events:[3679,7500,7500,7500,7500,7500,7500,7500,7500,5000,5000,5000],
    sauna:[0,0,0,0,0,0,0,0,0,0,0,0], conc:[0,0,0,0,0,0,0,0,0,0,0,0],
  },
  base:{
    meetings:[6283,7000,7350,7718,8103,9500,8000,8000,12500,12500,12500,12500],
    events:[3679,7500,7500,7500,7500,7500,7500,7500,12500,12500,12500,12500],
    sauna:[0,0,0,0,0,0,0,0,0,0,10000,10000], conc:[0,0,0,0,0,0,0,0,0,0,10000,10000],
  },
  stretch:{
    meetings:[6283,7000,7350,8500,9000,10500,10000,10000,15000,15000,18000,18000],
    events:[3679,7500,7500,8000,8500,9000,10000,10000,15000,15000,18000,18000],
    sauna:[0,0,0,0,0,0,0,0,0,0,12000,12000], conc:[0,0,0,0,0,0,0,0,0,0,12000,12000],
  },
};

const SC = {
  conservative:{label:"Conservative",color:"#9CA3AF"},
  base:{label:"Base Case",color:"#1D9E75"},
  stretch:{label:"Stretch",color:"#3B82F6"},
};

// Default capex items
const DEFAULT_CAPEX = [
  {id:1, item:"01-122 split (53d → 6 units)", cost:35000, month:5, payback:4, status:"planned"},
  {id:2, item:"02-137 split (70d → 5 units)", cost:45000, month:6, payback:5, status:"planned"},
  {id:3, item:"Sauna fit-out (basement)", cost:25000, month:8, payback:12, status:"approved"},
  {id:4, item:"GF café concession fit-out", cost:15000, month:9, payback:6, status:"approved"},
  {id:5, item:"Phone booths (5x)", cost:12500, month:4, payback:0, status:"complete"},
];

function calcForecast(scenario, regearPct, newDealRate) {
  const S = SCENARIOS[scenario];
  const rateAdj = newDealRate / 450;
  const regearAdj = regearPct / 10;
  return MONTHS.map((m, i) => {
    const base = MODEL.deskRevenue[0];
    const cumS = MODEL.stepIncreases.slice(0,i+1).reduce((a,b)=>a+b,0);
    const cumR = MODEL.renewalUplifts.slice(0,i+1).reduce((a,b)=>a+b,0) * regearAdj;
    const cumN = MODEL.newDeals.slice(0,i+1).reduce((a,b)=>a+b,0) * rateAdj;
    const desk = base + cumS + cumR + cumN;
    const total = desk + S.meetings[i] + S.events[i] + S.sauna[i] + S.conc[i] + MODEL.interest[i];
    const opx = Object.values(MODEL.opex).reduce((s, arr) => s + arr[i], 0);
    const prop = MODEL.rates + MODEL.serviceCharge + MODEL.groundRent;
    return { month:m, desk:Math.round(desk), total:Math.round(total), opex:Math.round(opx), prop, noi:Math.round(total-opx-prop),
      meetings:S.meetings[i], events:S.events[i], sauna:S.sauna[i], conc:S.conc[i], interest:MODEL.interest[i],
      occ:MODEL.occupiedDesks[i], occPct:Math.round(MODEL.occupiedDesks[i]/1789*100),
      rate:Math.round(desk/MODEL.occupiedDesks[i]) };
  });
}

function csvDownload(rows, headers, filename) {
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => {
    const v = r[h]; return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
  }).join(","))].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Forecast({ db }) {
  const [subTab, setSubTab] = useState("overview");
  const [scenario, setScenario] = useState("base");
  const [regearPct, setRegearPct] = useState(10);
  const [newDealRate, setNewDealRate] = useState(450);
  const [showOpex, setShowOpex] = useState(false);
  const [rateOverrides, setRateOverrides] = useState({});
  const [churnRate, setChurnRate] = useState(3);
  const [capex, setCapex] = useState(DEFAULT_CAPEX);

  const offices = useMemo(() => db.offices.filter(o => o.status === "occupied" && o.mrr > 0).map(o => ({
    ...o, proposedRate: rateOverrides[o.id] ?? (o.deskRate < 400 ? Math.min(o.deskRate * 1.1, 450) : o.deskRate),
  })).sort((a,b) => a.deskRate - b.deskRate), [db.offices, rateOverrides]);

  const currentMRR = offices.reduce((s,o) => s + o.mrr, 0);
  const proposedMRR = offices.reduce((s,o) => s + o.proposedRate * o.desks, 0);
  const mrrUplift = proposedMRR - currentMRR;
  const occupiedDesks = offices.reduce((s,o) => s + o.desks, 0);

  // All 3 scenarios for overlay
  const allForecasts = useMemo(() => ({
    conservative: calcForecast("conservative", regearPct, newDealRate),
    base: calcForecast("base", regearPct, newDealRate),
    stretch: calcForecast("stretch", regearPct, newDealRate),
  }), [regearPct, newDealRate]);

  const forecast = allForecasts[scenario];
  const annualRev = forecast.reduce((s,f) => s + f.total, 0);
  const annualNOI = forecast.reduce((s,f) => s + f.noi, 0);
  const decRev = forecast[11].total;

  // Churn model
  const churnImpact = useMemo(() => {
    const monthlyChurn = churnRate / 100;
    let running = currentMRR;
    return MONTHS.map((m,i) => {
      const lost = Math.round(running * monthlyChurn);
      running = running - lost;
      return { month: m, lost, remaining: running, cumLost: currentMRR - running };
    });
  }, [churnRate, currentMRR]);

  const setRate = useCallback((id, val) => {
    setRateOverrides(prev => ({ ...prev, [id]: Number(val) }));
  }, []);

  const resetRates = useCallback(() => setRateOverrides({}), []);

  const exportForecast = useCallback(() => {
    const rows = forecast.map((f,i) => ({
      Month: f.month + " 26", "Desk Revenue": f.desk, "Meeting Rooms": f.meetings,
      Events: f.events, Sauna: f.sauna, Concessions: f.conc, Interest: f.interest,
      "Total Revenue": f.total, "Total Opex": f.opex, "Property Costs": f.prop,
      NOI: f.noi, "Occupancy %": f.occPct, "Desk Rate": f.rate,
    }));
    csvDownload(rows, Object.keys(rows[0]), `SX_Forecast_${scenario}_${new Date().toISOString().slice(0,10)}.csv`);
  }, [forecast, scenario]);

  const exportRoomRates = useCallback(() => {
    const rows = offices.map(o => ({
      Office: o.id, Floor: o.floor, Tenant: o.tenant, Desks: o.desks,
      "Current Rate": o.deskRate, "Current MRR": o.mrr,
      "Proposed Rate": o.proposedRate, "Proposed MRR": o.proposedRate * o.desks,
      "Uplift": o.proposedRate * o.desks - o.mrr,
      "Contract End": o.contractEnd || "",
    }));
    csvDownload(rows, Object.keys(rows[0]), `SX_Room_Rates_${new Date().toISOString().slice(0,10)}.csv`);
  }, [offices]);

  const Card = ({children, style}) => <div style={{background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:8,padding:20,...style}}>{children}</div>;

  const subTabs = [
    {id:"overview",label:"P&L Forecast"},
    {id:"rooms",label:"Room Rates"},
    {id:"scenarios",label:"Scenario Overlay"},
    {id:"churn",label:"Churn Model"},
    {id:"capex",label:"Capex Plan"},
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Sub-navigation */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--border)",marginBottom:4}}>
        {subTabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            padding:"8px 16px",fontSize:11,fontWeight:subTab===t.id?600:400,cursor:"pointer",
            color:subTab===t.id?"var(--accent)":"var(--text-dim)",background:"none",border:"none",
            borderBottom:subTab===t.id?"2px solid var(--accent)":"2px solid transparent",
          }}>{t.label}</button>
        ))}
        <div style={{flex:1}}/>
        <button onClick={exportForecast} style={{fontSize:10,padding:"4px 12px",borderRadius:4,cursor:"pointer",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600,alignSelf:"center",marginRight:4}}>Export CSV</button>
      </div>

      {/* ═══ P&L FORECAST ═══ */}
      {subTab === "overview" && <>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:600}}>2026 Revenue Forecast</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginTop:2}}>Yonobi SX Model · {SC[scenario].label}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              {Object.entries(SC).map(([k,c]) => (
                <button key={k} onClick={() => setScenario(k)} style={{
                  padding:"6px 14px",fontSize:11,fontWeight:scenario===k?700:400,borderRadius:5,cursor:"pointer",
                  background:scenario===k?c.color:"transparent",color:scenario===k?"#fff":"var(--text-dim)",
                  border:`1px solid ${scenario===k?c.color:"var(--border)"}`,
                }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:16,padding:14,background:"var(--bg)",borderRadius:6}}>
            <div>
              <div style={{fontSize:10,color:"var(--text-dim)",textTransform:"uppercase",marginBottom:4}}>New deal desk rate</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="range" min={350} max={550} step={25} value={newDealRate} onChange={e=>setNewDealRate(Number(e.target.value))} style={{flex:1,accentColor:SC[scenario].color}}/>
                <span style={{fontSize:14,fontWeight:700,minWidth:50}}>{fmt(newDealRate)}</span>
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:"var(--text-dim)",textTransform:"uppercase",marginBottom:4}}>Re-gear uplift</div>
              <div style={{display:"flex",gap:6}}>
                {[7,10,20,30].map(p => (
                  <button key={p} onClick={() => setRegearPct(p)} style={{
                    padding:"5px 12px",fontSize:11,fontWeight:regearPct===p?700:400,borderRadius:4,cursor:"pointer",
                    background:regearPct===p?SC[scenario].color:"transparent",color:regearPct===p?"#fff":"var(--text-dim)",
                    border:`1px solid ${regearPct===p?SC[scenario].color:"var(--border)"}`,
                  }}>{p}%</button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
          {[
            {l:"Dec Rev",v:fmtK(decRev),c:SC[scenario].color},
            {l:"Annual Rev",v:fmtK(annualRev),c:"var(--text)"},
            {l:"Annual NOI",v:fmtK(annualNOI),c:"var(--accent)"},
            {l:"NOI Margin",v:Math.round(annualNOI/annualRev*100)+"%",c:annualNOI/annualRev>.35?"var(--accent)":"#E8A317"},
            {l:"Yonobi Fee",v:fmtK(Math.round(annualNOI*.075)),c:"var(--text-dim)"},
            {l:"Landlord Net",v:fmtK(Math.round(annualNOI*.925)),c:"var(--accent)"},
          ].map((k,i) => (
            <Card key={i} style={{padding:12,textAlign:"center"}}>
              <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>{k.l}</div>
              <div style={{fontSize:18,fontWeight:700,color:k.c,marginTop:4}}>{k.v}</div>
            </Card>
          ))}
        </div>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:600}}>Monthly Revenue</div>
            <button onClick={() => setShowOpex(!showOpex)} style={{fontSize:10,padding:"4px 10px",borderRadius:4,cursor:"pointer",background:showOpex?SC[scenario].color:"transparent",color:showOpex?"#fff":"var(--text-dim)",border:`1px solid ${showOpex?SC[scenario].color:"var(--border)"}`}}>{showOpex?"Hide Opex":"Show Opex & NOI"}</button>
          </div>
          <div style={{display:"flex",gap:3,alignItems:"flex-end",height:180}}>
            {forecast.map((f,i) => {
              const maxR = Math.max(...forecast.map(x=>x.total))*1.08;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{fontSize:8,fontWeight:600,color:"var(--text-dim)",marginBottom:2}}>{fmtK(f.total)}</div>
                  <div style={{width:"100%",height:Math.max(2,(f.total/maxR)*180),borderRadius:"3px 3px 0 0",background:i<3?"#F87171":SC[scenario].color,opacity:i<3?.7:1}}/>
                  <div style={{fontSize:9,color:"var(--text-dim)",marginTop:4}}>{f.month}</div>
                </div>
              );
            })}
          </div>
          <div style={{overflowX:"auto",marginTop:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
              <thead><tr style={{borderBottom:"2px solid var(--border)"}}>
                <th style={{textAlign:"left",padding:"5px 4px",color:"var(--text-dim)"}}></th>
                {MONTHS.map(m=><th key={m} style={{textAlign:"right",padding:"5px 3px",color:"var(--text-dim)",fontWeight:600}}>{m}</th>)}
                <th style={{textAlign:"right",padding:"5px 4px",fontWeight:700,color:"var(--text-dim)"}}>Total</th>
              </tr></thead>
              <tbody>
                {[{l:"Desk Revenue",k:"desk"},{l:"Meetings",k:"meetings"},{l:"Events",k:"events"},{l:"Sauna",k:"sauna"},{l:"Concessions",k:"conc"},{l:"Interest",k:"interest"},
                  {l:"Total Revenue",k:"total",bold:true,color:SC[scenario].color}
                ].map(row=>(
                  <tr key={row.k} style={{borderBottom:row.bold?"2px solid var(--border)":"1px solid var(--border)"}}>
                    <td style={{padding:"3px 4px",fontWeight:row.bold?700:400,color:row.color||"var(--text)",whiteSpace:"nowrap"}}>{row.l}</td>
                    {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"3px 3px",fontWeight:row.bold?700:400,color:f[row.k]===0?"var(--border)":(row.color||"var(--text)")}}>{f[row.k]===0?"—":fmtK(f[row.k])}</td>)}
                    <td style={{textAlign:"right",padding:"3px 4px",fontWeight:700,color:row.color||"var(--text)"}}>{fmtK(forecast.reduce((s,f)=>s+f[row.k],0))}</td>
                  </tr>
                ))}
                <tr style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"3px 4px",color:"var(--text-dim)"}}>Occupancy</td>
                  {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"3px 3px",color:f.occPct>=95?"var(--accent)":f.occPct>=85?"var(--text)":"#E8A317"}}>{f.occPct}%</td>)}
                  <td/>
                </tr>
                <tr style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"3px 4px",color:"var(--text-dim)"}}>Desk Rate</td>
                  {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"3px 3px",color:f.rate>=425?"var(--accent)":f.rate>=400?"var(--text)":"#E8A317"}}>{fmt(f.rate)}</td>)}
                  <td/>
                </tr>
                {showOpex && <>
                  <tr><td colSpan={14} style={{padding:"8px 4px 2px",fontWeight:600,color:"var(--text-dim)"}}>Operating Expenses</td></tr>
                  <tr style={{borderBottom:"2px solid var(--border)"}}>
                    <td style={{padding:"3px 4px",fontWeight:700}}>Total Opex</td>
                    {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"3px 3px",fontWeight:600,color:"#E74C3C"}}>{fmtK(f.opex)}</td>)}
                    <td style={{textAlign:"right",padding:"3px 4px",fontWeight:700,color:"#E74C3C"}}>{fmtK(forecast.reduce((s,f)=>s+f.opex,0))}</td>
                  </tr>
                  <tr style={{borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"3px 4px"}}>Property Costs</td>
                    {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"3px 3px",color:"var(--text-dim)"}}>{fmtK(f.prop)}</td>)}
                    <td style={{textAlign:"right",padding:"3px 4px",fontWeight:600}}>{fmtK(forecast.reduce((s,f)=>s+f.prop,0))}</td>
                  </tr>
                  <tr style={{background:"var(--bg)"}}>
                    <td style={{padding:"6px 4px",fontWeight:700,color:"var(--accent)"}}>NOI</td>
                    {forecast.map((f,i)=><td key={i} style={{textAlign:"right",padding:"6px 3px",fontWeight:700,color:f.noi>0?"var(--accent)":"#E74C3C"}}>{fmtK(f.noi)}</td>)}
                    <td style={{textAlign:"right",padding:"6px 4px",fontWeight:700,color:"var(--accent)"}}>{fmtK(annualNOI)}</td>
                  </tr>
                </>}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Revenue Bridge */}
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Revenue Bridge: {fmtK(currentMRR)} → {fmtK(decRev)}</div>
          {[
            {l:"Current MRR",v:currentMRR,c:"var(--text-dim)",base:true},
            {l:"Step increases",v:MODEL.stepIncreases.reduce((a,b)=>a+b,0),c:"#8B5CF6"},
            {l:`Re-gears (${regearPct}%)`,v:Math.round(MODEL.renewalUplifts.reduce((a,b)=>a+b,0)*(regearPct/10)),c:"#3B82F6"},
            {l:`New deals (${fmt(newDealRate)}/d)`,v:Math.round(MODEL.newDeals.reduce((a,b)=>a+b,0)*(newDealRate/450)),c:"var(--accent)"},
            {l:"Ancillary",v:forecast[11].meetings+forecast[11].events,c:"#E8A317"},
            {l:"Sauna + café",v:forecast[11].sauna+forecast[11].conc,c:"#EC4899"},
          ].reduce((a,item)=>{const p=a.length?a[a.length-1].cum:0;a.push({...item,cum:item.base?item.v:p+item.v});return a;},[]).map((r,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"180px 1fr 70px",gap:8,alignItems:"center",padding:"4px 0",borderBottom:"1px solid var(--border)"}}>
              <span style={{fontSize:11}}>{r.l}</span>
              <div style={{height:14,background:"var(--bg)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(r.cum/(decRev*1.05))*100}%`,background:r.c,borderRadius:3,transition:"width 0.4s"}}/>
              </div>
              <span style={{fontSize:11,fontWeight:600,textAlign:"right",color:r.c}}>{r.base?fmtK(r.v):"+"+fmtK(r.v)}</span>
            </div>
          ))}
        </Card>
      </>}

      {/* ═══ ROOM RATES ═══ */}
      {subTab === "rooms" && <>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div>
              <div style={{fontSize:15,fontWeight:600}}>Per-Room Desk Rate Editor</div>
              <div style={{fontSize:11,color:"var(--text-dim)",marginTop:2}}>Edit proposed rates to model re-gear impact · Sorted lowest rate first</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={resetRates} style={{fontSize:10,padding:"4px 10px",borderRadius:4,cursor:"pointer",background:"transparent",color:"var(--text-dim)",border:"1px solid var(--border)"}}>Reset All</button>
              <button onClick={exportRoomRates} style={{fontSize:10,padding:"4px 10px",borderRadius:4,cursor:"pointer",background:"var(--accent)",color:"#fff",border:"none",fontWeight:600}}>Export CSV</button>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            <div style={{background:"var(--bg)",borderRadius:6,padding:12,textAlign:"center"}}>
              <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>Current MRR</div>
              <div style={{fontSize:20,fontWeight:700,marginTop:4}}>{fmtK(currentMRR)}</div>
            </div>
            <div style={{background:"var(--bg)",borderRadius:6,padding:12,textAlign:"center"}}>
              <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>Proposed MRR</div>
              <div style={{fontSize:20,fontWeight:700,color:"var(--accent)",marginTop:4}}>{fmtK(proposedMRR)}</div>
            </div>
            <div style={{background:"var(--bg)",borderRadius:6,padding:12,textAlign:"center"}}>
              <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>Monthly Uplift</div>
              <div style={{fontSize:20,fontWeight:700,color:mrrUplift>0?"var(--accent)":"#E74C3C",marginTop:4}}>{mrrUplift>0?"+":""}{fmtK(mrrUplift)}</div>
            </div>
          </div>

          <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
              <thead style={{position:"sticky",top:0,background:"var(--bg-card)",zIndex:1}}>
                <tr style={{borderBottom:"2px solid var(--border)"}}>
                  {["Office","Floor","Tenant","Desks","Current","Rate/d","Proposed","New MRR","Uplift","Expiry"].map(h=>
                    <th key={h} style={{textAlign:h==="Tenant"?"left":"right",padding:"6px 4px",color:"var(--text-dim)",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {offices.map(o => {
                  const newMrr = o.proposedRate * o.desks;
                  const uplift = newMrr - o.mrr;
                  const isLow = o.deskRate < 350;
                  return (
                    <tr key={o.id} style={{borderBottom:"1px solid var(--border)",background:isLow?"#E74C3C08":"transparent"}}>
                      <td style={{padding:"4px",fontWeight:500}}>{o.id}</td>
                      <td style={{padding:"4px",textAlign:"right",color:"var(--text-dim)"}}>{o.floor}</td>
                      <td style={{padding:"4px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.tenant}</td>
                      <td style={{padding:"4px",textAlign:"right"}}>{o.desks}</td>
                      <td style={{padding:"4px",textAlign:"right"}}>{fmt(o.mrr)}</td>
                      <td style={{padding:"4px",textAlign:"right",color:o.deskRate<400?"#E74C3C":o.deskRate>=450?"var(--accent)":"var(--text)",fontWeight:600}}>{fmt(o.deskRate)}</td>
                      <td style={{padding:"2px 4px",textAlign:"right"}}>
                        <input type="number" value={o.proposedRate} onChange={e=>setRate(o.id,e.target.value)} step={25}
                          style={{width:60,padding:"3px 4px",borderRadius:3,border:"1px solid var(--border)",background:"var(--bg)",color:"var(--text)",fontSize:10,textAlign:"right"}}/>
                      </td>
                      <td style={{padding:"4px",textAlign:"right",fontWeight:600}}>{fmt(newMrr)}</td>
                      <td style={{padding:"4px",textAlign:"right",fontWeight:600,color:uplift>0?"var(--accent)":uplift<0?"#E74C3C":"var(--text-dim)"}}>{uplift>0?"+":""}{fmt(uplift)}</td>
                      <td style={{padding:"4px",textAlign:"right",fontSize:9,color:"var(--text-dim)"}}>{o.contractEnd?o.contractEnd.slice(0,7):""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </>}

      {/* ═══ SCENARIO OVERLAY ═══ */}
      {subTab === "scenarios" && <>
        <Card>
          <div style={{fontSize:15,fontWeight:600,marginBottom:12}}>Scenario Comparison — 2026 Monthly Revenue</div>
          <div style={{position:"relative",height:250}}>
            <svg viewBox="0 0 700 250" style={{width:"100%",height:250}}>
              {/* Grid lines */}
              {[500000,600000,700000,800000].map(v => {
                const y = 240 - ((v-450000)/(850000-450000))*230;
                return <g key={v}><line x1={40} y1={y} x2={680} y2={y} stroke="var(--border)" strokeWidth="0.5"/>
                  <text x={38} y={y+3} textAnchor="end" fontSize="9" fill="var(--text-dim)">{fmtK(v)}</text></g>;
              })}
              {/* Lines for each scenario */}
              {Object.entries(allForecasts).map(([key, data]) => {
                const pts = data.map((f,i) => ({
                  x: 55 + (i / 11) * 620,
                  y: 240 - ((f.total - 450000) / (850000 - 450000)) * 230,
                }));
                const d = pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ");
                return <g key={key}>
                  <path d={d} fill="none" stroke={SC[key].color} strokeWidth={key===scenario?3:1.5} strokeDasharray={key===scenario?"":"6,4"} opacity={key===scenario?1:0.5}/>
                  {key===scenario && pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={SC[key].color}/>)}
                  <text x={pts[11].x+8} y={pts[11].y+4} fontSize="9" fontWeight="600" fill={SC[key].color}>{fmtK(data[11].total)}</text>
                </g>;
              })}
              {/* X axis labels */}
              {MONTHS.map((m,i) => <text key={m} x={55+(i/11)*620} y={250} textAnchor="middle" fontSize="9" fill="var(--text-dim)">{m}</text>)}
            </svg>
          </div>
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
            {Object.entries(SC).map(([k,c]) => (
              <span key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:c.color,cursor:"pointer",fontWeight:scenario===k?700:400}} onClick={()=>setScenario(k)}>
                <span style={{width:12,height:3,borderRadius:1,background:c.color,opacity:scenario===k?1:0.5}}/>{c.label}: {fmtK(allForecasts[k][11].total)}
              </span>
            ))}
          </div>
        </Card>

        {/* Annual comparison table */}
        <Card>
          <div style={{fontSize:13,fontWeight:600,marginBottom:10}}>Annual Performance by Scenario</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr repeat(3,120px)",gap:4,fontSize:11}}>
            {["","Conservative","Base Case","Stretch"].map((h,i)=><div key={i} style={{fontWeight:600,color:i===0?"":"var(--text-dim)",textAlign:i===0?"left":"right",padding:"6px 4px",borderBottom:"2px solid var(--border)"}}>{h}</div>)}
            {[
              {l:"Annual Revenue", k:s=>allForecasts[s].reduce((a,f)=>a+f.total,0)},
              {l:"Annual NOI", k:s=>allForecasts[s].reduce((a,f)=>a+f.noi,0)},
              {l:"NOI Margin", k:s=>Math.round(allForecasts[s].reduce((a,f)=>a+f.noi,0)/allForecasts[s].reduce((a,f)=>a+f.total,0)*100)+"%"},
              {l:"Dec Revenue", k:s=>allForecasts[s][11].total},
              {l:"Dec Desk Rate", k:s=>"£"+allForecasts[s][11].rate},
              {l:"Yonobi Fee (7.5%)", k:s=>Math.round(allForecasts[s].reduce((a,f)=>a+f.noi,0)*0.075)},
              {l:"Landlord Net", k:s=>Math.round(allForecasts[s].reduce((a,f)=>a+f.noi,0)*0.925)},
            ].map(row => [
              <div key={row.l} style={{padding:"4px",borderBottom:"1px solid var(--border)"}}>{row.l}</div>,
              ...["conservative","base","stretch"].map(s => {
                const v = row.k(s);
                return <div key={s} style={{textAlign:"right",padding:"4px",borderBottom:"1px solid var(--border)",fontWeight:600,color:SC[s].color}}>{typeof v==="number"?fmtK(v):v}</div>;
              }),
            ]).flat()}
          </div>
        </Card>
      </>}

      {/* ═══ CHURN MODEL ═══ */}
      {subTab === "churn" && <>
        <Card>
          <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Churn Risk Model</div>
          <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:16}}>Monthly churn rate applied to current MRR base. Arada target: &lt;3-5% annual churn.</div>

          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:14,background:"var(--bg)",borderRadius:6}}>
            <div style={{fontSize:10,color:"var(--text-dim)",textTransform:"uppercase"}}>Monthly churn rate</div>
            {[1,2,3,5,7].map(p => (
              <button key={p} onClick={() => setChurnRate(p)} style={{
                padding:"5px 12px",fontSize:11,fontWeight:churnRate===p?700:400,borderRadius:4,cursor:"pointer",
                background:churnRate===p?"#E74C3C":"transparent",color:churnRate===p?"#fff":"var(--text-dim)",
                border:`1px solid ${churnRate===p?"#E74C3C":"var(--border)"}`,
              }}>{p}%</button>
            ))}
            <span style={{fontSize:11,color:"var(--text-dim)"}}>= {churnRate*12}% annual</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            {[
              {l:"Starting MRR",v:fmtK(currentMRR),c:"var(--text)"},
              {l:"Annual Churn Loss",v:"-"+fmtK(churnImpact[11].cumLost),c:"#E74C3C"},
              {l:"Remaining MRR",v:fmtK(churnImpact[11].remaining),c:churnImpact[11].remaining/currentMRR>.85?"var(--accent)":"#E74C3C"},
              {l:"Retention Rate",v:Math.round(churnImpact[11].remaining/currentMRR*100)+"%",c:churnImpact[11].remaining/currentMRR>.85?"var(--accent)":"#E8A317"},
            ].map((k,i)=>(
              <div key={i} style={{background:"var(--bg)",borderRadius:6,padding:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:700,color:k.c,marginTop:4}}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:3,alignItems:"flex-end",height:140}}>
            {churnImpact.map((c,i) => {
              const pct = c.remaining / currentMRR;
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{fontSize:8,fontWeight:600,color:"var(--text-dim)",marginBottom:2}}>{fmtK(c.remaining)}</div>
                  <div style={{width:"100%",height:Math.max(2,pct*140),borderRadius:"3px 3px 0 0",background:pct>.9?"var(--accent)":pct>.8?"#E8A317":"#E74C3C"}}/>
                  <div style={{fontSize:9,color:"var(--text-dim)",marginTop:4}}>{c.month}</div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:10,color:"var(--text-dim)",marginTop:12,padding:10,background:"var(--bg)",borderRadius:6}}>
            At {churnRate}% monthly churn, you need <strong>{fmtK(churnImpact[11].cumLost)}</strong> in new deals annually just to stand still. The forecast model assumes new deal absorption covers this — but tracking actual churn vs forecast is critical for early warning.
          </div>
        </Card>
      </>}

      {/* ═══ CAPEX PLAN ═══ */}
      {subTab === "capex" && <>
        <Card>
          <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Capex Plan — 2026</div>
          <div style={{fontSize:11,color:"var(--text-dim)",marginBottom:16}}>Planned capital expenditure with payback periods</div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
            {[
              {l:"Total Capex",v:fmtK(capex.reduce((s,c)=>s+c.cost,0)),c:"var(--text)"},
              {l:"Approved",v:fmtK(capex.filter(c=>c.status==="approved"||c.status==="complete").reduce((s,c)=>s+c.cost,0)),c:"var(--accent)"},
              {l:"Planned (pending)",v:fmtK(capex.filter(c=>c.status==="planned").reduce((s,c)=>s+c.cost,0)),c:"#E8A317"},
            ].map((k,i)=>(
              <div key={i} style={{background:"var(--bg)",borderRadius:6,padding:12,textAlign:"center"}}>
                <div style={{fontSize:9,color:"var(--text-dim)",textTransform:"uppercase"}}>{k.l}</div>
                <div style={{fontSize:20,fontWeight:700,color:k.c,marginTop:4}}>{k.v}</div>
              </div>
            ))}
          </div>

          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead>
              <tr style={{borderBottom:"2px solid var(--border)"}}>
                {["Item","Cost","Target Month","Payback (mo)","Status"].map(h=>
                  <th key={h} style={{textAlign:h==="Item"?"left":"right",padding:"6px 4px",color:"var(--text-dim)",fontWeight:600}}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {capex.map(c => (
                <tr key={c.id} style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"6px 4px"}}>{c.item}</td>
                  <td style={{padding:"6px 4px",textAlign:"right",fontWeight:600}}>{fmt(c.cost)}</td>
                  <td style={{padding:"6px 4px",textAlign:"right"}}>{MONTHS[c.month-1]} 26</td>
                  <td style={{padding:"6px 4px",textAlign:"right"}}>{c.payback > 0 ? c.payback + " months" : "N/A"}</td>
                  <td style={{padding:"6px 4px",textAlign:"right"}}>
                    <span style={{fontSize:9,padding:"2px 8px",borderRadius:3,fontWeight:600,
                      background:c.status==="complete"?"#1D9E7522":c.status==="approved"?"#3B82F622":"#E8A31722",
                      color:c.status==="complete"?"#1D9E75":c.status==="approved"?"#3B82F6":"#E8A317",
                    }}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Timeline */}
          <div style={{marginTop:20}}>
            <div style={{fontSize:11,fontWeight:600,marginBottom:8}}>Capex Timeline</div>
            <div style={{display:"flex",gap:1,height:40}}>
              {MONTHS.map((m,i) => {
                const items = capex.filter(c => c.month === i+1);
                return (
                  <div key={m} style={{flex:1,background:items.length?"var(--accent)11":"var(--bg)",borderRadius:3,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",border:items.length?"1px solid var(--accent)33":"1px solid var(--border)"}}>
                    <div style={{fontSize:7,color:"var(--text-dim)"}}>{m}</div>
                    {items.map(it => <div key={it.id} style={{fontSize:7,fontWeight:600,color:"var(--accent)"}}>{fmtK(it.cost)}</div>)}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </>}
    </div>
  );
}
