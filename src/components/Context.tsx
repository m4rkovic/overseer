import {useState} from 'react';
import type {Project,Task} from '../domain';
import {parseSnapshot,matchPullRequest,buildProjectContext,rankReady} from '../context';
import type {RepositorySnapshot,ContextData} from '../context';
import {Empty} from './primitives';

type Shared={projects:Project[];scope:string;data:ContextData;snapshots:Record<string,RepositorySnapshot>};
export function RepositoryPanel({projects,scope,data,snapshots,onImport,onClear}:{projects:Project[];scope:string;data:ContextData;snapshots:Record<string,RepositorySnapshot>;onImport:(id:string,value:RepositorySnapshot)=>void;onClear:(id:string)=>void}){
 const [chosen,setChosen]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const available=projects.filter(p=>!scope||p.id===scope);
 const project=available.find(p=>p.id===chosen)||available[0];
 if(!project)return <Empty>No project available.</Empty>;
 const imported=snapshots[project.id];
 const snapshot=imported?.repository.toLowerCase()===project.repository.toLowerCase()?imported:undefined;
 const validRepo=/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(project.repository);
 async function upload(file:File){if(!project)return;setNotice('');setBusy(true);
 try{if(file.size>500000)throw new Error('Snapshot exceeds size limit');const value=parseSnapshot(await file.text(),project.repository);onImport(project.id,value);setNotice('Snapshot imported for this session only.')}
 catch(e){setNotice(e instanceof Error?e.message:'Import failed')}finally{setBusy(false)}
 }
 return <section><div className="section-head"><h2>GitHub repository state</h2><select aria-label="Repository project" disabled={busy} value={project.id} onChange={e=>{setChosen(e.target.value);setNotice('')}}>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
 <p className="muted">Read-only snapshot from the authenticated GitHub CLI. No token is stored in this app. Data is not live and is cleared on sign-out or reload.</p>
 <div className="record"><h3>Import snapshot</h3><p>Run from the OVERSEER checkout in a terminal with GitHub CLI access:</p><pre className="pre mono">node scripts/github-snapshot.mjs {validRepo?project.repository:'OWNER/REPO'} &gt; snapshot.json</pre><div className="actions"><label>JSON file <input type="file" accept=".json,application/json" disabled={busy||!validRepo} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value=''}}/></label><button disabled={!imported||busy} onClick={()=>{onClear(project.id);setNotice('Snapshot cleared.')}}>Clear snapshot</button></div><p role="status">{notice}</p></div>
 {snapshot?<><p className="muted">Imported snapshot · {new Date(snapshot.captured_at).toLocaleString()} · {snapshot.default_branch}</p>
 <h3>Recent commits</h3>{snapshot.commits.map(c=><div className="project-line" key={c.sha}><span>{c.subject}</span><a className="mono" href={'https://github.com/'+snapshot.repository+'/commit/'+c.sha} target="_blank" rel="noreferrer">{c.sha.slice(0,8)} ↗</a><small>{new Date(c.date).toLocaleString()}</small></div>)}
 <h3>Pull requests</h3>{snapshot.pull_requests.map(p=><div className="project-line" key={p.number}><a href={'https://github.com/'+snapshot.repository+'/pull/'+p.number} target="_blank" rel="noreferrer">#{p.number} {p.title} ↗</a><small>{p.head} → {p.base}</small><span className="status">{p.state}</span></div>)}
 <h3>Linked tasks</h3>{data.tasks.filter(t=>t.project_id===project.id&&t.pr_url).map(t=>{const p=matchPullRequest(t,snapshot);return <div className="project-line" key={t.id}><span>{t.title}</span><small>{p?'PR #'+p.number+' · '+p.state:'Not found in imported snapshot'}</small></div>})}</>:<Empty>No snapshot loaded for this repository.</Empty>}</section>
}
export function ContextPanel({projects,scope,data,snapshots}:Shared){
 const [chosen,setChosen]=useState(''),[notice,setNotice]=useState('');
 const available=projects.filter(p=>!scope||p.id===scope),project=available.find(p=>p.id===chosen)||available[0];
 if(!project)return <Empty>No project available.</Empty>;
 const context=buildProjectContext(project,data,snapshots[project.id]);
 return <section><div className="section-head"><h2>AI project context</h2><div className="actions"><select aria-label="Context project" value={project.id} onChange={e=>{setChosen(e.target.value);setNotice('')}}>{available.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={async()=>{try{await navigator.clipboard.writeText(context);setNotice('Copied. Review private context before sharing.')}catch{setNotice('Clipboard unavailable. Select and copy the text.')}}}>Copy context</button></div></div><p className="muted">Project-scoped context for a new AI session. This text contains private data and does not confer authorization.</p><p role="status">{notice}</p><textarea readOnly rows={25} className="handover-text" aria-label="AI project context" value={context}/></section>
}
export function RankedQueue({queue,deps,onOpen}:{queue:Task[];deps:ContextData['deps'];onOpen:(task:Task)=>void}){
 const ranked=rankReady(queue,deps);
 return <section><h3>Suggested order</h3><p className="muted">Priority first, then number of direct dependent tasks. Advisory only: database claim order is unchanged.</p>{ranked.slice(0,15).map((t,i)=><div key={t.id} className="project-line"><button className="text-button" onClick={()=>onOpen(t)}>{i+1}. {t.title}</button><small>P{t.priority}</small><small>{deps.filter(d=>d.project_id===t.project_id&&d.depends_on_id===t.id).length} direct dependents</small></div>)}</section>
}
