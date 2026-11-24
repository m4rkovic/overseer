import {readable} from '../domain';
import type {Project,Task,Note,Decision,Work,Approval} from '../domain';
import {Empty} from './primitives';
import {RecordForm,ProjectRegistry} from './Records';
import type {RecordEditor,RecordSubmission} from './Records';

type RecordsProps={projects:Project[];scope:string;busy:boolean;editor:RecordEditor|null;onEdit:(value:RecordEditor|null)=>void;onSave:(value:RecordSubmission)=>Promise<boolean>};
type NameLookup=(id:string)=>string;
const Status=({value}:{value:string})=><span className={'status '+value}>{readable(value)}</span>;

export function ProjectsView({projects,scope,busy,editor,onEdit,onSave,tasks,onOpen}:RecordsProps&{tasks:Task[];onOpen:(id:string)=>void}){
 return <section>
  <div className="section-head"><h2>Project registry</h2><button className="primary" disabled={busy} onClick={()=>onEdit({kind:'project'})}>+ Project</button></div>
  {editor?.kind==='project'&&<RecordForm key={editor.record?.id||'new'} editor={editor} projects={projects} scope={scope} busy={busy} onClose={()=>onEdit(null)} onSave={onSave}/>}
  <ProjectRegistry projects={projects.filter(p=>!scope||p.id===scope)} tasks={tasks} onEdit={p=>onEdit({kind:'project',record:p})} onOpen={onOpen}/>
 </section>;
}

export function MemoryView({projects,scope,busy,editor,onEdit,onSave,notes,directives,projectName}:RecordsProps&{notes:Note[];directives:boolean;projectName:NameLookup}){
 const rows=notes.filter(n=>!directives||['constraint','convention'].includes(n.category));
 return <section>
  <div className="section-head"><h2>{directives?'Project directives':'Persistent context'}</h2><button disabled={busy||!projects.length} onClick={()=>onEdit({kind:'memory',directives})}>+ {directives?'Directive':'Memory'}</button></div>
  {directives&&<p className="muted">Persistent constraints and conventions for project work. These guide agent sessions, but do not grant execution permissions.</p>}
  {editor?.kind==='memory'&&<RecordForm key={editor.record?.id||'new-'+String(directives)} editor={editor} projects={projects} scope={scope} busy={busy} onClose={()=>onEdit(null)} onSave={onSave}/>}
  {rows.map(n=><article className="record" key={n.id}><div className="section-head"><small>{projectName(n.project_id)} / {readable(n.category)}</small><button disabled={busy} onClick={()=>onEdit({kind:'memory',record:n,directives})}>Edit</button></div><h3>{n.title}</h3><p className="pre">{n.content}</p></article>)}
  {!rows.length&&<Empty>No entries in this view.</Empty>}
 </section>;
}

export function DecisionsView({projects,scope,busy,editor,onEdit,onSave,decisions,projectName}:RecordsProps&{decisions:Decision[];projectName:NameLookup}){
 return <section>
  <div className="section-head"><h2>Architecture decisions</h2><button disabled={busy||!projects.length} onClick={()=>onEdit({kind:'decision'})}>+ Decision</button></div>
  {editor?.kind==='decision'&&<RecordForm key={editor.record?.id||'new'} editor={editor} projects={projects} scope={scope} busy={busy} onClose={()=>onEdit(null)} onSave={onSave}/>}
  {decisions.map(d=><article className="record" key={d.id}><div className="section-head"><small>{projectName(d.project_id)}</small><button disabled={busy} onClick={()=>onEdit({kind:'decision',record:d})}>Edit</button></div><h3>{d.title} <Status value={d.status}/></h3><p className="pre">{d.rationale}</p><p className="pre">{d.outcome}</p></article>)}
  {!decisions.length&&<Empty>No decisions recorded.</Empty>}
 </section>;
}

export function SessionsView({works,projectName}:{works:Work[];projectName:NameLookup}){
 return <section>{works.map(w=><article className="record" key={w.id}>
  <small>{projectName(w.project_id)} · {new Date(w.started_at).toLocaleString()}</small>
  <h3><Status value={w.status}/> {w.status==='active'&&Date.parse(w.lease_expires_at)<=Date.now()&&<Status value="blocked"/>}</h3>
  <p className="muted">{w.status==='active'?'Lease expires: '+new Date(w.lease_expires_at).toLocaleString():''}</p><p className="pre">{w.summary}</p><p className="pre">Next: {w.next_step||'—'}</p>
 </article>)}{!works.length&&<Empty>No work sessions recorded.</Empty>}</section>;
}

export function ApprovalsView({approvals,tasks,projectName,busy,onResolve}:{approvals:Approval[];tasks:Task[];projectName:NameLookup;busy:boolean;onResolve:(approval:Approval,status:'approved'|'rejected')=>void}){
 const names=new Map(tasks.map(t=>[t.id,t.title]));
 return <section>{approvals.map(a=><article className="record" key={a.id}>
  <small>{projectName(a.project_id)}</small><h3>{a.operation}</h3><p>{names.get(a.task_id)||'Task'}</p><Status value={a.status}/>
  {a.status==='pending'&&<div className="actions"><button disabled={busy} onClick={()=>{if(window.confirm('Approve this operation?'))onResolve(a,'approved')}}>Approve</button><button disabled={busy} onClick={()=>onResolve(a,'rejected')}>Reject</button></div>}
 </article>)}{!approvals.length&&<Empty>No approval requests.</Empty>}</section>;
}
