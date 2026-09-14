"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AirVent, ArrowRight, BatteryCharging, Check, ChevronRight, CircleAlert,
  Cloud, CloudCog, Cpu, Gauge, GitCompareArrows, Lightbulb, ListRestart, LockKeyhole,
  Network, Play, Radio, Refrigerator, RotateCcw, ServerCog, ShieldCheck, Timer,
  TriangleAlert, Waves, Wifi, WifiOff, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DeviceState = "ON" | "OFF" | "AUTO" | "STANDBY" | "82%";
type Policy = "Last Write Wins" | "Local Authority Wins" | "Cloud Authority Wins" | "Manual Confirmation" | "Safety Policy";
type Preset = "Stable" | "Intermittent" | "High Latency" | "Packet Loss" | "Offline" | "Reconnecting";

const DEVICE_META = [
  { name: "AC", icon: AirVent, power: "0 W" },
  { name: "Refrigerator", icon: Refrigerator, power: "86 W" },
  { name: "Lights", icon: Lightbulb, power: "0 W" },
  { name: "Bilge Pump", icon: Waves, power: "2 W" },
  { name: "Battery", icon: BatteryCharging, power: "+420 W" },
];

const BASE_STATES: Record<string, DeviceState> = { AC: "OFF", Refrigerator: "ON", Lights: "OFF", "Bilge Pump": "AUTO", Battery: "82%" };
const policies: Policy[] = ["Last Write Wins", "Local Authority Wins", "Cloud Authority Wins", "Manual Confirmation", "Safety Policy"];
const demoLabels = ["Ready", "Boat offline", "AC ON queued", "Manual AC OFF", "Reconnecting", "Conflict detected", "Policy applied", "States converged"];

const timelineEvents = [
  { t: "14:02:08", lane: "Cloud", label: "Remote command · AC ON", kind: "cyan" },
  { t: "14:02:09", lane: "Network", label: "Connection lost", kind: "orange" },
  { t: "14:02:09", lane: "Cloud", label: "Command queued · CMD-1042", kind: "blue" },
  { t: "14:03:21", lane: "Physical", label: "Manual change · AC OFF", kind: "orange" },
  { t: "14:03:22", lane: "Edge", label: "Local state v18 stored", kind: "blue" },
  { t: "14:05:00", lane: "Network", label: "Reconnection established", kind: "green" },
  { t: "14:05:01", lane: "Edge", label: "State exchange · v18 ↔ v42", kind: "cyan" },
  { t: "14:05:02", lane: "Cloud", label: "Conflict detected", kind: "rose" },
  { t: "14:05:03", lane: "Edge", label: "Cloud authority applied", kind: "violet" },
  { t: "14:05:05", lane: "Physical", label: "Final sync · AC ON", kind: "green" },
];

