import {useState,useEffect} from 'react';import {api,mmss,parse,Replay} from './api.js';
const store={get:c=>localStorage.getItem('cp:'+c),set:(c,t)=>localStorage.setItem('cp:'+c,t)};
export default function App(){
 const [h,setH]=useState(location.hash);useEffect(()=>{const f=()=>setH(location.hash);addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[]);
 const [,v,code]=h.split('/');
 return <><header><span className="brand">ClassPulse</span></header><main>
  {v==='join'?<Student code={code}/>:v==='pulse'?<Pulse code={code}/>:<Create/>}</main></>}

function Create(){
 const [f,setF]=useState({topic:'',level:'2nd-year CSE',n:3,url:''}),[busy,setBusy]=useState(false),[err,setErr]=useState(),[c,setC]=useState(),[times,setT]=useState([]);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 async function go(e){e.preventDefault();setBusy(true);setErr();try{const r=await api('/classes',{method:'POST',body:{...f,n:+f.n}});store.set(r.code,r.token);setC(r);setT(r.pack.sections.map(s=>mmss(s.secs)))}catch(x){setErr(x.message)}setBusy(false)}
 async function saveTimes(){const s=times.map(parse);if(s.includes(null))return setErr('Use mm:ss for every timestamp');
  try{await api(`/classes/${c.code}?token=${store.get(c.code)}`,{method:'PATCH',body:{secs:s}});setErr();alert('Saved')}catch(x){setErr(x.message)}}
 const join=c&&location.origin+'/#/join/'+c.code;
 return <><div className="card"><h1 style={{fontSize:30,marginBottom:6}}>What did you just teach?</h1>
  <p className="muted" style={{margin:'0 0 16px'}}>Get a short check where every wrong answer is a named misconception.</p>
  <form onSubmit={go}><div className="row g3"><div><label htmlFor="t">Topic</label><input id="t" required value={f.topic} onChange={set('topic')}/></div>
  <div><label htmlFor="l">Level</label><input id="l" value={f.level} onChange={set('level')}/></div>
  <div><label htmlFor="n">Questions</label><select id="n" value={f.n} onChange={set('n')}>{[1,2,3,4,5].map(n=><option key={n}>{n}</option>)}</select></div></div>
  <div style={{marginTop:14}}><label htmlFor="u">Lecture link (for replay buttons)</label><input id="u" type="url" value={f.url} onChange={set('url')} placeholder="https://youtube.com/watch?v=…"/></div>
  <div className="chips" style={{marginTop:16}}><button className="btn" disabled={busy}>{busy?'Generating…':'Generate check'}</button></div></form>
  {err&&<p style={{color:'var(--bad)'}} role="alert">{err}</p>}</div>
  {busy&&<div className="card" style={{marginTop:16}}><div className="sk" style={{width:'60%'}}/><div className="sk"/><div className="sk" style={{width:'80%'}}/></div>}
  {c&&<><h2 style={{margin:'28px 0 12px'}}>Review: {c.topic}</h2>
  {c.pack.questions.map((q,i)=><div className="card" key={q.id} style={{marginBottom:12}}><h3 style={{fontSize:19}}>{i+1}. {q.text}</h3>
   {q.opts.map(o=><div className="opt" key={o.k}><b>{o.k.toUpperCase()}</b><span>{o.t}{o.mis?<span className="tag">{c.pack.mis.find(m=>m.id===o.mis)?.name}</span>:<span className="tag" style={{color:'var(--ok)'}}>correct</span>}</span></div>)}</div>)}
  <div className="card" style={{marginBottom:12}}><h3>Lecture sections</h3><p className="muted" style={{margin:'2px 0 6px'}}>Titles are AI-suggested. Set each timestamp to match your recording, or replay links will point to the wrong minute.</p>
   {c.pack.sections.map((s,i)=><div className="opt" key={i}><input style={{width:84}} aria-label={'Start of '+s.title} value={times[i]} onChange={e=>setT(times.map((t,j)=>j===i?e.target.value:t))}/><span>{s.title}</span></div>)}
   <button className="btn alt" style={{marginTop:10}} onClick={saveTimes}>Save timestamps</button></div>
  <div className="card"><h3>Share with your class</h3><div className="join">{c.code}</div><p className="muted">Students open <b>{join}</b> and add a first name.</p>
   <div className="chips"><button className="btn" onClick={()=>navigator.clipboard.writeText(join)}>Copy student link</button><a className="btn" href={'#/pulse/'+c.code} style={{textDecoration:'none'}}>Open live pulse</a></div></div></>}</>}

function Student({code}){
 const [c,setC]=useState(),[err,setErr]=useState(),[name,setName]=useState(''),[sid]=useState(()=>crypto.randomUUID()),[started,setS]=useState(false),
  [i,setI]=useState(0),[att,setAtt]=useState(1),[sel,setSel]=useState(),[r,setR]=useState(),[done,setDone]=useState(false),[brief,setB]=useState(false),[chat,setChat]=useState([]),[msg,setMsg]=useState('');
 useEffect(()=>{api('/classes/'+code).then(setC).catch(e=>setErr(e.message))},[code]);
 if(err)return <div className="empty"><h2>{err}</h2><p>Check the link or code your teacher shared.</p></div>;
 if(!c)return <div className="empty">Loading…</div>;
 const q=c.questions[i],fin=r&&(r.ok||att===2);
 async function pick(k){if(r)return;setSel(k);try{setR(await api(`/classes/${code}/answer`,{method:'POST',body:{sid,name,qid:q.id,opt:k,attempt:att}}))}catch(e){setErr(e.message)}}
 const next=()=>{if(i+1<c.questions.length){setI(i+1)}else setDone(true);setAtt(1);setR(null);setSel(null)};
 async function ask(e){e.preventDefault();const m=msg.trim();if(!m)return;setMsg('');setChat(x=>[...x,{me:1,t:m}]);
  try{const a=await api(`/classes/${code}/tutor`,{method:'POST',body:{qid:q?.id,message:m}});setChat(x=>[...x,{t:a.reply}])}catch{setChat(x=>[...x,{t:'Tutor is unavailable right now.'}])}}
 const tutor=<div className="tut"><b>AI tutor</b><div className="log">{chat.length?chat.map((m,j)=><p key={j} className={m.me?'me':''}>{m.t}</p>):<p className="muted">Stuck? Ask in English or Hinglish. I’ll guide you with a question.</p>}</div>
  <form className="chips" style={{flexWrap:'nowrap'}} onSubmit={ask}><input aria-label="Ask the tutor" placeholder="Ask a doubt…" value={msg} onChange={e=>setMsg(e.target.value)}/><button className="btn">Ask</button></form></div>;
 if(!started)return <div className="phone"><h2>Join: {c.topic}</h2><label htmlFor="nm">Your first name</label><input id="nm" value={name} onChange={e=>setName(e.target.value)}/>
  <button className="btn" style={{marginTop:'auto',padding:16}} disabled={!name.trim()} onClick={()=>setS(true)}>Start</button></div>;
 if(brief)return <div className="phone"><h2 style={{fontSize:22}}>Lecture brief</h2><div className="note"><b>Must know</b><ol>{c.key.map((k,j)=><li key={j}>{k}</li>)}</ol></div>
  <div><b>Section by section</b>{c.sections.map((s,j)=><div className="opt" key={j}><span>{s.summary} <Replay url={c.url} secs={s.secs} label="Watch"/></span></div>)}</div>
  <div><b>Common mistakes</b>{c.mistakes.map((m,j)=><p key={j} style={{margin:'4px 0'}}>{m.name}: {m.why}</p>)}</div><button className="btn" onClick={()=>setB(false)}>Back to the check</button></div>;
 if(done)return <div className="phone"><h2>Thanks, {name}!</h2><p>Your answers are in. Your teacher sees the class pattern, not individual names.</p><button className="btn alt" onClick={()=>setB(true)}>Read the lecture brief</button></div>;
 return <div className="phone"><button className="btn alt" style={{padding:'8px 12px'}} onClick={()=>setB(true)}>No time? Get the lecture brief</button>
  <span className="muted">Question {i+1} of {c.questions.length}</span><h2 style={{fontSize:22}}>{q.text}</h2>
  {q.opts.map(o=>{let k='ans';if(sel===o.k)k+=r?.ok?' good':' sel';if(fin&&r.correct===o.k)k+=' good';return <button key={o.k} className={k} disabled={!!r} onClick={()=>pick(o.k)}><b>{o.k.toUpperCase()}</b>{o.t}</button>})}
  {r&&!r.ok&&att===1&&<><div className="note"><b>Not quite. Think again.</b><br/>{r.hint}</div><button className="btn alt" onClick={()=>{setAtt(2);setR(null);setSel(null)}}>Try once more</button></>}
  {fin&&<><div className="note"><b>{r.ok?'Correct.':'Still not it, and that’s okay.'}</b><br/>{r.explain}{!r.ok&&r.section&&<><br/><Replay url={c.url} secs={r.section.secs} label={'Replay '+mmss(r.section.secs)+' · '+r.section.title}/></>}</div>
   <button className="btn" onClick={next}>{i+1<c.questions.length?'Next question':'Finish'}</button></>}
  {tutor}</div>}

function Pulse({code}){
 const token=store.get(code),[p,setP]=useState(),[err,setErr]=useState();
 useEffect(()=>{if(!token){setErr('This browser did not create this class, so it cannot open its pulse.');return}
  const es=new EventSource(`/api/classes/${code}/stream?token=${token}`);es.onmessage=e=>setP(JSON.parse(e.data));es.onerror=()=>setErr('Connection lost. Retrying…');es.onopen=()=>setErr();return()=>es.close()},[code,token]);
 if(!p)return <div className="empty">{err||'Loading…'}</div>;
 if(!p.responded)return <div className="empty"><h2>Waiting for answers</h2><p>Nobody has responded yet. Share code <b>{code}</b>.</p></div>;
 const top=p.misconceptions[0];
 return <><div className="hero"><div className="big">{p.responded}</div><div><h2>responded</h2><span className="muted">{err||'Live. Updates as answers arrive.'}</span></div></div>
  {top&&<div className="card" style={{borderColor:'var(--bad)',marginBottom:12}}><h2 style={{fontSize:26}}>{top.count} of {p.responded} students: {top.name}</h2><p className="muted">{top.why}</p>
   <div className="sec"><h3>Ask the class first</h3>{top.plan.ask}</div><div className="sec"><h3>2-minute fix</h3>{top.plan.counter}</div></div>}
  <div className="chips" style={{marginBottom:16}}><span className="tag" style={{color:'var(--ok)'}}>{p.fixed} answers fixed after a hint</span><span className="tag">{p.stuck} students still stuck</span></div>
  <div className="card" style={{marginBottom:22}}>{p.questions.map((q,i)=>{const t=q.right+q.wrong||1;return <div key={q.id} style={{margin:'8px 0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><span>{i+1}. {q.text}</span><span className="muted" style={{whiteSpace:'nowrap'}}>{q.right} right · {q.wrong} wrong</span></div>
   <div className="bar" role="img" aria-label={`${q.right} right, ${q.wrong} wrong`}><i className="r" style={{width:q.right/t*100+'%'}}/><i className="w" style={{width:q.wrong/t*100+'%'}}/></div></div>})}</div>
  <h2 style={{marginBottom:12}}>All misconceptions</h2>
  {p.misconceptions.map(m=><details className="card" key={m.id} style={{marginBottom:12}}><summary><b>{m.count} students</b> · {m.name}</summary>
   <p className="muted">{m.why}</p><div className="sec"><h3>1. Ask first</h3><p>{m.plan.ask}</p></div><div className="sec"><h3>2. Counterexample</h3><p>{m.plan.counter}</p></div>
   <div className="sec"><h3>3. 60-second explanation</h3><p>{m.plan.explain}</p></div><div className="sec"><h3>4. Follow-up check</h3><p>{m.plan.follow}</p></div>
   <p className="muted">Lecture section: {m.section.title} at {mmss(m.section.secs)}</p></details>)}</>}
