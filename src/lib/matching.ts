import { Complex, cInv, zToGamma } from './complex';

export interface LMatchComponent { stage:string; type?:'L'|'C'; value?:number; units?:string; comment?:string; }
export interface LMatchSolution { note:string; components:LMatchComponent[]; intermediateGamma?:Complex; }

export function computeLMatchSolutions(z: Complex, Z0:number, freqHz:number){
  const r = z.r; const x = z.i;
  if(r<=0){ return null; }
  const cancelSeries = -x; // cancel load reactance first
  const rPure = r;
  const solutions: Record<string, LMatchSolution> = {};

  function reactanceToLC(Xnorm:number): Omit<LMatchComponent,'stage'> {
    const X = Xnorm * Z0;
    if(X===0) return { type:undefined };
    if(X>0){ const L = X/(2*Math.PI*freqHz); return { type:'L', value:L*1e9, units:'nH' }; }
    const C = 1/(2*Math.PI*freqHz*Math.abs(X)); return { type:'C', value:C*1e12, units:'pF' };
  }

  if(rPure === 1){
    solutions['A'] = { note:'Already matched after reactance cancel', components:[], intermediateGamma: zToGamma({r, i:x+cancelSeries}) };
    return solutions;
  }

  if(rPure < 1){
    const Q = Math.sqrt(1/rPure - 1);
    const Xs = Q;
    const Xp = rPure / Q;
    const gammaIntermediate = zToGamma({ r:rPure, i:0 });
    solutions['A'] = {
      note:'Series cancel → Shunt susceptance → Series tune',
      components:[
        { stage:'Series Cancel', ...(reactanceToLC(cancelSeries)) },
        { stage:'Shunt (approx)', ...(reactanceToLC(Xp>0? -1/Xp : 1/(-Xp))), comment:'Approx via susceptance' },
        { stage:'Series', ...(reactanceToLC(Xs)) }
      ],
      intermediateGamma: gammaIntermediate
    };
    solutions['B'] = {
      note:'Alternate ordering (approx)',
      components:[
        { stage:'Shunt first', ...(reactanceToLC(Xp)) },
        { stage:'Series composite', ...(reactanceToLC(cancelSeries + Xs)) }
      ],
      intermediateGamma: gammaIntermediate
    };
  } else { // rPure > 1
    const Q = Math.sqrt(rPure - 1);
    const Xs = Q/rPure;
    const Xp = Q;
    const gammaIntermediate = zToGamma({ r:rPure, i:0 });
    solutions['A'] = {
      note:'Series cancel → Shunt → Series (step-down)',
      components:[
        { stage:'Series Cancel', ...(reactanceToLC(cancelSeries)) },
        { stage:'Shunt (approx)', ...(reactanceToLC(Xp>0? -1/Xp : 1/(-Xp))), comment:'Approx via susceptance' },
        { stage:'Series', ...(reactanceToLC(Xs)) }
      ],
      intermediateGamma: gammaIntermediate
    };
    solutions['B'] = {
      note:'Alternate (step-down)',
      components:[
        { stage:'Shunt first', ...(reactanceToLC(Xp)) },
        { stage:'Series composite', ...(reactanceToLC(cancelSeries + Xs)) }
      ],
      intermediateGamma: gammaIntermediate
    };
  }
  return solutions;
}