const presetConfig: Record<Preset, { latency: number; loss: number; duration: number; connectivity: number[] }> = {
  Stable: { latency: 42, loss: 0, duration: 0, connectivity: [99, 100, 99, 100, 100, 99, 100, 100, 99, 100] },
  Intermittent: { latency: 180, loss: 8, duration: 12, connectivity: [98, 72, 90, 30, 80, 42, 96, 60, 88, 99] },
  "High Latency": { latency: 850, loss: 2, duration: 0, connectivity: [92, 88, 91, 90, 89, 94, 90, 92, 91, 93] },
  "Packet Loss": { latency: 210, loss: 28, duration: 0, connectivity: [94, 62, 78, 52, 70, 46, 82, 58, 76, 64] },
  Offline: { latency: 0, loss: 100, duration: 120, connectivity: [96, 78, 42, 0, 0, 0, 0, 0, 0, 0] },
  Reconnecting: { latency: 460, loss: 12, duration: 45, connectivity: [0, 0, 8, 22, 44, 60, 76, 88, 96, 100] },
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

function StatusPill({ status }: { status: string }) {
  const tone = status.includes("CONFLICT") || status.includes("FAILED") ? "rose" : status.includes("QUEUED") || status.includes("OFFLINE") || status.includes("WAITING") ? "orange" : status.includes("SYNC") || status.includes("CONFIRMED") || status.includes("ONLINE") ? "green" : "cyan";
  const colors: Record<string, string> = { rose: "border-rose-400/25 bg-rose-400/10 text-rose-300", orange: "border-orange-400/25 bg-orange-400/10 text-orange-300", green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300", cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300" };
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold tracking-wide", colors[tone])}><i className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cx("rounded-2xl border border-white/10 bg-[#0b1b21]/95 shadow-[0_18px_60px_rgba(0,0,0,.18)]", className)}>{children}</section>;
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2></div>{action}</div>;
}

function Metric({ icon: Icon, label, value, tone = "cyan" }: { icon: React.ElementType; label: string; value: string; tone?: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-4"><div className="mb-3 flex items-center justify-between"><Icon className={cx("h-4 w-4", tone === "green" ? "text-emerald-300" : tone === "orange" ? "text-orange-300" : tone === "rose" ? "text-rose-300" : "text-cyan-300")} /><span className="text-[11px] uppercase tracking-wider text-slate-500">{label}</span></div><p className="font-mono text-2xl font-semibold">{value}</p></div>;
}

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [online, setOnline] = useState(false);
  const [phase, setPhase] = useState("Offline · edge autonomous");
  const [demoStep, setDemoStep] = useState(0);
  const [cloudAC, setCloudAC] = useState<DeviceState>("OFF");
  const [edgeAC, setEdgeAC] = useState<DeviceState>("OFF");
  const [physicalAC, setPhysicalAC] = useState<DeviceState>("OFF");
  const [queue, setQueue] = useState<Array<{ id: string; device: string; desired: string; time: string; status: string }>>([]);
  const [policy, setPolicy] = useState<Policy>("Cloud Authority Wins");
  const [conflict, setConflict] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [preset, setPreset] = useState<Preset>("Offline");
  const [latency, setLatency] = useState(0);
  const [loss, setLoss] = useState(100);
  const [offlineDuration, setOfflineDuration] = useState(120);
  const [commandCount, setCommandCount] = useState(0);
  const running = useRef(false);

  const connectivityData = useMemo(() => presetConfig[preset].connectivity.map((value, i) => ({ t: `${i * 10}s`, value })), [preset]);
  const consistent = cloudAC === edgeAC && edgeAC === physicalAC && queue.length === 0 && !conflict;

  const reset = () => {
    running.current = false; setOnline(false); setPhase("Offline · edge autonomous"); setDemoStep(0);
    setCloudAC("OFF"); setEdgeAC("OFF"); setPhysicalAC("OFF"); setQueue([]); setConflict(false); setResolved(false); setCommandCount(0);
  };

  const sendACCommand = () => {
    const id = `CMD-${1042 + commandCount}`;
    setCommandCount((n) => n + 1); setCloudAC("ON");
    if (online) {
      setPhase("Executing command");
      setQueue([{ id, device: "AC", desired: "ON", time: "Now", status: "EXECUTING" }]);
      window.setTimeout(() => { setEdgeAC("ON"); setPhysicalAC("ON"); setQueue([{ id, device: "AC", desired: "ON", time: "Now", status: "CONFIRMED" }]); setPhase("Cloud · edge · physical synced"); }, 700);
      window.setTimeout(() => setQueue([]), 1600);
    } else {
      setQueue((q) => [{ id, device: "AC", desired: "ON", time: "14:02:09", status: "QUEUED · WAITING" }, ...q]);
      setPhase("Command queued locally"); setDemoStep(Math.max(demoStep, 2));
    }
  };

  const manualSetOff = () => {
    setPhysicalAC("OFF"); setEdgeAC("OFF"); setPhase("Manual AC OFF recorded at edge"); setDemoStep(Math.max(demoStep, 3));
  };

  const reconnect = () => {
    setOnline(true); setPhase("Reconnecting · TLS session"); setDemoStep(4);
    window.setTimeout(() => setPhase("Syncing · exchanging state vectors"), 550);
    window.setTimeout(() => {
      if (queue.length && cloudAC !== edgeAC) { setConflict(true); setPhase("Conflict detected · action required"); setDemoStep(5); }
      else { setEdgeAC(cloudAC); setPhysicalAC(cloudAC); setPhase("Cloud · edge · physical synced"); setQueue([]); }
    }, 1150);
  };

  const applyPolicy = (manualState?: DeviceState) => {
    let finalState: DeviceState = "ON";
    if (policy === "Local Authority Wins" || policy === "Safety Policy") finalState = edgeAC;
    if (policy === "Last Write Wins") finalState = edgeAC;
    if (policy === "Manual Confirmation") finalState = manualState ?? edgeAC;
    setCloudAC(finalState); setEdgeAC(finalState); setPhysicalAC(finalState); setConflict(false); setResolved(true); setQueue([]); setDemoStep(7); setPhase(`Resolved · ${policy}`);
  };

  const runDemo = async () => {
    if (running.current) return;
    reset(); running.current = true; setView("command");
    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    await wait(250); setDemoStep(1); setPhase("Boat offline · edge autonomous");
    await wait(700); setCloudAC("ON"); setQueue([{ id: "CMD-1042", device: "AC", desired: "ON", time: "14:02:09", status: "QUEUED · WAITING" }]); setDemoStep(2); setPhase("Command queued locally");
    await wait(900); setPhysicalAC("OFF"); setEdgeAC("OFF"); setDemoStep(3); setPhase("Manual change recorded at edge");
    await wait(900); setOnline(true); setDemoStep(4); setPhase("Reconnecting · state exchange");
    await wait(1100); setConflict(true); setDemoStep(5); setPhase("Conflict detected · action required"); setView("conflict");
    await wait(1200); setDemoStep(6); setPhase(`Applying ${policy}`);
    await wait(900); const finalState: DeviceState = policy === "Cloud Authority Wins" ? "ON" : "OFF"; setCloudAC(finalState); setEdgeAC(finalState); setPhysicalAC(finalState); setQueue([]); setConflict(false); setResolved(true); setDemoStep(7); setPhase("Cloud · edge · physical converged"); running.current = false;
  };

  const changePreset = (next: Preset) => {
    const config = presetConfig[next]; setPreset(next); setLatency(config.latency); setLoss(config.loss); setOfflineDuration(config.duration); setOnline(next === "Stable" || next === "High Latency" || next === "Packet Loss");
  };

  useEffect(() => {
    type ToolContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ToolContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Record<string, unknown>) => { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); } catch { /* unsupported preview context */ } };
    register({
      name: "queue_ac_on_command", title: "Queue AC ON command",
      description: "Issue the prototype's AC ON remote command using the current vessel connectivity state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => { sendACCommand(); return { command: "AC=ON", result: online ? "executing" : "queued" }; },
    });
    register({
      name: "start_offline_ac_demo", title: "Start offline AC demo",
      description: "Run the deterministic offline-first AC command and conflict-resolution demonstration.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: () => { void runDemo(); return { scenario: "offline-ac-on", result: "started" }; },
    });
    return () => lifecycle.abort();
  });

  const states = { ...BASE_STATES, AC: cloudAC };
  const edgeStates = { ...BASE_STATES, AC: edgeAC };
  const physicalStates = { ...BASE_STATES, AC: physicalAC, "Bilge Pump": "STANDBY" as DeviceState };

  return <main className="min-h-screen bg-[#071014] text-[#eaf7f6]">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08161b]/90 px-4 py-3 backdrop-blur-xl lg:px-7">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
        <button onClick={() => setView("dashboard")} className="flex items-center gap-3 text-left" aria-label="Open dashboard">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10"><Waves className="h-5 w-5 text-cyan-300" /></div>
          <div><h1 className="font-semibold tracking-tight">BoatSync Twin</h1><p className="hidden text-xs text-slate-400 sm:block">Edge Operations Console · M/Y Asteria</p></div>
        </button>
        <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-400 lg:flex"><Radio className="h-3.5 w-3.5 text-cyan-300" /><span className="truncate">{phase}</span></div>
        <div className={cx("flex items-center gap-2 rounded-full border px-3 py-2", online ? "border-emerald-400/30 bg-emerald-400/10" : "border-orange-400/30 bg-orange-400/10")}>
          {online ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-orange-300" />}
          <span className="text-xs font-semibold tracking-[0.14em] sm:text-sm">{online ? "ONLINE" : "OFFLINE"}</span>
          <Switch checked={online} onCheckedChange={(v) => v ? reconnect() : (setOnline(false), setPhase("Offline · edge autonomous"))} aria-label="Toggle boat connectivity" />
        </div>
      </div>
    </header>

    <Tabs value={view} onValueChange={setView} className="mx-auto max-w-[1600px] px-4 pb-10 lg:px-7">
      <div className="sticky top-[65px] z-30 -mx-4 mb-6 overflow-x-auto border-b border-white/[.07] bg-[#071014]/92 px-4 py-3 backdrop-blur-lg lg:-mx-7 lg:px-7">
        <TabsList variant="line" className="h-auto min-w-max gap-1 bg-transparent">
          <TabsTrigger value="dashboard" className="px-3 py-2.5 data-[state=active]:text-cyan-300"><Gauge />Twin Dashboard</TabsTrigger>
          <TabsTrigger value="command" className="px-3 py-2.5 data-[state=active]:text-cyan-300"><CloudCog />Command Center</TabsTrigger>
          <TabsTrigger value="conflict" className="px-3 py-2.5 data-[state=active]:text-cyan-300"><GitCompareArrows />Conflict Lab</TabsTrigger>
          <TabsTrigger value="timeline" className="px-3 py-2.5 data-[state=active]:text-cyan-300"><Timer />Timeline</TabsTrigger>
          <TabsTrigger value="network" className="px-3 py-2.5 data-[state=active]:text-cyan-300"><Network />Failure Simulator</TabsTrigger>
        </TabsList>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[.045] px-4 py-3">
        <p className="text-sm text-slate-300"><span className="font-semibold text-cyan-300">Default demo:</span> Turn on the AC while the boat is offline</p>
        <div className="flex gap-2"><Button size="sm" variant="ghost" onClick={reset}><RotateCcw />Reset</Button><Button size="sm" onClick={runDemo} disabled={running.current}><Play />Run 20-sec demo</Button></div>
      </div>

      <TabsContent value="dashboard" className="animate-in fade-in duration-300">
        <SectionTitle eyebrow="Live digital twin" title="Vessel state overview" action={<p className="max-w-md text-sm text-slate-400">A three-layer view of cloud intent, edge memory, and physical reality.</p>} />
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {DEVICE_META.map((device) => {
            const Icon = device.icon; const synced = states[device.name] === edgeStates[device.name] && edgeStates[device.name] === physicalStates[device.name];
            return <Panel key={device.name} className="group p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/25">
              <div className="mb-5 flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[.055]"><Icon className="h-5 w-5 text-cyan-300" /></div><StatusPill status={synced ? "SYNCED" : "DIVERGED"} /></div>
              <h3 className="mb-1 text-lg font-semibold">{device.name}</h3><p className="mb-5 text-xs text-slate-500">Updated {device.name === "AC" ? "now" : "12 sec ago"} · {device.power}</p>
              <div className="space-y-2 text-sm">
                {[["Cloud desired",states[device.name]],["Edge / local",edgeStates[device.name]],["Physical",physicalStates[device.name]]].map(([label,value]) => <div key={label} className="flex items-center justify-between border-t border-white/[.06] pt-2"><span className="text-slate-400">{label}</span><span className="font-mono font-semibold">{value}</span></div>)}
              </div>
            </Panel>;
          })}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.45fr_.8fr]">
          <ArchitectureDiagram online={online} consistent={consistent} />
          <StateInspector cloud={cloudAC} edge={edgeAC} physical={physicalAC} online={online} pending={queue[0]?.id ?? "None"} consistent={consistent} />
        </div>
      </TabsContent>

      <TabsContent value="command" className="animate-in fade-in duration-300">
        <SectionTitle eyebrow="Remote operations" title="Remote Command Center" action={<StatusPill status={online ? "LINK ONLINE" : "LINK OFFLINE"} />} />
        <div className="grid gap-4 xl:grid-cols-[1fr_1.25fr]">
          <Panel className="overflow-hidden">
            <div className="border-b border-white/[.07] p-5"><p className="text-sm text-slate-400">Primary command</p><div className="mt-1 flex items-center gap-2 text-xl font-semibold"><AirVent className="text-cyan-300" />Turn on the AC</div></div>
            <div className="p-5">
              <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {["Command", online ? "Executing" : "Queued", online ? "Confirmed" : "Waiting", "Synced"].map((step, i) => <div key={step} className={cx("relative rounded-xl border px-3 py-3", i <= (online ? 2 : queue.length ? 1 : 0) ? "border-cyan-300/25 bg-cyan-300/[.07]" : "border-white/[.07] bg-white/[.02]")}><p className="mb-2 font-mono text-xs text-slate-500">0{i + 1}</p><p className="text-sm font-medium">{step}</p>{i < 3 && <ChevronRight className="absolute -right-3 top-1/2 z-10 h-5 w-5 -translate-y-1/2 rounded-full bg-[#0b1b21] text-slate-600" />}</div>)}
              </div>
              <Button onClick={sendACCommand} className="h-12 w-full text-base"><Zap />Send AC = ON</Button>
              <p className="mt-3 text-center text-xs text-slate-500">Synthetic command only · no hardware integration</p>
            </div>
          </Panel>
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[.07] p-5"><div><h3 className="font-semibold">Asynchronous command queue</h3><p className="mt-1 text-xs text-slate-500">Durable edge journal · deterministic FIFO</p></div><span className="font-mono text-2xl text-cyan-300">{queue.length}</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-white/[.06] text-xs uppercase tracking-wider text-slate-500"><tr>{["Command ID","Device","Desired","Timestamp","Status"].map((x) => <th key={x} className="px-5 py-3 font-medium">{x}</th>)}</tr></thead><tbody>{queue.length ? queue.map((item) => <tr key={item.id} className="border-b border-white/[.05]"><td className="px-5 py-4 font-mono text-cyan-300">{item.id}</td><td className="px-5 py-4">{item.device}</td><td className="px-5 py-4 font-mono">{item.desired}</td><td className="px-5 py-4 text-slate-400">{item.time}</td><td className="px-5 py-4"><StatusPill status={item.status} /></td></tr>) : <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500"><Check className="mx-auto mb-2 h-6 w-6 text-emerald-300" />Queue clear · all commands acknowledged</td></tr>}</tbody></table>
            </div>
            {queue.length > 0 && !online && <div className="m-4 flex items-center justify-between rounded-xl border border-orange-300/15 bg-orange-300/[.06] p-3"><span className="text-sm text-orange-200">Waiting for vessel connectivity</span><Button size="sm" onClick={reconnect}>Reconnect vessel</Button></div>}
          </Panel>
        </div>
        <DemoProgress step={demoStep} />
      </TabsContent>

      <TabsContent value="conflict" className="animate-in fade-in duration-300">
        <SectionTitle eyebrow="Deterministic scenario" title="Conflict Resolution Lab" action={<StatusPill status={conflict ? "CONFLICT ACTIVE" : resolved ? "RESOLVED · CONVERGED" : "SCENARIO READY"} />} />
        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Panel className="p-5">
            <div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold">AC state divergence</h3><p className="mt-1 text-sm text-slate-400">Cloud command and onboard action occurred while disconnected.</p></div><TriangleAlert className={cx("h-6 w-6", conflict ? "animate-pulse text-rose-300" : "text-slate-600")} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StateCard icon={Cloud} label="Cloud desired" value={cloudAC} time="14:02:08 · v42" active={cloudAC === "ON"} />
              <StateCard icon={Cpu} label="Edge state" value={edgeAC} time="14:03:22 · v18" active={edgeAC === "ON"} />
              <StateCard icon={AirVent} label="Physical AC" value={physicalAC} time="14:03:21 · manual" active={physicalAC === "ON"} />
            </div>
            <div className="mt-5 rounded-xl border border-white/[.07] bg-black/10 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-400">Scenario controls:</span><Button size="sm" variant="secondary" onClick={() => { setOnline(false); setCloudAC("ON"); setEdgeAC("OFF"); setPhysicalAC("OFF"); setQueue([{ id:"CMD-1042", device:"AC", desired:"ON", time:"14:02:09", status:"QUEUED · WAITING" }]); setConflict(false); setResolved(false); }}>1 · Stage offline conflict</Button><Button size="sm" variant="secondary" onClick={manualSetOff}>2 · Manual AC = OFF</Button><Button size="sm" onClick={reconnect}>3 · Reconnect</Button></div>
            </div>
            {(conflict || resolved) && <div className={cx("mt-5 rounded-xl border p-4", resolved ? "border-emerald-400/20 bg-emerald-400/[.06]" : "border-rose-400/20 bg-rose-400/[.06]")}><div className="flex items-center gap-3">{resolved ? <ShieldCheck className="text-emerald-300" /> : <CircleAlert className="text-rose-300" />}<div><p className="font-semibold">{resolved ? `Converged on AC ${cloudAC}` : "Concurrent state updates detected"}</p><p className="mt-0.5 text-sm text-slate-400">{resolved ? `Cloud v43 · Edge v19 · Physical confirmed using ${policy}` : "Cloud v42 requests ON; edge v18 records a newer manual OFF."}</p></div></div></div>}
          </Panel>
          <Panel className="p-5">
            <h3 className="font-semibold">Resolution policy</h3><p className="mb-5 mt-1 text-sm text-slate-400">Select who has authority when timestamps and intent disagree.</p>
            <RadioGroup value={policy} onValueChange={(v) => setPolicy(v as Policy)} className="gap-2">
              {policies.map((item) => <label key={item} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition", policy === item ? "border-cyan-300/30 bg-cyan-300/[.065]" : "border-white/[.07] hover:bg-white/[.025]")}><RadioGroupItem value={item} className="mt-0.5" /><span><span className="block text-sm font-medium">{item}</span><span className="mt-0.5 block text-xs text-slate-500">{item === "Safety Policy" ? "Preserve the safest locally observed state." : item === "Manual Confirmation" ? "Require an operator to choose the final state." : item.includes("Cloud") ? "Cloud intent is authoritative." : item.includes("Local") ? "Onboard state is authoritative." : "Newest timestamp wins."}</span></span></label>)}
            </RadioGroup>
            {policy === "Manual Confirmation" ? <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => applyPolicy("OFF")}>Keep OFF</Button><Button onClick={() => applyPolicy("ON")}>Apply ON</Button></div> : <Button className="mt-4 w-full" onClick={() => applyPolicy()} disabled={!conflict && !queue.length}><ShieldCheck />Apply {policy}</Button>}
          </Panel>
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="animate-in fade-in duration-300">
        <SectionTitle eyebrow="Distributed sequence" title="Synchronization Timeline" action={<Button size="sm" variant="secondary" onClick={runDemo}><Play />Replay scenario</Button>} />
        <Panel className="overflow-hidden p-4 sm:p-6">
          <div className="grid min-w-[760px] grid-cols-[90px_repeat(4,1fr)] border-b border-white/[.08] pb-3 text-xs font-semibold uppercase tracking-wider text-slate-500"><span>Time</span>{[[Cloud,"Cloud"],[Network,"Network"],[ServerCog,"Edge"],[AirVent,"Physical Device"]].map(([Icon,label]) => { const C = Icon as React.ElementType; return <span key={String(label)} className="flex items-center gap-2"><C className="h-4 w-4 text-cyan-300" />{String(label)}</span>; })}</div>
          <div className="min-w-[760px]">
            {timelineEvents.map((event, i) => <div key={event.label} className="relative grid min-h-[62px] grid-cols-[90px_repeat(4,1fr)] items-center border-b border-white/[.045] last:border-0"><span className="font-mono text-xs text-slate-500">{event.t}</span>{["Cloud","Network","Edge","Physical"].map((lane) => <div key={lane} className="relative h-full border-l border-white/[.045] px-2 py-2">{event.lane === lane && <div className={cx("animate-in slide-in-from-left-2 rounded-lg border px-3 py-2 text-xs font-medium", event.kind === "green" ? "border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200" : event.kind === "orange" ? "border-orange-400/20 bg-orange-400/[.08] text-orange-200" : event.kind === "rose" ? "border-rose-400/20 bg-rose-400/[.08] text-rose-200" : event.kind === "violet" ? "border-violet-400/20 bg-violet-400/[.08] text-violet-200" : "border-cyan-400/20 bg-cyan-400/[.08] text-cyan-200")} style={{ animationDelay: `${i * 40}ms` }}>{event.label}</div>}</div>)}</div>)}
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="network" className="animate-in fade-in duration-300">
        <SectionTitle eyebrow="Synthetic network lab" title="Network Failure Simulator" action={<StatusPill status={preset.toUpperCase()} />} />
        <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
          <Panel className="p-5"><h3 className="font-semibold">Failure profile</h3><p className="mb-4 mt-1 text-sm text-slate-400">Preset values are deterministic and fully local.</p><div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">{(Object.keys(presetConfig) as Preset[]).map((item) => <Button key={item} size="sm" variant={preset === item ? "default" : "secondary"} onClick={() => changePreset(item)}>{item}</Button>)}</div><div className="space-y-6"><RangeControl label="Latency" value={latency} max={1200} unit="ms" onChange={setLatency} /><RangeControl label="Packet loss" value={loss} max={100} unit="%" onChange={setLoss} /><RangeControl label="Offline duration" value={offlineDuration} max={300} unit="sec" onChange={setOfflineDuration} /></div></Panel>
          <Panel className="p-5"><div className="mb-3 flex items-center justify-between"><div><h3 className="font-semibold">Link quality</h3><p className="mt-1 text-xs text-slate-500">Connectivity index · rolling 90 sec</p></div><Activity className="text-cyan-300" /></div><div className="h-[255px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={connectivityData} margin={{ top: 15, right: 5, left: -24, bottom: 0 }}><defs><linearGradient id="marine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#67e8f9" stopOpacity={.32}/><stop offset="100%" stopColor="#67e8f9" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#ffffff0d" vertical={false}/><XAxis dataKey="t" tick={{ fill: "#647b83", fontSize: 11 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{ fill: "#647b83", fontSize: 11 }} axisLine={false} tickLine={false}/><Tooltip contentStyle={{ background: "#0b1b21", border: "1px solid #ffffff20", borderRadius: 10, fontSize: 12 }} itemStyle={{ color: "#67e8f9" }}/><Area type="monotone" dataKey="value" stroke="#67e8f9" strokeWidth={2} fill="url(#marine)" /></AreaChart></ResponsiveContainer></div></Panel>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7"><Metric icon={ListRestart} label="Issued" value="12" /><Metric icon={Zap} label="Immediate" value={preset === "Offline" ? "0" : "7"} tone="green" /><Metric icon={CloudCog} label="Queued" value={preset === "Offline" ? "8" : "3"} tone="orange" /><Metric icon={Check} label="Synced" value={preset === "Offline" ? "4" : "11"} tone="green" /><Metric icon={GitCompareArrows} label="Conflicts" value={loss > 20 ? "3" : "1"} tone="rose" /><Metric icon={TriangleAlert} label="Failed" value={loss > 50 ? "2" : "0"} tone="rose" /><div className="col-span-2 md:col-span-1"><Metric icon={ShieldCheck} label="Convergence" value={`${Math.max(0, 100 - Math.round(loss * .35))}%`} tone="green" /></div></div>
      </TabsContent>
    </Tabs>

    <footer className="border-t border-white/[.07] px-5 py-5 text-center text-xs text-slate-500"><p className="font-medium text-slate-400">Research Prototype — Synthetic Marine System &amp; Network Scenarios</p><p className="mt-1">No Volvo proprietary data · No real MQTT/cloud integration · No real boat hardware · Frontend simulation only</p></footer>
  </main>;
}

function ArchitectureDiagram({ online, consistent }: { online: boolean; consistent: boolean }) {
  const nodes = [[Cloud,"Cloud Twin","Desired state · v42"],[Network,"Connectivity",online ? "Online · 42 ms" : "Offline · queueing"],[Cpu,"Edge Twin","Local journal · v18"],[AirVent,"Physical System","Sensors + actuators"]] as const;
  return <Panel className="p-5"><div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold">Offline-first architecture</h3><p className="mt-1 text-sm text-slate-400">Commands persist across connectivity gaps.</p></div><StatusPill status={consistent ? "EVENTUAL CONSISTENCY" : "RECONCILIATION PENDING"} /></div><div className="grid gap-2 sm:grid-cols-4">{nodes.map(([Icon,title,sub],i) => <div key={title} className="relative rounded-xl border border-white/[.07] bg-white/[.025] p-4"><Icon className={cx("mb-4 h-5 w-5", i === 1 && !online ? "text-orange-300" : "text-cyan-300")} /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-slate-500">{sub}</p>{i < 3 && <ArrowRight className={cx("absolute -right-3 top-1/2 z-10 h-6 w-6 -translate-y-1/2 rounded-full border border-white/10 bg-[#0b1b21] p-1", i === 1 && !online ? "text-orange-300" : "text-cyan-300")} />}</div>)}</div></Panel>;
}

