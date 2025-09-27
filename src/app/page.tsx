"use client";

import { useEffect, useRef, useState } from "react";

// Single-file interactive Smith Chart Tool
// NOTE: This implementation focuses on core RF engineering utilities using only Canvas + Tailwind + plain JS.

interface PointData {
  z: Complex; // normalized impedance
  gamma: Complex; // reflection coefficient
  note?: string;
}

interface Complex { r: number; i: number }

function cAdd(a: Complex, b: Complex): Complex { return { r: a.r + b.r, i: a.i + b.i }; }
function cSub(a: Complex, b: Complex): Complex { return { r: a.r - b.r, i: a.i - b.i }; }
function cMul(a: Complex, b: Complex): Complex { return { r: a.r * b.r - a.i * b.i, i: a.r * b.i + a.i * b.r }; }
function cDiv(a: Complex, b: Complex): Complex { const d = b.r*b.r + b.i*b.i; return { r: (a.r*b.r + a.i*b.i)/d, i: (a.i*b.r - a.r*b.i)/d }; }
function cInv(a: Complex): Complex { const d = a.r*a.r + a.i*a.i; return { r: a.r/d, i: -a.i/d }; }
function cMag(a: Complex): number { return Math.hypot(a.r, a.i); }
function cAngDeg(a: Complex): number { return (Math.atan2(a.i, a.r)*180/Math.PI + 360)%360; }

function zToGamma(z: Complex): Complex { return cDiv(cSub(z, {r:1,i:0}), cAdd(z,{r:1,i:0})); }
function gammaToZ(g: Complex): Complex { return cDiv(cAdd({r:1,i:0}, g), cSub({r:1,i:0}, g)); }

// Rotate reflection coefficient by angle (degrees)
function rotateGamma(g: Complex, deg: number): Complex {
  const rad = deg * Math.PI/180;
  const c = Math.cos(rad), s = Math.sin(rad);
  return { r: g.r*c - g.i*s, i: g.r*s + g.i*c };
}

