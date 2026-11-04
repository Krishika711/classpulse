import express from 'express';import Database from 'better-sqlite3';
import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';
const db=new Database(process.env.DB_FILE||'classpulse.db');
db.exec(`create table if not exists classes(code text primary key,topic text,level text,url text,pack text,token text,created int);
create table if not exists answers(code text,sid text,name text,qid text,opt text,attempt int,mis text,ok int,ts int,primary key(code,sid,qid,attempt));`);
const MODEL=process.env.GEMINI_MODEL||'gemini-3.8-flash';
const app=express();app.use(express.json({limit:'20kb'}));
const clamp=(s,n)=>String(s??'').trim().slice(0,n);
const MODELS=[...new Set([MODEL,...(process.env.GEMINI_FALLBACKS||'gemini-flash-latest,gemini-3.7-flash,gemini-3.5-flash').split(',')])].filter(Boolean);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ask=async(p,max=8192,json=false)=>{let last;
 for(const m of MODELS)for(let a=0;a<2;a++){
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,{method:'POST',
   headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY||''},
   body:JSON.stringify({contents:[{role:'user',parts:[{text:p}]}],generationConfig:{maxOutputTokens:max,...(json&&{responseMimeType:'application/json'})}})});
  const j=await r.json().catch(()=>({}));
  if(r.ok){const t=(j.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('');if(t)return t;last=new Error('Empty response from '+m);break}
  last=new Error(`Gemini API (${m}): `+(j.error?.message||r.status));console.error('GEMINI FAIL:',last.message);
  if([503,429].includes(r.status)&&a===0){await sleep(1500);continue}
  break}
 throw last};
const PROMPT=(t,l,n)=>`Create a misconception-diagnostic quiz for a lecture on "${t}" for ${l} students. Return ONLY JSON: {"questions":[${n} items: {"id":"q1".., "text","hint","explain","opts":[4 items {"k":"a".."d","t","mis"}]}],"mis":[3-4 items {"id":"m1".., "name","why","hint","ask","counter","explain","follow","section":0-4}],"sections":[5 items {"title","summary"}],"key":[4 one-line must-know facts]}. Exactly one option per question has mis:null (the correct one); every wrong option's mis is an id from "mis". Hints must not reveal the answer. Vary the correct option's position.`;
function valid(p,n){try{const ids=new Set(p.mis.map(m=>m.id));return p.questions.length===n&&p.sections.length===5&&p.questions.every(q=>q.opts.length===4&&q.opts.filter(o=>!o.mis).length===1&&q.opts.every(o=>!o.mis||ids.has(o.mis)))}catch{return false}}
async function generate(t,l,n){for(let k=0;k<2;k++){try{const s=await ask(PROMPT(t,l,n),8192,true);console.error("RAW:",s.slice(0,1500));console.error("RAW:",s.slice(0,1500));const p=JSON.parse(s.slice(s.indexOf('{'),s.lastIndexOf('}')+1));console.error("PARSED:",Object.keys(p),p.questions?.length,p.sections?.length);if(valid(p,n)){p.sections.forEach((x,i)=>x.secs=45+i*300);return p}}catch(e){console.error("GEMINI FAIL:",e.message)}}throw new Error('Could not generate a valid check. Try again.')}
const cls=(req,res,own)=>{const c=db.prepare('select * from classes where code=?').get(req.params.code);
 if(!c){res.status(404).json({error:'Class not found'});return}
 if(own&&req.query.token!==c.token){res.status(403).json({error:'Teacher token required'});return}return c};
function pulse(c){const pack=JSON.parse(c.pack),rows=db.prepare('select * from answers where code=?').all(c.code),mc={};
 const questions=pack.questions.map(q=>{const f=rows.filter(r=>r.qid===q.id&&r.attempt===1);f.forEach(r=>{if(r.mis)(mc[r.mis]??=new Set).add(r.sid)});const right=f.filter(r=>r.ok).length;return{id:q.id,text:q.text,right,wrong:f.length-right}});
 const misconceptions=Object.entries(mc).map(([id,s])=>{const m=pack.mis.find(m=>m.id===id);return{id,count:s.size,name:m.name,why:m.why,plan:{ask:m.ask,counter:m.counter,explain:m.explain,follow:m.follow},section:pack.sections[m.section]}}).sort((a,b)=>b.count-a.count);
 return{topic:c.topic,responded:new Set(rows.map(r=>r.sid)).size,questions,misconceptions,fixed:rows.filter(r=>r.attempt===2&&r.ok).length,stuck:new Set(rows.filter(r=>r.attempt===2&&!r.ok).map(r=>r.sid)).size}}