function StateInspector({ cloud, edge, physical, online, pending, consistent }: { cloud: DeviceState; edge: DeviceState; physical: DeviceState; online: boolean; pending: string; consistent: boolean }) {
  const rows = [["Desired cloud state",cloud],["Edge state",edge],["Physical state",physical],["Cloud version","v42"],["Edge version","v18"],["Pending command",pending],["Connectivity",online ? "ONLINE" : "OFFLINE"],["Consistency",consistent ? "CONSISTENT" : "DIVERGED"]];
  return <Panel className="p-5"><div className="mb-4 flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-cyan-300" /><h3 className="font-semibold">Digital Twin State Inspector</h3></div><div className="divide-y divide-white/[.055]">{rows.map(([label,value]) => <div key={label} className="flex items-center justify-between py-2 text-sm"><span className="text-slate-400">{label}</span><span className={cx("font-mono text-xs font-semibold", value === "DIVERGED" || value === "OFFLINE" ? "text-orange-300" : value === "CONSISTENT" || value === "ONLINE" ? "text-emerald-300" : "text-slate-100")}>{value}</span></div>)}</div></Panel>;
}

function StateCard({ icon: Icon, label, value, time, active }: { icon: React.ElementType; label: string; value: DeviceState; time: string; active: boolean }) {
  return <div className={cx("rounded-xl border p-4", active ? "border-cyan-300/20 bg-cyan-300/[.05]" : "border-orange-300/20 bg-orange-300/[.045]")}><div className="mb-5 flex items-center justify-between"><Icon className={active ? "text-cyan-300" : "text-orange-300"} /><span className="font-mono text-2xl font-semibold">{value}</span></div><p className="text-sm font-medium">{label}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{time}</p></div>;
}