export default function SmithChartApp() {
  const canvasRef = useRef<HTMLCanvasElement|null>(null);
  const [isAdmittance, setIsAdmittance] = useState(false);
  const [Z0, setZ0] = useState(50);
  const [z0Raw, setZ0Raw] = useState('50');
  const [R, setR] = useState<number|''>(75);
  const [X, setX] = useState<number|''>(10);
  const [zlString, setZlString] = useState('75+j10');
  const [zlValid, setZlValid] = useState(true);
  const [freqMHz, setFreqMHz] = useState(1000); // 1 GHz default
  const [freqRaw, setFreqRaw] = useState('1000');
  const [z0InputError, setZ0InputError] = useState<string|null>(null);
  const [freqInputError, setFreqInputError] = useState<string|null>(null);
  const [points, setPoints] = useState<PointData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number|null>(null);
  const [distance, setDistance] = useState(0); // in wavelengths
  const [towards, setTowards] = useState<'generator'|'load'>('generator');
  const [lMatchSolution, setLMatchSolution] = useState<'A'|'B'|null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [chartMax, setChartMax] = useState(820); // maximum canvas dimension

  // Resize handling
  useEffect(()=>{
    function handle(){ draw(); }
    window.addEventListener('resize', handle);
    draw();
    return ()=>window.removeEventListener('resize', handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmittance, points, activeIndex, distance, towards, lMatchSolution, matchData]);

  // Core drawing routine
  function draw(){
    const canvas = canvasRef.current; if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
  const size = Math.min(parent.clientWidth, chartMax); // responsive with adjustable max
    canvas.width = size * dpr; canvas.height = size * dpr; canvas.style.width = size+"px"; canvas.style.height = size+"px";
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,size,size);
    ctx.save();
    const center = { x: size/2, y: size/2 };
    const radius = size/2 - 8; // padding
    ctx.translate(center.x, center.y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#555';
    ctx.beginPath();
    ctx.arc(0,0,radius,0,Math.PI*2);
    ctx.stroke();

    // Draw resistance circles using analytical centers in Γ-plane
    const rVals = [0,0.2,0.5,1,2,5];
    ctx.font = '11px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    rVals.forEach(r=>{
      if(r===0){
        // outer unit circle already drawn
        ctx.fillStyle = '#aaa';
        ctx.fillText(isAdmittance? 'g=0':'r=0', -radius+6, -12);
      } else {
        const centerGamma = r/(r+1); // on real axis
        const rad = 1/(r+1);
        ctx.beginPath();
        ctx.strokeStyle = '#555';
        ctx.arc(centerGamma*radius,0, rad*radius,0,Math.PI*2);
        ctx.stroke();
        ctx.fillStyle = '#aaa';
        ctx.fillText((isAdmittance?'g=':'r=')+r, (centerGamma+rad)*radius+4, 0);
      }
    });
    // Reactance arcs via sampling (more accurate)
    const xVals = [0.2,0.5,1,2,5];
    ctx.strokeStyle = '#555';
    xVals.forEach(x=>{
      [x, -x].forEach(val=>{
        const sign = val>0? 1:-1;
        ctx.beginPath();
        let first=true;
        // Sweep r from 0 to large (simulate infinity) to trace arc
        for(let r=0; r<=200; r+= (r<5? 0.05: r<20?0.2:1)){
          const z: Complex = { r, i: val };
          const g = zToGamma(z);
          const mag = cMag(g);
            if(mag>1+1e-3) break; // outside chart boundary
          const px = g.r*radius; const py = -g.i*radius;
          if(first){ ctx.moveTo(px,py); first=false; } else ctx.lineTo(px,py);
        }
        ctx.stroke();
        // label near middle point (choose r ~1)
        const zMid: Complex = { r:1, i: val };
        const gMid = zToGamma(zMid);
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText(isAdmittance? (val>0? `-b=${Math.abs(val)}`:`+b=${Math.abs(val)}`): (val>0? `+j${val}`:`-j${Math.abs(val)}`), gMid.r*radius, -gMid.i*radius + (sign>0? -10: 10));
        ctx.textAlign = 'left';
      });
    });

    // Draw axis
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(-radius,0); ctx.lineTo(radius,0); ctx.stroke();

    // Points & overlays
    points.forEach((p, idx)=>{
      const g = p.gamma; // reflection coefficient
      const px = g.r * radius; const py = -g.i * radius;
      // SWR circle for active point
      if(idx===activeIndex){
        const mag = cMag(g);
        ctx.strokeStyle = 'rgba(255,80,80,0.6)';
        ctx.beginPath(); ctx.arc(0,0,mag*radius,0,Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = idx===activeIndex? '#ffcd4d':'#4dabff';
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2); ctx.fill();
    });

    // Transmission line movement (rotate gamma along SWR)
    if(activeIndex!=null){
      const p = points[activeIndex];
      const g0 = p.gamma;
      const angleChange = (towards==='generator' ? -1:1) * distance * 360 * 2; // 4π * d -> degrees = 720*d
      const g1 = rotateGamma(g0, angleChange);
      const mag = cMag(g0);
      ctx.strokeStyle = '#ff8888';
      ctx.beginPath(); ctx.arc(0,0, mag*radius, 0,0); // placeholder to set state
      // Draw small arc between original and new angle for visualization
      const a0 = Math.atan2(-g0.i, g0.r); // canvas angle
      const a1 = Math.atan2(-g1.i, g1.r);
      ctx.beginPath();
      ctx.strokeStyle = '#ff5555';
      ctx.arc(0,0, mag*radius, a0, a1, (towards==='generator')); ctx.stroke();
      // Draw new point
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(g1.r*radius, -g1.i*radius, 5,0,Math.PI*2); ctx.fill();
    }

    // L-match path (simplified visualization)
    if(activeIndex!=null && matchData && lMatchSolution){
      const sol = matchData[lMatchSolution];
      if(sol && sol.intermediateGamma){
        ctx.strokeStyle = '#6ee7b7';
        ctx.beginPath();
        const p = points[activeIndex];
        ctx.moveTo(p.gamma.r*radius, -p.gamma.i*radius);
        ctx.lineTo(sol.intermediateGamma.r*radius, -sol.intermediateGamma.i*radius);
        ctx.lineTo(0,0);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function parseNumber(v: any): number { const n = parseFloat(v); return isFinite(n)? n: 0; }

  function addPointFromInputs(){
    let rLocal: number|'' = R;
    let xLocal: number|'' = X;
    // Prefer ZL string if present & valid
    if(zlString.trim() !== ''){
      const parsed = parseZL(zlString);
      if(parsed){ rLocal = parsed.r; xLocal = parsed.x; }
    }
    if(rLocal==='') return; if(xLocal==='') return;
    const z: Complex = { r: parseNumber(rLocal)/Z0, i: parseNumber(xLocal)/Z0 };
    const gamma = isAdmittance? zToGamma(cInv(z)) : zToGamma(z);
    const newPt: PointData = { z, gamma, note: 'Load' };
    setPoints(ps=>[...ps, newPt]);
    setActiveIndex(points.length);
    setTimeout(()=>{ computeLMatch(newPt); draw(); },0);
  }

  // Parse complex impedance string (limited supported formats):
  //  R+jX , R-jX , jX , -jX , R (pure real) where R,X are floats
  function parseZL(s: string): { r:number, x:number } | null {
    let str = s.replace(/−/g,'-').toLowerCase().replace(/\s+/g,'');
    if(str === '') return null;
    // pure imaginary like j10 or -j5
    if(/^[-+]?j[0-9]*\.?[0-9]+$/i.test(str)){
      const sign = str[0] === '-' ? -1 : 1;
      const numPart = str.replace(/^[-+]?j/,'');
      const x = parseFloat(numPart) * sign;
      if(isNaN(x)) return null; return { r:0, x };
    }
    // pure real
    if(/^[-+]?[0-9]*\.?[0-9]+$/.test(str)){
      const r = parseFloat(str); if(isNaN(r)) return null; return { r, x:0 };
    }
    // general R±jX
    const match = str.match(/^([-+]?[0-9]*\.?[0-9]+)([-+])j([0-9]*\.?[0-9]+)$/);
    if(match){
      const r = parseFloat(match[1]); const sign = match[2] === '-' ? -1 : 1; const x = parseFloat(match[3]) * sign;
      if(isNaN(r)||isNaN(x)) return null; return { r, x };
    }
    return null;
  }

  function handleZLChange(v: string){
    setZlString(v);
    const parsed = parseZL(v);
    if(parsed){
      setR(parsed.r);
      setX(parsed.x);
      setZlValid(true);
    } else {
      setZlValid(false);
    }
  }

  function handleCanvasClick(e: React.MouseEvent){
    const canvas = canvasRef.current; if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = canvas.clientWidth; const radius = size/2 - 8;
    const x = e.clientX - rect.left - size/2; const y = e.clientY - rect.top - size/2;
    const gamma: Complex = { r: x / radius, i: -y / radius };
    if(cMag(gamma) >= 1) return; // outside chart
    const z = gammaToZ(gamma);
    const newPt: PointData = { z, gamma, note: 'Click' };
    setPoints(ps=>[...ps, newPt]);
    setActiveIndex(points.length);
    setTimeout(()=>{ computeLMatch(newPt); draw(); },0);
  }

  // Transmission line distance change triggers redraw
  function onDistanceChange(v: string){
    const n = parseFloat(v); if(!isNaN(n)) setDistance(n); else setDistance(0);
  }

  function currentActiveData(){ if(activeIndex==null) return null; return points[activeIndex]; }

  function computeDerived(pt: PointData){
    const z = pt.z;
    const y = cInv(z);
    const gamma = pt.gamma;
    const mag = cMag(gamma);
    const ang = cAngDeg(gamma);
    const swr = (1+mag)/(1-mag);
    const rl = -20*Math.log10(mag);
    const Z = { r: z.r*Z0, i: z.i*Z0 };
    const yNorm = y;
    return { z, y: yNorm, Z, gamma, mag, ang, swr, rl };
  }

  function formatComplex(c: Complex, digits=3){
    return `${c.r.toFixed(digits)} ${c.i>=0?'+':'-'} j${Math.abs(c.i).toFixed(digits)}`;
  }

  // L-section matching (simplified): first cancel load reactance, then match resistive part
  function computeLMatch(pt: PointData){
    const f = freqMHz * 1e6;
    const z = pt.z; // normalized
    const r = z.r; const x = z.i;
    if(r<=0){ setMatchData(null); return; }
    const cancelSeries = -x; // series reactance (normalized) to cancel
    const rPure = r; // after cancellation
    // Resistive matching formulas
    const solutions:any = {};
    function reactanceToLC(Xnorm: number){
      const X = Xnorm * Z0; // ohms
      if(X>0){ // inductive
        const L = X / (2*Math.PI*f); return { type:'L', value: L*1e9, units:'nH', X: X };
      } else { // capacitive
        const C = 1 / (2*Math.PI*f*Math.abs(X)); return { type:'C', value: C*1e12, units:'pF', X: X };
      }
    }
    if(rPure === 1){ // already matched after cancellation
      solutions['A'] = { note:'Already matched', components:[], intermediateGamma: zToGamma({r, i: x+cancelSeries}) };
    } else if(rPure < 1){ // step-up
      const Q = Math.sqrt(1/rPure -1);
      const Xs = Q; // series normalized reactance (second step) magnitude
      const Xp = rPure / Q; // shunt normalized reactance magnitude
      // Solution A: series cancel -> shunt -> series
      const gammaIntermediate = zToGamma({ r: rPure, i: 0 });
      solutions['A'] = {
        note:'Series cancel X, then shunt, then series',
        components:[
          { stage:'Series Cancel', ...reactanceToLC(cancelSeries) },
          { stage:'Shunt', ...reactanceToLC(Xp>0? -1/Xp : 1/(-Xp)) , comment:'Approx via susceptance' },
          { stage:'Series', ...reactanceToLC(Xs) }
        ],
        intermediateGamma: gammaIntermediate
      };
      // Solution B (alternate ordering simplified)
      solutions['B'] = {
        note:'Alternate topology (approx)',
        components:[
          { stage:'Shunt first (approx)', ...reactanceToLC(Xp) },
          { stage:'Series composite', ...reactanceToLC(cancelSeries + Xs) }
        ],
        intermediateGamma: gammaIntermediate
      };
    } else { // rPure >1 step-down
      const Q = Math.sqrt(rPure -1);
      const Xs = Q/rPure;
      const Xp = Q;
      const gammaIntermediate = zToGamma({ r: rPure, i:0 });
      solutions['A'] = {
        note:'Series cancel, shunt, series',
        components:[
          { stage:'Series Cancel', ...reactanceToLC(cancelSeries) },
          { stage:'Shunt', ...reactanceToLC(Xp>0? -1/Xp : 1/(-Xp)), comment:'Approx via susceptance' },
          { stage:'Series', ...reactanceToLC(Xs) }
        ],
        intermediateGamma: gammaIntermediate
      };
      solutions['B'] = {
        note:'Alternate',
        components:[
          { stage:'Shunt first (approx)', ...reactanceToLC(Xp) },
            { stage:'Series composite', ...reactanceToLC(cancelSeries + Xs) }
        ],
        intermediateGamma: gammaIntermediate
      };
    }
    setMatchData(solutions);
    if(!lMatchSolution) setLMatchSolution('A');
  }

  const active = currentActiveData();
  const derived = active? computeDerived(active): null;

  return (
    <div className="min-h-screen w-full bg-neutral-900 text-neutral-100 flex flex-col">
      <header className="p-4 border-b border-neutral-700 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <h1 className="text-xl font-bold tracking-wide">Smith Chart RF Toolkit</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex items-center gap-1 text-sm cursor-pointer select-none">
            <input type="checkbox" className="accent-emerald-400" checked={isAdmittance} onChange={e=>setIsAdmittance(e.target.checked)} />
            <span className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition">Admittance View</span>
          </label>
          <button onClick={()=>{ setPoints([]); setActiveIndex(null); setMatchData(null); }} className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-sm">Clear</button>
        </div>
      </header>
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <section className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex flex-col gap-3 bg-neutral-850/40 rounded-lg border border-neutral-700 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <label className="flex flex-col gap-1">Z₀ (Ω)
                <input value={z0Raw}
                  onChange={e=>{ setZ0Raw(e.target.value); if(z0InputError) setZ0InputError(null); }}
                  onBlur={()=>{
                    const raw = z0Raw.trim();
                    if(raw===''){ setZ0InputError('Required'); return; }
                    const val = parseFloat(raw);
                    if(isNaN(val)){ setZ0InputError('Invalid'); return; }
                    if(val<=0){ setZ0InputError('> 0 required'); return; }
                    setZ0(val); setZ0InputError(null); setZ0Raw(String(val));
                  }}
                  inputMode="decimal"
                  className={`bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40 ${z0InputError? 'border border-red-500':'border border-transparent'}`} />
                {z0InputError && <span className="text-[10px] text-red-400">{z0InputError}</span>}
              </label>
              <label className="flex flex-col gap-1">ZL (Ω)
                <input value={zlString} onChange={e=>handleZLChange(e.target.value)} placeholder="e.g. 50+j25" className={`bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40 ${zlValid? 'border border-transparent':'border border-red-500'}`} />
                <span className="text-[10px] text-neutral-400">Formats: R+jX, R-jX, jX, R</span>
              </label>
              <label className="flex flex-col gap-1">R (Ω)
                <input value={R} onChange={e=>{ const val = e.target.value===''? '' : parseNumber(e.target.value); setR(val as any); if(val!=='' && X!=='') setZlString(`${val}${(X as number)>=0?'+':'-'}j${Math.abs(X as number)}`); }} type="number" className="bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40" />
              </label>
              <label className="flex flex-col gap-1">X (Ω)
                <input value={X} onChange={e=>{ const val = e.target.value===''? '' : parseNumber(e.target.value); setX(val as any); if(R!=='' && val!=='') setZlString(`${R}${(val as number)>=0?'+':'-'}j${Math.abs(val as number)}`); }} type="number" className="bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40" />
              </label>
              <label className="flex flex-col gap-1">Freq (MHz)
                <input value={freqRaw}
                  onChange={e=>{ setFreqRaw(e.target.value); if(freqInputError) setFreqInputError(null); }}
                  onBlur={()=>{
                    const raw = freqRaw.trim();
                    if(raw===''){ setFreqInputError('Required'); return; }
                    const val = parseFloat(raw);
                    if(isNaN(val) || val<0){ setFreqInputError('≥ 0'); return; }
                    setFreqMHz(val); setFreqInputError(null); setFreqRaw(String(val));
                  }}
                  inputMode="decimal"
                  className={`bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40 ${freqInputError? 'border border-red-500':'border border-transparent'}`} />
                {freqInputError && <span className="text-[10px] text-red-400">{freqInputError}</span>}
              </label>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <button onClick={addPointFromInputs} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold shadow">Plot</button>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1">Dist (λ)
                  <input value={distance} onChange={e=>onDistanceChange(e.target.value)} type="number" step="0.01" className="w-24 bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40" />
                </label>
                <select value={towards} onChange={e=>setTowards(e.target.value as any)} className="bg-neutral-800 rounded px-2 py-1 focus:outline-none focus:ring ring-emerald-500/40">
                  <option value="generator">Toward Generator</option>
                  <option value="load">Toward Load</option>
                </select>
              </div>
            </div>
          </div>
          <div className="relative mx-auto w-full flex flex-col items-center" onClick={handleCanvasClick}>
            <div className="flex items-center gap-2 mb-2 self-end text-xs opacity-80">
              <label className="flex items-center gap-1">Max Size
                <input type="range" min={400} max={900} value={chartMax} onChange={e=>setChartMax(parseInt(e.target.value))} className="accent-emerald-500" />
              </label>
              <span>{chartMax}px</span>
            </div>
            <canvas ref={canvasRef} className="cursor-crosshair rounded-lg bg-neutral-950 shadow-inner shadow-black/60 border border-neutral-700" />
            <div className="absolute top-2 left-2 text-xs text-neutral-400 bg-neutral-800/60 px-2 py-1 rounded pointer-events-none">Click to add point</div>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Notes: Rotation along a transmission line is visualized by moving the reflection coefficient around its constant |Γ| circle. Angle change (deg) = ± 720 * distance(λ). L-match values are approximate when load has reactance; implementation first neutralizes load reactance.
          </p>
        </section>
        <aside className="w-full lg:w-[420px] flex flex-col border-t lg:border-t-0 lg:border-l border-neutral-700 bg-neutral-900/60 max-h-[60vh] lg:max-h-none overflow-y-auto p-4 gap-4">
          <div className="space-y-2">
            <h2 className="font-semibold text-lg">Data</h2>
            {derived ? (
              <ul className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <li className="col-span-2 font-medium text-emerald-400">Active Point</li>
                <li>z:</li><li>{formatComplex(derived.z)}</li>
                <li>y:</li><li>{formatComplex(derived.y)}</li>
                <li>Z (Ω):</li><li>{formatComplex(derived.Z)}</li>
                <li>|Γ|:</li><li>{derived.mag.toFixed(4)}</li>
                <li>∠Γ (°):</li><li>{derived.ang.toFixed(2)}</li>
                <li>SWR:</li><li>{derived.swr.toFixed(3)}</li>
                <li>Return Loss (dB):</li><li>{derived.rl.toFixed(2)}</li>
              </ul>
            ): <p className="text-sm text-neutral-400">Plot or click a point to see parameters.</p>}
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold text-lg">Points</h2>
            <div className="flex flex-col gap-1 text-sm">
              {points.map((p,i)=>(
                <button key={i} onClick={()=>{ setActiveIndex(i); computeLMatch(p); }} className={`flex justify-between items-center px-2 py-1 rounded border text-left ${i===activeIndex? 'bg-emerald-600/30 border-emerald-500':'bg-neutral-800 border-neutral-700 hover:border-neutral-500'}`}> 
                  <span>{i+1}. {p.note}</span>
                  <span className="font-mono">Γ=({p.gamma.r.toFixed(2)},{p.gamma.i.toFixed(2)})</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">L-Section Matching</h2>
            {activeIndex==null && <p className="text-sm text-neutral-400">Select a point to compute match.</p>}
            {matchData && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  {['A','B'].map(id=> matchData[id] && (
                    <button key={id} onClick={()=>{ setLMatchSolution(id as any); draw(); }} className={`px-3 py-1 rounded text-sm ${lMatchSolution===id? 'bg-emerald-600':'bg-neutral-800 hover:bg-neutral-700'}`}>Solution {id}</button>
                  ))}
                </div>
                {lMatchSolution && matchData[lMatchSolution] && (
                  <div className="text-sm space-y-2">
                    <div className="text-emerald-300 font-medium">{matchData[lMatchSolution].note}</div>
                    <table className="w-full text-xs border border-neutral-700 rounded overflow-hidden">
                      <thead className="bg-neutral-800 text-neutral-300">
                        <tr>
                          <th className="p-1 text-left">Stage</th>
                          <th className="p-1 text-left">Type</th>
                          <th className="p-1 text-right">Value</th>
                          <th className="p-1 text-left">Units</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchData[lMatchSolution].components.map((c:any, idx:number)=>(
                          <tr key={idx} className="odd:bg-neutral-900 even:bg-neutral-850/30">
                            <td className="p-1">{c.stage}</td>
                            <td className="p-1">{c.type||'-'}</td>
                            <td className="p-1 text-right">{c.value? c.value.toFixed(2):'-'}</td>
                            <td className="p-1">{c.units||''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-neutral-500">Component values approximate; sign & topology selection not exhaustive.</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <footer className="mt-auto pt-4 text-xs text-neutral-600">© {new Date().getFullYear()} RF Smith Chart Toolkit – Single-file demo.</footer>
        </aside>
      </main>
    </div>
  );
}