const subs=new Map();
const push=c=>{const d=`data: ${JSON.stringify(pulse(c))}\n\n`;subs.get(c.code)?.forEach(r=>r.write(d))};

app.post('/api/classes',async(req,res)=>{const topic=clamp(req.body.topic,120),level=clamp(req.body.level,60)||'undergraduate',n=Math.min(5,Math.max(1,+req.body.n||3)),url=clamp(req.body.url,300)||'https://www.youtube.com/';
 if(!topic)return res.status(400).json({error:'Enter a topic'});if(!/^https?:\/\//.test(url))return res.status(400).json({error:'Lecture link must start with http(s)://'});
 const pack=await generate(topic,level,n);let code;do code=String(1000+crypto.randomInt(9000));while(db.prepare('select 1 from classes where code=?').get(code));
 const token=crypto.randomBytes(16).toString('hex');
 db.prepare('insert into classes values(?,?,?,?,?,?,?)').run(code,topic,level,url,JSON.stringify(pack),token,Date.now());
 res.json({code,token,topic,url,pack})});
app.get('/api/classes/:code',(req,res)=>{const c=cls(req,res);if(!c)return;const p=JSON.parse(c.pack);
 res.json({topic:c.topic,level:c.level,url:c.url,key:p.key,sections:p.sections,mistakes:p.mis.map(m=>({name:m.name,why:m.why})),questions:p.questions.map(q=>({id:q.id,text:q.text,opts:q.opts.map(o=>({k:o.k,t:o.t}))}))})});
app.patch('/api/classes/:code',(req,res)=>{const c=cls(req,res,1);if(!c)return;const p=JSON.parse(c.pack),s=req.body.secs;
 if(!Array.isArray(s)||s.length!==5||s.some(x=>!Number.isInteger(x)||x<0||x>86400))return res.status(400).json({error:'Need 5 timestamps'});
 p.sections.forEach((x,i)=>x.secs=s[i]);db.prepare('update classes set pack=? where code=?').run(JSON.stringify(p),c.code);res.json({ok:true})});
app.post('/api/classes/:code/answer',(req,res)=>{const c=cls(req,res);if(!c)return;const {sid,name,qid,opt,attempt}=req.body,p=JSON.parse(c.pack);
 const q=p.questions.find(q=>q.id===qid),o=q?.opts.find(o=>o.k===opt);
 if(!o||![1,2].includes(attempt)||!sid)return res.status(400).json({error:'Bad answer'});
 const ok=o.mis?0:1;
 try{db.prepare('insert into answers values(?,?,?,?,?,?,?,?,?)').run(c.code,clamp(sid,60),clamp(name,30),qid,opt,attempt,o.mis||null,ok,Date.now())}catch{return res.status(409).json({error:'Already answered'})}
 push(c);const m=o.mis&&p.mis.find(m=>m.id===o.mis),fin=ok||attempt===2;
 res.json({ok:!!ok,hint:!ok&&attempt===1?m.hint:null,explain:fin?q.explain:null,correct:fin?q.opts.find(x=>!x.mis).k:null,section:m?{title:p.sections[m.section].title,secs:p.sections[m.section].secs}:null})});
app.post('/api/classes/:code/tutor',async(req,res)=>{const c=cls(req,res);if(!c)return;const p=JSON.parse(c.pack),q=p.questions.find(q=>q.id===req.body.qid);
 const reply=await ask(`You are a Socratic tutor for ${c.level} students studying ${c.topic}. The live question is: "${q?.text}". Never reveal or hint which option is correct. Reply in under 50 words with one guiding question, in the student's language (English or Hinglish). Student: ${clamp(req.body.message,300)}`,1024);
 res.json({reply})});
app.get('/api/classes/:code/pulse',(req,res)=>{const c=cls(req,res,1);if(c)res.json(pulse(c))});
app.get('/api/classes/:code/stream',(req,res)=>{const c=cls(req,res,1);if(!c)return;
 res.set({'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'});res.flushHeaders();
 if(!subs.has(c.code))subs.set(c.code,new Set());subs.get(c.code).add(res);res.write(`data: ${JSON.stringify(pulse(c))}\n\n`);
 req.on('close',()=>subs.get(c.code)?.delete(res))});
app.use('/api',(e,req,res,next)=>{console.error(e);res.status(500).json({error:String(e.message).slice(0,300)})});
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'../dist');
app.use(express.static(dist));app.get('/{*any}',(req,res)=>res.sendFile(path.join(dist,'index.html')));
app.listen(process.env.PORT||3001,()=>console.log('ClassPulse on :'+(process.env.PORT||3001)));
