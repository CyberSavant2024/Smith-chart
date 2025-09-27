// Complex number utility functions used across the Smith Chart toolkit.
export interface Complex { r: number; i: number }
export const C = (r:number,i:number):Complex=>({r,i});
export function cAdd(a:Complex,b:Complex):Complex{ return { r:a.r+b.r, i:a.i+b.i }; }
export function cSub(a:Complex,b:Complex):Complex{ return { r:a.r-b.r, i:a.i-b.i }; }
export function cMul(a:Complex,b:Complex):Complex{ return { r:a.r*b.r - a.i*b.i, i:a.r*b.i + a.i*b.r }; }
export function cDiv(a:Complex,b:Complex):Complex{ const d=b.r*b.r + b.i*b.i; return { r:(a.r*b.r + a.i*b.i)/d, i:(a.i*b.r - a.r*b.i)/d }; }
export function cInv(a:Complex):Complex{ const d=a.r*a.r + a.i*a.i; return { r:a.r/d, i:-a.i/d }; }
export function cMag(a:Complex):number{ return Math.hypot(a.r,a.i); }
export function cAngDeg(a:Complex):number{ return (Math.atan2(a.i,a.r)*180/Math.PI + 360)%360; }
export function zToGamma(z:Complex):Complex{ return cDiv(cSub(z,{r:1,i:0}), cAdd(z,{r:1,i:0})); }
export function gammaToZ(g:Complex):Complex{ return cDiv(cAdd({r:1,i:0},g), cSub({r:1,i:0},g)); }
export function rotateGamma(g:Complex, deg:number):Complex{ const rad=deg*Math.PI/180; const c=Math.cos(rad), s=Math.sin(rad); return { r:g.r*c - g.i*s, i:g.r*s + g.i*c }; }
export function formatComplex(c:Complex,digits=3){ return `${c.r.toFixed(digits)} ${c.i>=0?'+':'-'} j${Math.abs(c.i).toFixed(digits)}`; }
