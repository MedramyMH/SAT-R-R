import React, { useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, BarChart3, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, Database, Download, FilePlus2, Filter, Gauge, History,
  LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings, ShieldCheck,
  Smartphone, Sun, Trash2, Users, Wrench, X
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from "recharts";
import { supabase, supabaseConfigured, supabaseConfigStatus } from "./supabase";

const STATIONS = [
  {id:"ST1",name:"Loading"},{id:"ST2",name:"Taping"},
  {id:"ST3A",name:"Clip Assembly · Clip Head"},{id:"ST3B",name:"Clip Feeding · Asyril / Rails"},
  {id:"ST4",name:"Unloading"}
];
const CATEGORIES = ["Process","Mechanical","Electrical","Software","Quality","Material","Adjustment","Safety","Other"];
const blank = () => ({project:"",customer:"",machine:"SMC3",harness:"",sat_type:"SAT",sat_version:"1.0",
  engineer:"",target:35,planned_minutes:60,required_rate:"",min_availability:"",min_quality:"",
  good:0,failed:0,notes:"",status:"draft",started_at:null,ended_at:null,events:[],actions:[]});
const duration = (a,b) => Math.max(0,(new Date(b||Date.now())-new Date(a||Date.now()))/1000);
const fmt = sec => { sec=Math.floor(sec||0); return `${String(Math.floor(sec/3600)).padStart(2,"0")}:${String(Math.floor(sec%3600/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`; };
const pct = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
const local = v => v ? new Date(v).toLocaleString() : "—";
const uid = () => crypto.randomUUID();
function calculate(s) {
  const end=s.ended_at || new Date().toISOString();
  const elapsed=s.started_at ? duration(s.started_at,end) : 0;
  const stops=(s.events||[]).filter(e=>e.affects_machine!==false);
  const intervals=stops.map(e=>[new Date(e.started_at).getTime(),new Date(e.ended_at||end).getTime()]).filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]);
  let downtime=0, lastStart=null,lastEnd=null;
  for(const [a,b] of intervals){ if(lastStart===null){lastStart=a;lastEnd=b;} else if(a<=lastEnd)lastEnd=Math.max(lastEnd,b); else {downtime+=lastEnd-lastStart;lastStart=a;lastEnd=b;} }
  if(lastStart!==null)downtime+=lastEnd-lastStart;
  const dt=downtime/1000, produced=Number(s.good||0)+Number(s.failed||0);
  const availability=elapsed>0?Math.max(0,(elapsed-dt)/elapsed*100):null;
  const quality=produced>0?Number(s.good||0)/produced*100:null;
  const rate=elapsed>0?Number(s.good||0)*3600/elapsed:null;
  const leoni=(s.events||[]).filter(e=>e.affects_machine!==false&&e.responsibility==="LEONI");
  const leoniMs=leoni.reduce((a,e)=>a+duration(e.started_at,e.ended_at||end)*1000,0);
  const adjusted=elapsed*1000>leoniMs?(elapsed*1000-downtime)/(elapsed*1000-leoniMs)*100:null;
  return {elapsed,dt,availability,quality,rate,produced,adjusted,operating:Math.max(0,elapsed-dt)};
}
function acceptance(s,m) {
  const checks=[
    {name:"Accepted good quantity",actual:`${s.good} / ${s.target}`,pass:Number(s.good)>=Number(s.target)},
    {name:"Test duration",actual:`${fmt(m.elapsed)} / ${s.planned_minutes||"Not set"} min`,pass:Number(s.planned_minutes)>0?m.elapsed>=Number(s.planned_minutes)*60:null},
    {name:"Good output rate",actual:`${m.rate==null?"—":m.rate.toFixed(1)} / ${s.required_rate||"Not set"} parts/h`,pass:s.required_rate!==""&&m.rate!=null?m.rate>=Number(s.required_rate):null},
    {name:"Gross availability",actual:`${pct(m.availability)} / ${s.min_availability||"Not set"}%`,pass:s.min_availability!==""&&m.availability!=null?m.availability>=Number(s.min_availability):null},
    {name:"Good / total ratio",actual:`${pct(m.quality)} / ${s.min_quality||"Not set"}%`,pass:s.min_quality!==""&&m.quality!=null?m.quality>=Number(s.min_quality):null}
  ];
  const complete=checks.every(c=>c.pass!==null);
  return {checks,complete,pass:complete&&checks.every(c=>c.pass)};
}
function Auth({onLogin}) {
  const [mode,setMode]=useState("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[busy,setBusy]=useState(false),[err,setErr]=useState("");
  async function submit(e){e.preventDefault();setBusy(true);setErr("");
    try {
      if(mode==="signup"){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});
        if(error)throw error;
        if(data.session) onLogin(data.session); else setErr("Account created. Check your email to confirm, then sign in.");
      } else {const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;onLogin(data.session);}
    } catch(e){setErr(e.message||"Authentication failed");} finally{setBusy(false);}
  }
  return <div className="auth-shell"><div className="auth-card"><div className="brand-mark">SAT<span>R&R</span></div><p className="eyebrow">ENGINEERING VALIDATION PLATFORM</p><h1>{mode==="signin"?"Welcome back":"Create engineer account"}</h1><p className="muted">Secure access to SAT execution and historical records.</p>
    <form onSubmit={submit}>{mode==="signup"&&<label>Full name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Engineer name"/></label>}
      <label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="engineer@company.com"/></label>
      <label>Password<input type="password" minLength="8" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
      {err&&<div className="alert">{err}</div>}<button className="btn primary wide" disabled={busy}>{busy?"Please wait…":mode==="signin"?"Sign in":"Create account"}</button></form>
    <button className="link-btn" onClick={()=>{setMode(mode==="signin"?"signup":"signin");setErr("");}}>{mode==="signin"?"New engineer? Create an account":"Already registered? Sign in"}</button>
  </div></div>;
}
function App(){
  const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[page,setPage]=useState("Dashboard"),[sat,setSat]=useState(blank()),[records,setRecords]=useState([]),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[dark,setDark]=useState(false),[query,setQuery]=useState(""),[filter,setFilter]=useState("All"),[mobileNav,setMobileNav]=useState(false),[message,setMessage]=useState(""),[eventDraft,setEventDraft]=useState(null),[editingId,setEditingId]=useState(null);
  useEffect(()=>{if(!supabaseConfigured){setLoading(false);return;}supabase.auth.getSession().then(({data})=>setSession(data.session));const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>subscription.unsubscribe();},[]);
  useEffect(()=>{if(session)loadData();else{setLoading(false);setProfile(null);}},[session]);
  async function loadData(){
    setLoading(true);
    const [p,r]=await Promise.all([
      supabase.from("profiles").select("*").eq("id",session.user.id).maybeSingle(),
      supabase.from("sat_runs").select("*,sat_downtime_events(*),sat_actions(*)").order("created_at",{ascending:false}).limit(300)
    ]);
    if(p.data)setProfile(p.data);
    if(r.error)setMessage("Could not load SAT records: "+r.error.message);
    else setRecords((r.data||[]).map(fromDb));
    setLoading(false);
  }
  function fromDb(r){return {...r,events:r.sat_downtime_events||[],actions:r.sat_actions||[]};}
  const metrics=useMemo(()=>calculate(sat),[sat]);
  const result=useMemo(()=>acceptance(sat,metrics),[sat,metrics]);
  const running=!!sat.started_at&&!sat.ended_at;
  const activeEvents=sat.events.filter(e=>!e.ended_at);
  const setField=(k,v)=>setSat(x=>({...x,[k]:v}));
  function newSat(){setSat(blank());setEditingId(null);setPage("New SAT");}
  async function saveSat(status=sat.status){
    if(!supabaseConfigured){setMessage("Supabase environment is not configured.");return;}
    if(!sat.project.trim()||!sat.machine.trim()){setMessage("Project and machine are required.");return;}
    setSaving(true);setMessage("");
    const payload={project:sat.project,customer:sat.customer,machine:sat.machine,harness:sat.harness,sat_type:sat.sat_type,sat_version:sat.sat_version,
      engineer:sat.engineer||profile?.full_name||session.user.email,target:Number(sat.target)||0,planned_minutes:Number(sat.planned_minutes)||null,
      required_rate:sat.required_rate===""?null:Number(sat.required_rate),min_availability:sat.min_availability===""?null:Number(sat.min_availability),
      min_quality:sat.min_quality===""?null:Number(sat.min_quality),good:Number(sat.good)||0,failed:Number(sat.failed)||0,notes:sat.notes,status,
      started_at:sat.started_at,ended_at:sat.ended_at};
    let id=editingId;
    try{
      if(id){const {error}=await supabase.from("sat_runs").update(payload).eq("id",id);if(error)throw error;}
      else {const {data,error}=await supabase.from("sat_runs").insert(payload).select("id").single();if(error)throw error;id=data.id;setEditingId(id);}
      {const {error:delErr}=await supabase.from("sat_downtime_events").delete().eq("sat_id",id);if(delErr)throw delErr;
        if(sat.events.length){const rows=sat.events.map(e=>({sat_id:id,station:e.station,category:e.category,reason:e.reason,responsibility:e.responsibility,
          affects_machine:e.affects_machine!==false,started_at:e.started_at,ended_at:e.ended_at,responsible:e.responsible||null,
          corrective_action:e.corrective_action||null,owner:e.owner||null,action_status:e.action_status||"Open"}));
          const {error}=await supabase.from("sat_downtime_events").insert(rows);if(error)throw error;}
      }
      {const {error:delErr}=await supabase.from("sat_actions").delete().eq("sat_id",id);if(delErr)throw delErr;
        if(sat.actions.length){const rows=sat.actions.map(a=>({sat_id:id,title:a.title,description:a.description||"",owner:a.owner||"",due_date:a.due_date||null,status:a.status||"Open",priority:a.priority||"Medium"}));
          const {error}=await supabase.from("sat_actions").insert(rows);if(error)throw error;}
      }
      setMessage("SAT saved securely to Supabase.");await loadData();
    }catch(e){setMessage("Save failed: "+e.message);}finally{setSaving(false);}
  }
  async function openRecord(r){setEditingId(r.id);setSat({...blank(),...r,events:r.events||[],actions:r.actions||[]});setPage("New SAT");}
  async function deleteRecord(id){if(!confirm("Permanently delete this SAT and its related events/actions?"))return;const {error}=await supabase.from("sat_runs").delete().eq("id",id);if(error)setMessage(error.message);else{setRecords(x=>x.filter(r=>r.id!==id));setMessage("SAT deleted.");}}
  function startRun(){if(!sat.project.trim()||!sat.machine.trim()){setMessage("Enter project and machine before starting.");return;}setField("started_at",new Date().toISOString());setField("status","in_progress");}
  function endRun(){const now=new Date().toISOString();setSat(x=>({...x,ended_at:now,status:"completed",events:x.events.map(e=>e.ended_at?e:{...e,ended_at:now})}));}
  function stationClick(id){const active=sat.events.find(e=>e.station===id&&!e.ended_at);if(active){setSat(x=>({...x,events:x.events.map(e=>e.id===active.id?{...e,ended_at:new Date().toISOString()}:e)}));return;}
    setEventDraft({id:uid(),station:id,category:"Process",reason:"",responsibility:"TBD",affects_machine:true,started_at:new Date().toISOString(),ended_at:null,responsible:"",corrective_action:"",owner:"",action_status:"Open"});
  }
  function saveEvent(e){e.preventDefault();const f=new FormData(e.target);const item={...eventDraft,category:f.get("category"),reason:f.get("reason").trim(),responsibility:f.get("responsibility"),affects_machine:f.get("affects_machine")==="on",responsible:f.get("responsible"),corrective_action:f.get("corrective_action"),owner:f.get("owner"),action_status:f.get("action_status")};
    if(!item.reason)return;setSat(x=>({...x,events:[...x.events,item]}));setEventDraft(null);}
  const filtered=records.filter(r=>(filter==="All"||r.status===filter)&&`${r.project} ${r.machine} ${r.customer} ${r.engineer}`.toLowerCase().includes(query.toLowerCase()));
  const allStats=useMemo(()=>records.reduce((a,r)=>{const m=calculate(r);a.count++;a.good+=Number(r.good||0);a.failed+=Number(r.failed||0);a.dt+=m.dt;a.pass+=acceptance(r,m).pass?1:0;return a;},{count:0,good:0,failed:0,dt:0,pass:0}),[records]);
  if(!supabaseConfigured)return <div className="auth-shell"><div className="auth-card"><div className="brand-mark">SAT<span>R&R</span></div><h1>Supabase configuration required</h1><p className="muted">The app did not receive a valid Supabase URL and publishable key. Configure the variables in the project root or hosting build settings, then restart/rebuild the app.</p><pre>{`VITE_SUPABASE_URL=${supabaseConfigStatus.hasUrl ? " detected" : " MISSING"}\nVITE_SUPABASE_PUBLISHABLE_KEY=${supabaseConfigStatus.hasPublishableKey ? " detected" : " MISSING"}\nURL format=${supabaseConfigStatus.urlLooksValid ? " valid" : " invalid (must start with https://)"}`}</pre><p className="muted">Local: put these variables in the .env file beside package.json and restart npm run dev. Netlify: add them in Site configuration → Environment variables, then trigger a new deploy.</p></div></div>;
  if(!session)return <Auth onLogin={setSession}/>;
  const nav=[["Dashboard",LayoutDashboard],["New SAT",FilePlus2],["Historical SATs",History],["Analysis",BarChart3],["Actions",Wrench]];
  const chartData=records.slice(0,12).reverse().map(r=>({name:(r.project||"SAT").slice(0,12),good:Number(r.good||0),failed:Number(r.failed||0)}));
  const downtimeByStation=STATIONS.map(st=>({name:st.id,minutes:records.flatMap(r=>r.events||[]).filter(e=>e.station===st.id).reduce((n,e)=>n+duration(e.started_at,e.ended_at)/60,0)}));
  return <div className={dark?"app dark":"app"}>
    <aside className={`sidebar ${mobileNav?"show":""}`}><div className="side-brand"><div className="brand-mark small">SAT<span>R&R</span></div><button className="icon-btn mobile-close" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="side-label">WORKSPACE</div>{nav.map(([n,I])=><button key={n} className={`nav-item ${page===n?"active":""}`} onClick={()=>{setPage(n);setMobileNav(false);}}><I size={18}/>{n}</button>)}
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar">{(profile?.full_name||session.user.email||"E")[0].toUpperCase()}</div><div><b>{profile?.full_name||"Engineer"}</b><small>{session.user.email}</small></div></div><button className="nav-item" onClick={()=>setDark(!dark)}>{dark?<Sun size={18}/>:<Moon size={18}/>}Appearance</button><button className="nav-item" onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Sign out</button></div>
    </aside><main className="main">
      <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div><p className="eyebrow">ENGINEERING / {page.toUpperCase()}</p><h2>{page}</h2></div><div className="top-actions"><span className="live-pill"><span/> Cloud connected</span><button className="btn primary" onClick={newSat}><Plus size={17}/> New SAT</button></div></header>
      {message&&<div className="toast" onClick={()=>setMessage("")}>{message}<X size={15}/></div>}
      {loading?<div className="loading">Loading secure SAT workspace…</div>:<>
      {page==="Dashboard"&&<><section className="welcome-row"><div><h1>Engineering overview</h1><p className="muted">Monitor machine acceptance tests and validation performance.</p></div><button className="btn secondary" onClick={()=>setPage("Historical SATs")}><History size={16}/> View history</button></section>
        <div className="metric-grid"><Metric icon={ClipboardCheck} label="Total SAT records" value={allStats.count} note={`${allStats.pass} passed configured criteria`}/><Metric icon={Gauge} label="Good production" value={allStats.good.toLocaleString()} note="Accepted harnesses across records"/><Metric icon={AlertTriangle} label="Rejected / rework" value={allStats.failed.toLocaleString()} note={`Quality ${pct(allStats.good+allStats.failed?allStats.good/(allStats.good+allStats.failed)*100:NaN)}`}/><Metric icon={Clock3} label="Recorded downtime" value={fmt(allStats.dt)} note="Unique downtime per SAT"/></div>
        <div className="content-grid"><div className="card"><div className="card-head"><div><h3>Recent SAT activity</h3><p>Latest machine validation records</p></div><button className="text-btn" onClick={()=>setPage("Historical SATs")}>View all <ChevronRight size={15}/></button></div><RecordTable rows={records.slice(0,6)} onOpen={openRecord} onDelete={deleteRecord}/></div><div className="card"><div className="card-head"><div><h3>Acceptance summary</h3><p>Against configured criteria</p></div></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={190}><PieChart><Pie data={[{name:"Passed",value:allStats.pass},{name:"Not passed / incomplete",value:Math.max(0,allStats.count-allStats.pass)}]} innerRadius={58} outerRadius={78} dataKey="value" paddingAngle={3}><Cell fill="#0f9f8f"/><Cell fill="#e7edf1"/></Pie><Tooltip/></PieChart></ResponsiveContainer><div className="donut-center"><b>{allStats.count?Math.round(allStats.pass/allStats.count*100):0}%</b><small>Pass rate</small></div></div><div className="legend-line"><span><i className="dot teal"/> Passed</span><b>{allStats.pass}</b></div><div className="legend-line"><span><i className="dot grey"/> Other / incomplete</span><b>{allStats.count-allStats.pass}</b></div></div></div>
        <div className="card"><div className="card-head"><div><h3>Production history</h3><p>Good and rejected quantity by SAT</p></div></div><div className="chart"><ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Legend/><Bar dataKey="good" name="Good" fill="#0f9f8f" radius={[5,5,0,0]}/><Bar dataKey="failed" name="Rejected" fill="#e59a45" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div>
      </>}
      {page==="New SAT"&&<><div className="editor-toolbar"><div><h1>{editingId?"Edit SAT record":"SAT execution workspace"}</h1><p className="muted">Complete the setup, run the test, record stops and validate the result.</p></div><div className="toolbar-buttons"><button className="btn secondary" onClick={()=>saveSat("draft")} disabled={saving}>Save draft</button><button className="btn primary" onClick={()=>saveSat(sat.status)} disabled={saving}>{saving?"Saving…":"Save to cloud"}</button></div></div>
        <div className="card section-card"><SectionTitle icon={ClipboardCheck} title="1. SAT identification" sub="Machine, project and test ownership"/><div className="form-grid">
          <Field label="Project / customer programme" value={sat.project} onChange={v=>setField("project",v)} required/><Field label="Customer" value={sat.customer} onChange={v=>setField("customer",v)}/><Field label="Machine / asset ID" value={sat.machine} onChange={v=>setField("machine",v)} required/><Field label="Harness / product type" value={sat.harness} onChange={v=>setField("harness",v)}/><Field label="SAT type" value={sat.sat_type} onChange={v=>setField("sat_type",v)} options={["SAT","Run@Rate","Re-SAT","Pre-SAT"]}/><Field label="SAT version" value={sat.sat_version} onChange={v=>setField("sat_version",v)}/><Field label="Engineer" value={sat.engineer||profile?.full_name||""} onChange={v=>setField("engineer",v)}/></div></div>
        <div className="card section-card"><SectionTitle icon={Settings} title="2. Acceptance criteria" sub="Enter agreed values from the customer / project specification"/><div className="form-grid"><Field label="Required GOOD quantity" type="number" value={sat.target} onChange={v=>setField("target",v)}/><Field label="Planned test duration (minutes)" type="number" value={sat.planned_minutes} onChange={v=>setField("planned_minutes",v)}/><Field label="Required good output (parts/hour)" type="number" value={sat.required_rate} onChange={v=>setField("required_rate",v)}/><Field label="Minimum gross availability (%)" type="number" value={sat.min_availability} onChange={v=>setField("min_availability",v)}/><Field label="Minimum quality (%)" type="number" value={sat.min_quality} onChange={v=>setField("min_quality",v)}/></div></div>
        <div className="card section-card"><div className="section-title"><SectionTitle icon={Activity} title="3. Live SAT execution" sub="Start the run, record production and track station downtime"/><div className="run-controls"><span className={`status ${running?"running":sat.ended_at?"done":"draft"}`}>{running?"RUNNING":sat.ended_at?"COMPLETED":"NOT STARTED"}</span>{!sat.started_at?<button className="btn primary" onClick={startRun}>▶ Start SAT</button>:running?<button className="btn danger" onClick={endRun}>■ End SAT</button>:<button className="btn secondary" onClick={()=>{setSat(x=>({...x,started_at:null,ended_at:null,status:"draft",events:[]}));}}>Reset run</button>}</div></div>
          <div className="live-stats"><Metric label="Elapsed time" value={fmt(metrics.elapsed)} icon={Clock3}/><Metric label="Good quantity" value={sat.good} icon={CheckCircle2}/><Metric label="Rejected" value={sat.failed} icon={AlertTriangle}/><Metric label="Availability" value={pct(metrics.availability)} icon={Gauge}/></div>
          <div className="counter-row"><Counter label="Accepted good harnesses" value={sat.good} onChange={v=>setField("good",Math.max(0,v))} disabled={!running}/><Counter label="Rejected / rework harnesses" value={sat.failed} onChange={v=>setField("failed",Math.max(0,v))} disabled={!running}/></div>
          <h4 className="subhead">Station downtime control</h4><p className="muted tiny">Tap a running station to open a downtime event. Tap a stopped station to resume it.</p><div className="station-grid">{STATIONS.map(st=>{const active=activeEvents.find(e=>e.station===st.id);const count=sat.events.filter(e=>e.station===st.id).length;return <button key={st.id} disabled={!running} className={`station-card ${active?"stopped":""}`} onClick={()=>stationClick(st.id)}><div className="station-top"><b>{st.id}</b><span className={`status ${active?"failed":"running"}`}>{active?"DOWN":"RUNNING"}</span></div><h3>{st.name}</h3><div className="station-bottom"><span>{count} events</span><b>{active?"Resume station":"Record stop"}</b></div></button>})}</div>
          {sat.events.length>0&&<div className="table-scroll"><table><thead><tr><th>Station</th><th>Reason</th><th>Responsibility</th><th>Start</th><th>End</th><th>Duration</th><th/></tr></thead><tbody>{sat.events.map(e=><tr key={e.id}><td>{e.station}</td><td>{e.reason}</td><td>{e.responsibility}</td><td>{local(e.started_at)}</td><td>{local(e.ended_at)}</td><td>{fmt(duration(e.started_at,e.ended_at))}</td><td><button className="icon-btn" onClick={()=>setSat(x=>({...x,events:x.events.filter(v=>v.id!==e.id)}))}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>}</div>
        <div className="card section-card"><SectionTitle icon={Wrench} title="4. Corrective actions & observations" sub="Record actions, owners and follow-up"/><ActionEditor actions={sat.actions} onChange={v=>setField("actions",v)}/><label className="field full-field">Engineering observations / SAT notes<textarea rows="4" value={sat.notes} onChange={e=>setField("notes",e.target.value)} placeholder="Document test conditions, anomalies, deviations and conclusions…"/></label></div>
        <div className="card section-card"><SectionTitle icon={ShieldCheck} title="5. Preliminary acceptance review" sub="Calculated from recorded values; final approval remains an engineering decision"/><Acceptance checks={result.checks} complete={result.complete} pass={result.pass}/><div className="footer-actions"><button className="btn secondary" onClick={()=>saveSat("draft")} disabled={saving}>Save draft</button><button className="btn primary" onClick={()=>saveSat(sat.ended_at?"completed":"in_progress")} disabled={saving}>{saving?"Saving…":"Save SAT record"}</button></div></div>
      </>}
      {page==="Historical SATs"&&<div className="card"><div className="card-head"><div><h3>Historical SAT register</h3><p>All SAT records available to your account / organization.</p></div><button className="btn primary" onClick={newSat}><Plus size={16}/> New SAT</button></div><div className="filters"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search project, machine, customer or engineer…"/></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option><option value="draft">draft</option><option value="in_progress">in_progress</option><option value="completed">completed</option></select></div><RecordTable rows={filtered} onOpen={openRecord} onDelete={deleteRecord}/></div>}
      {page==="Analysis"&&<><div className="welcome-row"><div><h1>SAT performance analysis</h1><p className="muted">Aggregated engineering indicators across saved SAT records.</p></div><button className="btn secondary" onClick={()=>exportCsv(records)}><Download size={16}/> Export CSV</button></div><div className="metric-grid"><Metric label="SATs completed" value={records.filter(r=>r.status==="completed").length} icon={CheckCircle2}/><Metric label="Average quality" value={pct(records.length?records.reduce((a,r)=>a+(calculate(r).quality||0),0)/records.length:NaN)} icon={Activity}/><Metric label="Average availability" value={pct(records.length?records.reduce((a,r)=>a+(calculate(r).availability||0),0)/records.length:NaN)} icon={Gauge}/><Metric label="Acceptance pass rate" value={pct(allStats.count?allStats.pass/allStats.count*100:NaN)} icon={ShieldCheck}/></div><div className="content-grid"><div className="card"><div className="card-head"><div><h3>Downtime by station</h3><p>Accumulated event duration (minutes)</p></div></div><div className="chart"><ResponsiveContainer width="100%" height={270}><BarChart data={downtimeByStation}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis/><Tooltip/><Bar dataKey="minutes" name="Downtime min" fill="#e59a45" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></div><div className="card"><div className="card-head"><div><h3>Downtime responsibility</h3><p>Event count across all SATs</p></div></div><div className="analysis-list">{["LEONI","Supplier","TBD"].map(r=>{const n=records.flatMap(x=>x.events||[]).filter(e=>e.responsibility===r).length;return <div className="analysis-row" key={r}><span>{r}</span><b>{n}</b></div>})}</div><p className="hint">Responsibility event counts are not duration shares. Simultaneous stops may overlap.</p></div></div><div className="card section-card"><h3>Engineering interpretation</h3><ul className="insight-list"><li><b>Availability:</b> compare each machine's measured availability with its agreed acceptance threshold.</li><li><b>Quality:</b> investigate recurring rejected / rework output and identify whether it is process- or station-related.</li><li><b>Downtime:</b> prioritize recurring long stops and supplier-owned issues; event-level Pareto is available in the detailed records.</li><li><b>Limitations:</b> MTBF / MTTR and statistically meaningful trends require consistent event timestamps and a sufficient number of completed SATs.</li></ul></div></>}
      {page==="Actions"&&<div className="card"><div className="card-head"><div><h3>Corrective action register</h3><p>Actions recorded in historical SATs</p></div></div><ActionRegister records={records} onOpen={openRecord}/></div>}
      </>}
      <footer className="app-footer"><span>© {new Date().getFullYear()} SAT-R&R · Engineering validation</span><span><Database size={13}/> Supabase cloud storage · Private workspace</span></footer>
    </main>
    {eventDraft&&<div className="modal-backdrop"><form className="modal" onSubmit={saveEvent}><div className="modal-head"><div><p className="eyebrow">DOWNTIME EVENT</p><h2>{eventDraft.station} · {STATIONS.find(x=>x.id===eventDraft.station)?.name}</h2></div><button type="button" className="icon-btn" onClick={()=>setEventDraft(null)}><X/></button></div><label className="check-field"><input type="checkbox" name="affects_machine" defaultChecked/> Stops machine production</label><Field label="Category" name="category" options={CATEGORIES}/><label className="field">Downtime reason *<textarea name="reason" required autoFocus placeholder="Describe the fault / stop reason"/></label><Field label="Responsibility" name="responsibility" options={["LEONI","Supplier","TBD"]}/><Field label="Issue responsible person / team" name="responsible" placeholder="Name or team"/><label className="field">Corrective action / next steps<textarea name="corrective_action" placeholder="Containment and corrective action"/></label><Field label="Action owner" name="owner" placeholder="Owner / department"/><Field label="Action status" name="action_status" options={["Open","In progress","Completed"]}/><div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setEventDraft(null)}>Cancel</button><button className="btn primary">Save downtime</button></div></form></div>}
  </div>;
}

function Metric({icon:Icon,label,value,note}){return <div className="metric-card"><div className="metric-icon"><Icon size={19}/></div><p>{label}</p><strong>{value??"—"}</strong>{note&&<small>{note}</small>}</div>}
function Field({label,value,onChange,type="text",required,options,name,placeholder}){return <label className="field">{label}{options?<select name={name} value={value} onChange={e=>onChange?.(e.target.value)} required={required}>{options.map(x=><option key={x}>{x}</option>)}</select>:<input name={name} type={type} value={value??""} onChange={e=>onChange?.(e.target.value)} required={required} placeholder={placeholder}/>}</label>}
function SectionTitle({icon:Icon,title,sub}){return <div className="section-heading"><div className="section-icon"><Icon size={19}/></div><div><h3>{title}</h3><p>{sub}</p></div></div>}
function Counter({label,value,onChange,disabled}){return <div className="counter-box"><div><small>{label}</small><b>{value}</b></div><div className="counter-buttons"><button disabled={disabled||value<=0} onClick={()=>onChange(value-1)} type="button">−</button><button disabled={disabled} onClick={()=>onChange(value+1)} type="button">+</button></div></div>}
function Acceptance({checks,complete,pass}){return <><div className={`acceptance-banner ${!complete?"pending":pass?"passed":"failed"}`}><div>{complete?(pass?<CheckCircle2/>:<AlertTriangle/>):<AlertTriangle/>}</div><div><b>{!complete?"INCOMPLETE · REVIEW REQUIRED":pass?"CONFIGURED CRITERIA MET":"CONFIGURED CRITERIA NOT MET"}</b><p>{!complete?"Complete all acceptance criteria before reaching a conclusion.":pass?"All configured numerical criteria are met. Confirm all contractual and qualitative SAT requirements.":"One or more configured numerical criteria are not met."}</p></div></div><div className="check-list">{checks.map(c=><div className="check-row" key={c.name}><span className={`check-icon ${c.pass===null?"pending":c.pass?"ok":"no"}`}>{c.pass===null?"—":c.pass?"✓":"!"}</span><div><b>{c.name}</b><small>{c.actual}</small></div><strong>{c.pass===null?"Not configured":c.pass?"PASS":"FAIL"}</strong></div>)}</div><p className="hint">This is an engineering screening result, not an automatic contractual SAT approval. Review safety, documentation, cycle-time stability, sample quality and customer sign-off separately.</p></>}
function RecordTable({rows,onOpen,onDelete}){if(!rows.length)return <div className="empty-state"><ClipboardCheck size={28}/><b>No SAT records yet</b><p>Create your first SAT to start building the history.</p></div>;return <div className="table-scroll"><table><thead><tr><th>Project / machine</th><th>Engineer</th><th>Date</th><th>Production</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(r=>{const m=calculate(r),a=acceptance(r,m);return <tr key={r.id}><td><b>{r.project}</b><small>{r.machine} · {r.customer||"No customer"}</small></td><td>{r.engineer||"—"}</td><td>{new Date(r.created_at||r.started_at||Date.now()).toLocaleDateString()}</td><td>{r.good||0} good / {r.failed||0} reject</td><td><span className={`status ${r.status==="completed"?(a.pass?"running":"failed"):r.status==="in_progress"?"draft":"draft"}`}>{r.status==="completed"?(a.pass?"CRITERIA MET":"REVIEW"):r.status||"draft"}</span></td><td><button className="text-btn" onClick={()=>onOpen(r)}>Open</button><button className="icon-btn" title="Delete" onClick={()=>onDelete(r.id)}><Trash2 size={15}/></button></td></tr>})}</tbody></table></div>}
function ActionEditor({actions,onChange}){function add(){onChange([...actions,{id:uid(),title:"",description:"",owner:"",due_date:"",status:"Open",priority:"Medium"}]);}return <div className="action-editor">{actions.map((a,i)=><div className="action-edit-row" key={a.id}><div className="form-grid"><Field label="Action title" value={a.title} onChange={v=>onChange(actions.map((x,j)=>i===j?{...x,title:v}:x))}/><Field label="Owner" value={a.owner} onChange={v=>onChange(actions.map((x,j)=>i===j?{...x,owner:v}:x))}/><Field label="Due date" type="date" value={a.due_date} onChange={v=>onChange(actions.map((x,j)=>i===j?{...x,due_date:v}:x))}/><Field label="Status" value={a.status} options={["Open","In progress","Completed"]} onChange={v=>onChange(actions.map((x,j)=>i===j?{...x,status:v}:x))}/></div><button className="text-btn danger-text" onClick={()=>onChange(actions.filter((_,j)=>j!==i))} type="button">Remove action</button></div>)}<button className="btn secondary" onClick={add} type="button"><Plus size={15}/> Add corrective action</button></div>}
function ActionRegister({records,onOpen}){const rows=records.flatMap(r=>(r.actions||[]).map(a=>({...a,project:r.project,machine:r.machine,record:r})));if(!rows.length)return <div className="empty-state"><Wrench/><b>No corrective actions recorded</b><p>Actions added during SAT execution appear here.</p></div>;return <div className="table-scroll"><table><thead><tr><th>Action</th><th>Project / machine</th><th>Owner</th><th>Due date</th><th>Status</th><th/></tr></thead><tbody>{rows.map((a,i)=><tr key={a.id||i}><td><b>{a.title}</b><small>{a.description}</small></td><td>{a.project}<small>{a.machine}</small></td><td>{a.owner||"Unassigned"}</td><td>{a.due_date||"—"}</td><td><span className="status draft">{a.status}</span></td><td><button className="text-btn" onClick={()=>onOpen(a.record)}>Open SAT</button></td></tr>)}</tbody></table></div>}
function exportCsv(records){const rows=[["Project","Machine","Customer","Engineer","Status","Good","Failed","Availability %","Quality %","Downtime seconds","Created"]];records.forEach(r=>{const m=calculate(r);rows.push([r.project,r.machine,r.customer,r.engineer,r.status,r.good,r.failed,m.availability,m.quality,m.dt,r.created_at]);});const csv=rows.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\r\n");const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="SAT-RR-analysis.csv";a.click();URL.revokeObjectURL(url);}
export { App };