function DemoProgress({ step }: { step: number }) {
  return <Panel className="mt-4 p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Default demo sequence</h3><p className="mt-1 text-xs text-slate-500">{demoLabels[step]}</p></div><span className="font-mono text-sm text-cyan-300">{Math.round((step / 7) * 100)}%</span></div><Progress value={(step / 7) * 100} className="mb-4" /><div className="grid grid-cols-4 gap-2 lg:grid-cols-8">{demoLabels.map((label,i) => <div key={label} className={cx("rounded-lg border px-2 py-2 text-center text-[11px]", i <= step ? "border-cyan-300/20 bg-cyan-300/[.06] text-cyan-200" : "border-white/[.06] text-slate-600")}><span className="block font-mono">0{i + 1}</span><span className="mt-1 block">{label}</span></div>)}</div></Panel>;
}

function RangeControl({ label, value, max, unit, onChange }: { label: string; value: number; max: number; unit: string; onChange: (v: number) => void }) {
  return <div><div className="mb-3 flex items-center justify-between text-sm"><span className="text-slate-300">{label}</span><span className="font-mono font-semibold text-cyan-300">{value} {unit}</span></div><Slider value={[value]} max={max} step={max === 100 ? 1 : 10} onValueChange={(v) => onChange(v[0])} aria-label={label} /></div>;
}
