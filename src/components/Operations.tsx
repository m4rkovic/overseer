import {useMemo,useState} from 'react';
import {readable,githubRepo,githubPR} from '../domain';
import type {Task,Project,Dependency,Work,Note,Decision,Approval,Activity} from '../domain';
import {planBulk,dependencyLayers,projectStats,handoverText,exportProject} from '../operations';
import type {BulkPatch,ExportData} from '../operations';
import {Empty} from './primitives';

export function BulkTasks({tasks,sessions,busy,onApply,onOpen}:{tasks:Task[];sessions:Work[];busy:boolean;onApply:(rows:Task[],patch:BulkPatch)=>Promise<void>;onOpen:(t:Task)=>void}){
 const [selected,setSelected]=useState<Set<string>>(new Set()),[status,setStatus]=useState(''),[priority,setPriority]=useState('');
 const patch:BulkPatch={...(status?{status}:{}),...(priority?{priority:Number(priority)}:{})};
 const plan=planBulk(tasks,selected,sessions,patch);
 const visibleSelected=tasks.filter(t=>selected.has(t.id)).length;
 function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next})}
 return <section><div className="section-head"><h2>Bulk operations</h2><small>{visibleSelected} selected</small></div>
 <div className="actions bulk-toolbar"><button disabled={busy||!tasks.length} onClick={()=>setSelected(new Set(tasks.map(t=>t.id)))}>Select visible</button><button disabled={busy} onClick={()=>setSelected(new Set())}>Clear</button>
 <select aria-label="New status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Keep status</option>{['backlog','ready','blocked','review','done','cancelled'].map(s=><option key={s} value={s}>{readable(s)}</option>)}</select>
 <select aria-label="New priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Keep priority</option>{[0,1,2,3,4].map(p=><option key={p} value={p}>P{p}</option>)}</select>
 <button className="primary" disabled={busy||!plan.eligible.length} onClick={()=>{if(window.confirm('Update '+plan.eligible.length+' selected tasks?'))void onApply(plan.eligible,patch).finally(()=>setSelected(new Set()))}}>Apply to {plan.eligible.length}</button></div>
 <p className="muted">Each update checks its original revision. Active sessions are excluded; failures are reported individually. This is not an all-or-nothing transaction.</p>
 {plan.skipped.length>0&&<details><summary>{plan.skipped.length} skipped</summary>{plan.skipped.map(s=><p key={s.id}>{tasks.find(t=>t.id===s.id)?.title||s.id}: {s.reason}</p>)}</details>}
 {tasks.length?<div className="table-wrap"><table><thead><tr><th>Select</th><th>Task</th><th>Status</th><th>Priority</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td><input type="checkbox" aria-label={'Select '+t.title} disabled={busy} checked={selected.has(t.id)} onChange={()=>toggle(t.id)}/></td><td><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button></td><td>{readable(t.status)}</td><td>P{t.priority}</td></tr>)}</tbody></table></div>:<Empty>No tasks match the current filters.</Empty>}</section>
}

export function DependencyGraph({tasks,deps,onOpen}:{tasks:Task[];deps:Dependency[];onOpen:(t:Task)=>void}){
 const graph=useMemo(()=>dependencyLayers(tasks,deps),[tasks,deps]);
 const relevantIds=new Set(graph.edges.flatMap(d=>[d.task_id,d.depends_on_id]));
 const nodes=graph.nodes.filter(n=>relevantIds.has(n.task.id));
 const levels=[...new Set(nodes.map(n=>n.level))].sort((a,b)=>a-b);
 return <section><h2>Dependency flow</h2><p className="muted">Left to right: prerequisites before dependent tasks. Each node lists its direct prerequisites.</p>
 {graph.unresolved.length>0&&<p className="error">Unresolved dependency cycle or downstream nodes: {graph.unresolved.map(t=>t.title).join(', ')}</p>}
 {levels.length?<div className="dependency-graph">{levels.map(level=><div className="graph-level" key={level}><small>LEVEL {level+1}</small>{nodes.filter(n=>n.level===level).map(({task})=><article className="graph-node" key={task.id}><button className="text-button" onClick={()=>onOpen(task)}>{task.title}</button><span className={'status '+task.status}>{readable(task.status)}</span>{graph.edges.filter(d=>d.task_id===task.id).map(d=><small key={d.depends_on_id}>← {tasks.find(t=>t.id===d.depends_on_id)?.title}</small>)}</article>)}</div>)}</div>:<Empty>No dependency edges to visualize.</Empty>}</section>
}

