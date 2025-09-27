"use client";
import { useEffect, useRef } from 'react';
import { Complex, cMag, zToGamma, rotateGamma } from '../../lib/complex';

export interface ChartPoint { gamma: Complex; active?: boolean; }

interface SmithChartCanvasProps {
  points: { gamma: Complex }[];
  activeIndex: number | null;
  distance: number;
  towards: 'generator'|'load';
  lMatchPath?: { intermediateGamma?: Complex } | null;
  isAdmittance: boolean;
  maxSize: number;
}

export function SmithChartCanvas({ points, activeIndex, distance, towards, lMatchPath, isAdmittance, maxSize }: SmithChartCanvasProps){
  const canvasRef = useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{ draw(); }, [points, activeIndex, distance, towards, lMatchPath, isAdmittance, maxSize]);

  function draw(){
    const canvas = canvasRef.current; if(!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement!;
    const size = Math.min(parent.clientWidth, maxSize);
    canvas.width = size*dpr; canvas.height = size*dpr;
    canvas.style.width = size+'px'; canvas.style.height = size+'px';
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,size,size);
    ctx.save();
    const radius = size/2 - 8;
    ctx.translate(size/2, size/2);

    // Outer circle
    ctx.strokeStyle = '#555';
    ctx.beginPath(); ctx.arc(0,0,radius,0,Math.PI*2); ctx.stroke();

    // Resistance circles
    const rVals = [0,0.2,0.5,1,2,5];
    ctx.font = '11px system-ui';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    rVals.forEach(r=>{
      if(r===0){
        ctx.fillStyle='#aaa'; ctx.fillText(isAdmittance? 'g=0':'r=0', -radius+6, -12);
      } else {
        const centerGamma = r/(r+1); const rad = 1/(r+1);
        ctx.beginPath(); ctx.strokeStyle='#555'; ctx.arc(centerGamma*radius,0,rad*radius,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle='#aaa'; ctx.fillText((isAdmittance?'g=':'r=')+r,(centerGamma+rad)*radius+4,0);
      }
    });

    // Reactance arcs
    const xVals=[0.2,0.5,1,2,5];
    ctx.strokeStyle='#555';
    xVals.forEach(x=>[x,-x].forEach(val=>{
      ctx.beginPath(); let first=true;
      for(let r=0; r<=200; r+=(r<5?0.05: r<20?0.2:1)){
        const z={r, i:val}; const g=zToGamma(z); const mag=cMag(g); if(mag>1+1e-3) break;
        const px=g.r*radius, py=-g.i*radius; if(first){ ctx.moveTo(px,py); first=false;} else ctx.lineTo(px,py);
      }
      ctx.stroke();
      const gMid = zToGamma({ r:1, i:val });
      ctx.fillStyle='#888'; ctx.textAlign='center';
      ctx.fillText(isAdmittance? (val>0?`-b=${Math.abs(val)}`:`+b=${Math.abs(val)}`): (val>0?`+j${val}`:`-j${Math.abs(val)}`), gMid.r*radius, -gMid.i*radius + (val>0? -10:10));
      ctx.textAlign='left';
    }));

    // Axis
    ctx.strokeStyle='#666'; ctx.beginPath(); ctx.moveTo(-radius,0); ctx.lineTo(radius,0); ctx.stroke();

    // Points & SWR
    points.forEach((p,i)=>{
      const g=p.gamma; const px=g.r*radius, py=-g.i*radius;
      if(i===activeIndex){ const mag=cMag(g); ctx.strokeStyle='rgba(255,80,80,0.6)'; ctx.beginPath(); ctx.arc(0,0,mag*radius,0,Math.PI*2); ctx.stroke(); }
      ctx.fillStyle=i===activeIndex? '#ffcd4d':'#4dabff'; ctx.beginPath(); ctx.arc(px,py,5,0,Math.PI*2); ctx.fill();
    });

    // Transmission line movement
    if(activeIndex!=null){
      const g0=points[activeIndex].gamma; const angleChange=(towards==='generator'? -1:1)*distance*720; const g1=rotateGamma(g0, angleChange); const mag=cMag(g0);
      const a0=Math.atan2(-g0.i,g0.r); const a1=Math.atan2(-g1.i,g1.r);
      ctx.beginPath(); ctx.strokeStyle='#ff5555'; ctx.arc(0,0, mag*radius, a0,a1,(towards==='generator')); ctx.stroke();
      ctx.fillStyle='#ff4444'; ctx.beginPath(); ctx.arc(g1.r*radius, -g1.i*radius,5,0,Math.PI*2); ctx.fill();
    }

    // L-match path
    if(activeIndex!=null && lMatchPath && lMatchPath.intermediateGamma){
      const p=points[activeIndex]; const mid=lMatchPath.intermediateGamma;
      ctx.strokeStyle='#6ee7b7'; ctx.beginPath(); ctx.moveTo(p.gamma.r*radius,-p.gamma.i*radius); ctx.lineTo(mid.r*radius,-mid.i*radius); ctx.lineTo(0,0); ctx.stroke();
    }

    ctx.restore();
  }

  return <canvas ref={canvasRef} className="cursor-crosshair rounded-lg bg-neutral-950 shadow-inner shadow-black/60 border border-neutral-700"/>;
}
