import {useState,useMemo} from 'react';
import {readable} from '../domain';
import type {Task,Project,Work,Approval,Activity,TaskFilters,TaskDraft} from '../domain';
import {templates,applyTemplate,epicProgress,projectHealth,filterActivity,emptyActivityFilters,parseViews} from '../planning';
import type {SavedView,ViewMode} from '../planning';
import {Empty} from './primitives';

export function TemplatePicker({draft,onChange}:{draft:TaskDraft;onChange:(d:TaskDraft)=>void}){
 return <div className="template-picker"><label>Start from template <select value="" onChange={e=>{const id=e.target.value;if(id&&(!draft.description&&!draft.acceptance_criteria&&!draft.next_step||window.confirm('Replace description, acceptance criteria and next step with this template?')))onChange(applyTemplate(draft,id));}}><option value="">Blank task</option>{templates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label></div>
}

export function SavedViews({userId,scope,filters,mode,onApply}:{userId:string;scope:string;filters:TaskFilters;mode:ViewMode;onApply:(v:SavedView)=>void}){
 const key='overseer.views.v1.'+userId;
 const [views,setViews]=useState<SavedView[]>(()=>{try{return parseViews(localStorage.getItem(key))}catch{return []}});
 const [name,setName]=useState(''),[chosen,setChosen]=useState(''),[notice,setNotice]=useState('');
 function persist(next:SavedView[]){try{localStorage.setItem(key,JSON.stringify(next));setViews(next);setNotice('')}catch{setNotice('Browser storage unavailable. View not saved.')}}
 function save(){const label=name.trim();if(!label)return;if(views.length>=30){setNotice('Maximum 30 saved views. Remove an existing view first.');return;}
 const view:SavedView={id:crypto.randomUUID(),name:label,scope,filters:{...filters},mode};
 persist([...views,view]);setName('');
 }
 return <div className="saved-views"><div className="actions"><input aria-label="New view name" placeholder="View name" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><button disabled={!name.trim()} onClick={save}>Save current view</button>
 <select aria-label="Saved view" value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">Saved views…</option>{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select><button disabled={!chosen} onClick={()=>{const v=views.find(v=>v.id===chosen);if(v)onApply(v)}}>Apply</button><button disabled={!chosen} onClick={()=>{persist(views.filter(v=>v.id!==chosen));setChosen('')}}>Remove</button></div><small>Saved only in this browser for this account. Do not include sensitive text in view names or queries.</small>{notice&&<p role="status">{notice}</p>}</div>
}

export function EpicOverview({tasks,onOpen}:{tasks:Task[];onOpen:(t:Task)=>void}){
 const epics=tasks.filter(t=>t.kind==='epic');
 return <section><h2>Epic progress</h2><p className="muted">Counts all non-epic, non-cancelled descendants; nested tasks are counted once per epic.</p>{epics.length?epics.map(epic=>{const p=epicProgress(epic,tasks);return <article className="record" key={epic.id}><div className="section-head"><button className="text-button" onClick={()=>onOpen(epic)}>{epic.title}</button><small>{p.done}/{p.total} complete · {p.blocked} blocked</small></div><progress className="full-progress" value={p.done} max={Math.max(p.total,1)}/><details><summary>Descendants ({p.total})</summary>{p.descendants.map(t=><div className="dependency-edge" key={t.id}><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button><small>{readable(t.status)}</small></div>)}</details></article>}):<Empty>No epics in this view.</Empty>}</section>
}

export function HealthDashboard({projects,tasks,queue,works,approvals,onOpen}:{projects:Project[];tasks:Task[];queue:Task[];works:Work[];approvals:Approval[];onOpen:(id:string)=>void}){
 return <section><h2>Project health</h2><p className="muted">Operational counts from the current loaded data. No synthetic health scores or live monitoring.</p>{projects.length?<div className="table-wrap"><table><thead><tr><th>Project</th><th>Open</th><th>Ready</th><th>Waiting</th><th>Blocked</th><th>Expired sessions</th><th>Pending approvals</th><th>Missing next step</th></tr></thead><tbody>{projects.map(p=>{const h=projectHealth(p,tasks,queue,works,approvals,Date.now());return <tr key={p.id}><td><button className="text-button" onClick={()=>onOpen(p.id)}>{p.name}</button></td>{Object.entries(h).map(([k,v])=><td key={k} className={v&&['expired','blocked','waiting','pending','missingNext'].includes(k)?'attention':''}>{v}</td>)}</tr>})}</tbody></table></div>:<Empty>No projects yet.</Empty>}</section>
}

export function ActivityTimeline({rows,projects,tasks,onOpen}:{rows:Activity[];projects:Project[];tasks:Task[];onOpen:(t:Task)=>void}){
 const [filters,setFilters]=useState(emptyActivityFilters),[limit,setLimit]=useState(25);
 const names=useMemo(()=>new Map([...projects.map(p=>[p.id,p.name] as const),...tasks.map(t=>[t.id,t.title] as const)]),[projects,tasks]);
 const visible=filterActivity(rows,filters,names,Date.now());
 const entities=[...new Set(rows.map(a=>a.event.split('.')[0]))].sort(),actors=[...new Set(rows.map(a=>a.actor_source))].sort();
 function change<K extends keyof typeof filters>(key:K,value:string){setFilters(old=>({...old,[key]:value}));setLimit(25)}
 return <section><div className="section-head"><h2>Activity log</h2><small>{visible.length} matching / {rows.length} loaded</small></div><p className="muted">Filters apply to the latest 100 workspace events already loaded, not the complete audit history.</p><div className="actions activity-filters">
 <input placeholder="Search activity…" aria-label="Search activity" value={filters.query} onChange={e=>change('query',e.target.value)}/>
 <select aria-label="Entity" value={filters.entity} onChange={e=>change('entity',e.target.value)}><option value="">All entities</option>{entities.map(e=><option key={e} value={e}>{readable(e)}</option>)}</select>
 <select aria-label="Actor source" value={filters.actor} onChange={e=>change('actor',e.target.value)}><option value="">All actors</option>{actors.map(a=><option key={a}>{a}</option>)}</select>
 <select aria-label="Operation" value={filters.operation} onChange={e=>change('operation',e.target.value)}><option value="">All operations</option>{['insert','update','delete'].map(a=><option key={a}>{a}</option>)}</select>
 <select aria-label="Time window" value={filters.since} onChange={e=>change('since',e.target.value)}><option value="">All loaded dates</option><option value="1">Past 24 hours</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option></select><button onClick={()=>{setFilters(emptyActivityFilters);setLimit(25)}}>Reset</button></div>
 {visible.slice(0,limit).map(a=>{const t=tasks.find(t=>t.id===a.task_id),keys=[...new Set([...Object.keys(a.details?.before||{}),...Object.keys(a.details?.after||{})])];return <div className="project-line" key={a.id}><div><strong>{readable(a.event.replace('.',' / '))}</strong><p className="muted">{t?<button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button>:names.get(a.project_id)||'Project'} · {a.actor_source}</p>{keys.filter(k=>JSON.stringify(a.details?.before?.[k])!==JSON.stringify(a.details?.after?.[k])).map(k=><small key={k} className="audit-diff">{readable(k)}: {String(a.details?.before?.[k]??'—')} → {String(a.details?.after?.[k]??'—')}</small>)}</div><small>{new Date(a.created_at).toLocaleString()}</small></div>})}
 {!visible.length&&<Empty>No matching activity.</Empty>}{limit<visible.length&&<button onClick={()=>setLimit(n=>n+25)}>Show 25 more</button>}</section>
}
