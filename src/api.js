import {createElement} from 'react';
export const api=async(p,o={})=>{const r=await fetch('/api'+p,{...o,headers:{'content-type':'application/json'},body:o.body&&JSON.stringify(o.body)});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j};
export const link=(url,s)=>url+(url.includes('?')?'&':'?')+'t='+s+'s';
export const mmss=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
export const parse=v=>{const m=/^(\d+):([0-5]?\d)$/.exec(v.trim());return m?+m[1]*60+ +m[2]:null};
export const Replay=({url,secs,label})=>createElement('a',{href:link(url,secs),target:'_blank',rel:'noopener'},label);
