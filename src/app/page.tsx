"use client";

import { useEffect, useRef, useState } from "react";
import { Complex, cInv, zToGamma, gammaToZ, cMag, cAngDeg, formatComplex } from "../lib/complex";
import { computeLMatchSolutions } from "../lib/matching";
import { SmithChartCanvas } from "../components/chart/SmithChartCanvas";

// Single-file interactive Smith Chart Tool
// NOTE: This implementation focuses on core RF engineering utilities using only Canvas + Tailwind + plain JS.

interface PointData {
  z: Complex; // normalized impedance
  gamma: Complex; // reflection coefficient
  note?: string;
}

// Complex math & chart drawing moved to lib/ and components/

export default function SmithChartApp() {
  const chartContainerRef = useRef<HTMLDivElement|null>(null);
  const [isAdmittance, setIsAdmittance] = useState(false);
  const [Z0, setZ0] = useState(50);
  const [z0Raw, setZ0Raw] = useState('50');
  const [R, setR] = useState<number|''>(75);
  const [X, setX] = useState<number|''>(10);
  const [zlString, setZlString] = useState('75+j10');
  const [zlValid, setZlValid] = useState(true);
  const [freqMHz, setFreqMHz] = useState(1000);
  const [freqRaw, setFreqRaw] = useState('1000');
  const [z0InputError, setZ0InputError] = useState<string|null>(null);
  const [freqInputError, setFreqInputError] = useState<string|null>(null);
  const [points, setPoints] = useState<PointData[]>([]);
  const [activeIndex, setActiveIndex] = useState<number|null>(null);
  const [distance, setDistance] = useState(0);
  const [towards, setTowards] = useState<'generator'|'load'>('generator');
  const [lMatchSolution, setLMatchSolution] = useState<'A'|'B'|null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [chartMax, setChartMax] = useState(820);

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
  setTimeout(()=>{ computeLMatch(newPt); },0);
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
    const container = chartContainerRef.current; if(!container) return;
    const canvas = container.querySelector('canvas'); if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = canvas.clientWidth; const radius = size/2 - 8;
    const x = e.clientX - rect.left - size/2; const y = e.clientY - rect.top - size/2;
    const gamma: Complex = { r: x / radius, i: -y / radius };
    if(cMag(gamma) >= 1) return; // outside chart
    const z = gammaToZ(gamma);
    const newPt: PointData = { z, gamma, note: 'Click' };
    setPoints(ps=>[...ps, newPt]);
    setActiveIndex(points.length);
    setTimeout(()=>{ computeLMatch(newPt); },0);
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
    const solutions = computeLMatchSolutions(pt.z, Z0, freqMHz*1e6);
    setMatchData(solutions);
    if(solutions && !lMatchSolution) setLMatchSolution('A');
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
          <div className="relative mx-auto w-full flex flex-col items-center" ref={chartContainerRef} onClick={handleCanvasClick}>
            <div className="flex items-center gap-2 mb-2 self-end text-xs opacity-80">
              <label className="flex items-center gap-1">Max Size
                <input type="range" min={400} max={900} value={chartMax} onChange={e=>setChartMax(parseInt(e.target.value))} className="accent-emerald-500" />
              </label>
              <span>{chartMax}px</span>
            </div>
            <SmithChartCanvas points={points} activeIndex={activeIndex} distance={distance} towards={towards} lMatchPath={lMatchSolution && matchData? matchData[lMatchSolution]: null} isAdmittance={isAdmittance} maxSize={chartMax} />
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
                    <button key={id} onClick={()=>{ setLMatchSolution(id as any); }} className={`px-3 py-1 rounded text-sm ${lMatchSolution===id? 'bg-emerald-600':'bg-neutral-800 hover:bg-neutral-700'}`}>Solution {id}</button>
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