export function TaskDetail({task,project,tasks,deps,works,approvals,activity,onEdit,onOpen,onClose}:{task:Task;project?:Project;tasks:Task[];deps:Dependency[];works:Work[];approvals:Approval[];activity:Activity[];onEdit:()=>void;onOpen:(t:Task)=>void;onClose:()=>void}){
 const branch=project&&githubRepo(project.repository)&&task.branch?githubRepo(project.repository)+'/tree/'+encodeURIComponent(task.branch):null;
 const pr=githubPR(task.pr_url);
 const related=deps.filter(d=>d.task_id===task.id||d.depends_on_id===task.id);
 return <section><div className="section-head"><div><small>{project?.name||'Project'} / {task.kind}</small><h2>{task.title}</h2></div><div className="actions"><button onClick={onEdit}>Edit</button><button onClick={onClose}>Back</button></div></div>
 <div className="actions"><span className={'status '+task.status}>{readable(task.status)}</span><span className="mono">P{task.priority}</span>{task.requires_approval&&<span className="status pending">Approval required</span>}{branch&&<a href={branch} target="_blank" rel="noreferrer">Branch ↗</a>}{pr&&<a href={pr} target="_blank" rel="noreferrer">Pull request ↗</a>}</div>
 <div className="detail-grid">{[['Description',task.description],['Acceptance criteria',task.acceptance_criteria],['Next step',task.next_step],['Test result',task.test_result]].map(([title,value])=><article className="record" key={title}><h3>{title}</h3><p className="pre">{value||'Not recorded'}</p></article>)}</div>
 <h3>Related tasks</h3>{related.map(d=>{const incoming=d.task_id===task.id;const other=tasks.find(t=>t.id===(incoming?d.depends_on_id:d.task_id));return <div className="dependency-edge" key={d.task_id+':'+d.depends_on_id}><small>{incoming?'Depends on':'Blocks'}</small>{other?<button className="text-button" onClick={()=>onOpen(other)}>{other.title}</button>:'Unknown task'}</div>})}
 {tasks.filter(t=>t.parent_id===task.id).map(t=><div className="dependency-edge" key={t.id}><small>Child</small><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button></div>)}
 <h3>Approvals</h3>{approvals.filter(a=>a.task_id===task.id).map(a=><p key={a.id}>{a.operation} · {a.status}</p>)}
 <h3>Work sessions</h3>{works.filter(w=>w.task_id===task.id).map(w=><article className="record" key={w.id}><small>{w.status} · {new Date(w.heartbeat_at).toLocaleString()}</small><p className="pre">{w.summary}</p><p className="pre">Next: {w.next_step||'Not recorded'}</p></article>)}
 <h3>Recent activity</h3>{activity.filter(a=>a.task_id===task.id).map(a=><p key={a.id}>{new Date(a.created_at).toLocaleString()} · {a.event}</p>)}</section>
}

export function ProjectOperations({data,queue,scope,onOpen}:{data:ExportData;queue:Task[];scope:string;onOpen:(t:Task)=>void}){
 const [chosen,setChosen]=useState(''),[notice,setNotice]=useState('');
 const projects=data.projects.filter(p=>!scope||p.id===scope);
 const project=projects.find(p=>p.id===chosen)||projects[0];
 const tasks=data.tasks.filter(t=>t.project_id===project?.id);
 if(!project)return <Empty>No project available.</Empty>;
 const stats=projectStats(tasks,queue,data.works);
 function download(){if(!project)return;if(!window.confirm('Export the private project data currently loaded in this browser?'))return;
  try{const blob=new Blob([JSON.stringify(exportProject(data,project.id),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='overseer-'+project.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Export generated. Keep it private. Activity is limited to loaded events.');}catch(e){setNotice(String(e))}
 }
 return <section><div className="section-head"><h2>Project operations</h2><div className="actions"><select aria-label="Project" value={project.id} onChange={e=>setChosen(e.target.value)}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button onClick={download}>Export JSON</button></div></div>
 <p className="muted">{project.description}</p>{notice&&<p role="status">{notice}</p>}
 <div className="metrics">{Object.entries(stats).map(([k,v])=><div className="metric" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
 <h3>Delivery status</h3>{tasks.filter(t=>t.branch||t.pr_url||t.test_result).map(t=><div className="project-line" key={t.id}><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button><small>{t.branch||'No branch'}</small>{githubPR(t.pr_url)&&<a href={githubPR(t.pr_url)!} target="_blank" rel="noreferrer">PR ↗</a>}<small>{t.test_result||'No test result'}</small></div>)}
 <p className="muted">Delivery information is recorded in tasks. GitHub is not queried automatically.</p></section>
}
export function Handover({projects,tasks,works,notes,decisions,scope}:{projects:Project[];tasks:Task[];works:Work[];notes:Note[];decisions:Decision[];scope:string}){
 const [selected,setSelected]=useState(''),[notice,setNotice]=useState('');
 const sessions=works.filter(w=>!scope||w.project_id===scope);
 const session=sessions.find(w=>w.id===selected)||sessions[0];
 const project=projects.find(p=>p.id===session?.project_id);
 if(!session||!project)return <Empty>No work session to hand over.</Empty>;
 const text=handoverText(project,tasks.find(t=>t.id===session.task_id),session,notes,decisions);
 return <section><div className="section-head"><h2>Session handover</h2><button onClick={async()=>{try{await navigator.clipboard.writeText(text);setNotice('Copied to clipboard. Review private data before sharing.')}catch{setNotice('Clipboard unavailable. Select the text and copy manually.')}}}>Copy handover</button></div><select aria-label="Work session" value={session.id} onChange={e=>{setSelected(e.target.value);setNotice('')}}>{sessions.map(w=><option key={w.id} value={w.id}>{projects.find(p=>p.id===w.project_id)?.name} · {w.status} · {new Date(w.started_at).toLocaleString()}</option>)}</select><p role="status" className="muted">{notice}</p><textarea className="handover-text" readOnly aria-label="Session handover text" value={text} rows={20}/></section>
}
