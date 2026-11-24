import React,{useEffect,useState,useMemo} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db} from './lib/supabase';
import {statuses,blankTask,readable,defaultFilters,buildTaskBlockerMap,wouldCreateParentCycle} from './domain';
import type {Task,TaskDraft,Tab,TaskFilters} from './domain';
import {Empty} from './components/primitives';
import {TaskEditor} from './components/TaskEditor';
import {saveTaskRow,moveTask,saveRecord} from './lib/workspaceApi';
import {RecordForm,ProjectRegistry,DependencyOverview} from './components/Records';
import type {RecordEditor,RecordSubmission} from './components/Records';
import {DependencyGraph,TaskDetail,ProjectOperations,Handover} from './components/Operations';
import type {BulkPatch} from './operations';
import {EpicOverview,HealthDashboard,ActivityTimeline} from './components/Planning';
import {RepositoryPanel,ContextPanel,RankedQueue} from './components/Context';
import type {RepositorySnapshot} from './context';
import {usePreferences} from './lib/preferences';
import {SettingsPanel} from './components/Settings';
import {useWorkspaceData} from './hooks/useWorkspaceData';
import {TaskTable,TasksView} from './components/TasksView';
import {WorkspaceShell} from './components/WorkspaceShell';
import {CommandPalette} from './components/CommandPalette';
export function Workspace({session}:{session:Session}){
 const preferences=usePreferences(session.user.id);
 const [tab,setTab]=useState<Tab>('Overview');
 const {data,loading,busy,error,notice,setError,refresh,mutate,bulkApply:applyBulk}=useWorkspaceData();
 const {projects,tasks,queue,notes,decisions,works,approvals,activity,deps}=data;
 const [filters,setFilters]=useState<TaskFilters>(defaultFilters);
 const [snapshots,setSnapshots]=useState<Record<string,RepositorySnapshot>>({});

 const [scope,setScope]=useState(''),[search,setSearch]=useState(''),[editor,setEditor]=useState<Task|TaskDraft|null>(null),[recordEditor,setRecordEditor]=useState<RecordEditor|null>(null),[mode,setMode]=useState<'table'|'board'|'bulk'>(preferences.value.defaultMode);
 const [detailId,setDetailId]=useState<string|null>(null);
 const [palette,setPalette]=useState(false);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!editor)setPalette(v=>!v)}else if(e.key==='Escape'){setPalette(false)}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[editor]);
 const scoped=<T extends {project_id:string}>(rows:T[])=>rows.filter(r=>!scope||r.project_id===scope);
 const activeTaskIds=useMemo(()=>new Set(works.filter(w=>w.status==='active'&&w.task_id).map(w=>w.task_id)),[works]);
 const editorLocked=!!editor&&'id' in editor&&activeTaskIds.has(editor.id);
 const blockerMap=useMemo(()=>buildTaskBlockerMap(tasks,deps,approvals,works),[tasks,deps,approvals,works]);
 const blockers=(t:Task)=>blockerMap.get(t.id)||[];
 const projectName=(id:string)=>projects.find(p=>p.id===id)?.name||'Unknown project';
 const detail=tasks.find(t=>t.id===detailId);
 function openDetail(task:Task){setDetailId(task.id);setTab('Tasks');setScope(task.project_id);setPalette(false);}
 const bulkApply=(rows:Task[],patch:BulkPatch)=>applyBulk(rows,patch,activeTaskIds);
 async function saveTask(e:React.FormEvent){
  e.preventDefault();if(!editor||editorLocked)return;
  if(!editor.title.trim())return;
  if(editor.status==='in_progress'&&(!('id' in editor)||tasks.find(t=>t.id===editor.id)?.status!=='in_progress')){setError('Start work through the agent claim, not manual status editing.');return;}
  if('id' in editor&&editor.parent_id&&wouldCreateParentCycle(editor.id,editor.parent_id,tasks)){setError('Parent relationship would create a cycle.');return;}
  if(await mutate(()=>saveTaskRow(editor)))setEditor(null);
 }
 async function changeStatus(id:string,status:string){
  const task=tasks.find(t=>t.id===id);
  if(!task||task.status===status||activeTaskIds.has(id)||!statuses.includes(status))return;
  if(status==='in_progress'){setError('Start work through the execution queue / agent claim, not a manual drag.');return;}
  await mutate(()=>moveTask(task,status));
 }
 function newTask(){if(projects.length)setEditor(blankTask(scope||projects[0].id));else{setTab('Projects');setRecordEditor({kind:'project'})}}
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{
  if(!e.altKey||!e.shiftKey||e.ctrlKey||e.metaKey||editor||palette||busy||loading)return;
  const target=e.target;
  if(target instanceof HTMLElement&&(target.matches('input,textarea,select')||target.isContentEditable))return;
  const key=e.key.toLowerCase();
  if(key==='n'){e.preventDefault();newTask();}
  if(key==='r'){e.preventDefault();void refresh();}
  if(key==='t'){e.preventDefault();setTab('Tasks');setDetailId(null);setRecordEditor(null);}
 };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 },[editor,palette,busy,loading,projects,scope,refresh]);
 async function saveWorkspaceRecord(r:RecordSubmission){return mutate(()=>saveRecord(r.table,r.id,r.updatedAt,r.payload));}
 const statusTag=(s:string)=><span className={'status '+s}>{readable(s)}</span>;

 function navigate(next:Tab){setTab(next);setSearch('');setRecordEditor(null);setDetailId(null);setPalette(false);}
 function openProject(id:string){setScope(id);navigate('Tasks');}
 return <>
 <WorkspaceShell tab={tab} scope={scope} projects={projects} email={session.user.email} preferences={preferences.value} busy={busy} loading={loading} notice={notice} error={error} modalOpen={!!editor||palette} onNavigate={navigate} onScope={id=>{setScope(id);setDetailId(null);setRecordEditor(null)}} onSignOut={()=>void db.auth.signOut()} onRefresh={()=>void refresh()} onSearch={()=>setPalette(true)} onNewTask={newTask}>
 {tab==='Overview'&&<><div className="metrics">{[['Projects',projects.filter(p=>!scope||p.id===scope).length],['Open tasks',scoped(tasks).filter(t=>!['done','cancelled'].includes(t.status)).length],['Ready',scoped(queue).length],['Blocked',scoped(tasks).filter(t=>t.status==='blocked').length]].map(([label,value])=><div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><section><div className="section-head"><h2>Execution queue</h2><button onClick={()=>setTab('Execution queue')}>View all</button></div><TaskTable rows={scoped(queue).slice(0,8)} projectName={projectName} blockers={blockers} openDetail={openDetail}/></section><section><h2>Active projects</h2>{projects.filter(p=>p.status==='active'&&(!scope||p.id===scope)).map(p=>{const rows=tasks.filter(t=>t.project_id===p.id&&t.kind!=='epic'&&t.status!=='cancelled');const done=rows.filter(t=>t.status==='done').length;return <div className="project-line" key={p.id}><button className="text-button" onClick={()=>{setScope(p.id);setTab('Tasks')}}>{p.name}</button><span className="muted">{done}/{rows.length} complete</span><progress value={done} max={Math.max(1,rows.length)}/></div>})}{!projects.length&&<Empty>Create your first project to get started.</Empty>}</section></>}
 {tab==='Projects'&&<section><div className="section-head"><h2>Project registry</h2><button className="primary" onClick={()=>setRecordEditor({kind:'project'})}>+ Project</button></div>{recordEditor?.kind==='project'&&<RecordForm key={recordEditor.record?.id||'new'} editor={recordEditor} projects={projects} scope={scope} busy={busy} onClose={()=>setRecordEditor(null)} onSave={saveWorkspaceRecord}/>}<ProjectRegistry projects={projects.filter(p=>!scope||p.id===scope)} tasks={tasks} onEdit={p=>setRecordEditor({kind:'project',record:p})} onOpen={id=>{setScope(id);setTab('Tasks')}}/></section>}
 {tab==='Tasks'&&detail&&<TaskDetail task={detail} project={projects.find(p=>p.id===detail.project_id)} tasks={tasks} deps={deps} works={works} approvals={approvals} activity={activity} onEdit={()=>setEditor(detail)} onOpen={openDetail} onClose={()=>setDetailId(null)}/>}
 {tab==='Tasks'&&!detail&&<TasksView userId={session.user.id} scope={scope} projects={projects} tasks={tasks} works={works} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} mode={mode} setMode={setMode} setScope={setScope} busy={busy} loading={loading} activeTaskIds={activeTaskIds} projectName={projectName} blockers={blockers} openDetail={openDetail} bulkApply={bulkApply} changeStatus={changeStatus}/>}
 {tab==='Epics'&&<EpicOverview tasks={scoped(tasks)} onOpen={openDetail}/>}
 {tab==='Health'&&<HealthDashboard projects={projects.filter(p=>!scope||p.id===scope)} tasks={tasks} queue={queue} works={works} approvals={approvals} onOpen={id=>{setScope(id);setTab('Delivery');setDetailId(null)}}/>}
 {tab==='Execution queue'&&<section><p className="muted">Ready, dependency-complete and approved where required. No autonomous actions are triggered by this view.</p><p className="muted">{scoped(queue).length} eligible · {scoped(tasks).filter(t=>t.status==='ready'&&!queue.some(q=>q.id===t.id)).length} waiting on constraints</p><TaskTable rows={scoped(queue)} projectName={projectName} blockers={blockers} openDetail={openDetail}/><RankedQueue queue={scoped(queue)} deps={scoped(deps)} onOpen={openDetail}/></section>}
 {(tab==='Project memory'||tab==='Directives')&&<section><div className="section-head"><h2>{tab==='Directives'?'Project directives':'Persistent context'}</h2><button disabled={!projects.length} onClick={()=>setRecordEditor({kind:'memory',directives:tab==='Directives'})}>+ {tab==='Directives'?'Directive':'Memory'}</button></div>{tab==='Directives'&&<p className="muted">Persistent constraints and conventions for project work. These guide agent sessions, but do not grant execution permissions.</p>}{recordEditor?.kind==='memory'&&<RecordForm key={recordEditor.record?.id||'new-'+tab} editor={recordEditor} projects={projects} scope={scope} busy={busy} onClose={()=>setRecordEditor(null)} onSave={saveWorkspaceRecord}/>} {scoped(notes).filter(n=>tab!=='Directives'||['constraint','convention'].includes(n.category)).map(n=><article className="record" key={n.id}><div className="section-head"><small>{projectName(n.project_id)} / {readable(n.category)}</small><button onClick={()=>setRecordEditor({kind:'memory',record:n,directives:tab==='Directives'})}>Edit</button></div><h3>{n.title}</h3><p className="pre">{n.content}</p></article>)}{!scoped(notes).some(n=>tab!=='Directives'||['constraint','convention'].includes(n.category))&&<Empty>No entries in this view.</Empty>}</section>}
 {tab==='Dependencies'&&<section><p className="muted">Task prerequisites and their current status. Select a task to manage its dependencies.</p><DependencyGraph tasks={scoped(tasks)} deps={scoped(deps)} onOpen={openDetail}/><DependencyOverview tasks={scoped(tasks)} dependencies={scoped(deps)} projectName={projectName} onOpen={openDetail}/></section>}
 {tab==='Decisions'&&<section><div className="section-head"><h2>Architecture decisions</h2><button disabled={!projects.length} onClick={()=>setRecordEditor({kind:'decision'})}>+ Decision</button></div>{recordEditor?.kind==='decision'&&<RecordForm key={recordEditor.record?.id||'new'} editor={recordEditor} projects={projects} scope={scope} busy={busy} onClose={()=>setRecordEditor(null)} onSave={saveWorkspaceRecord}/>} {scoped(decisions).map(d=><article className="record" key={d.id}><div className="section-head"><small>{projectName(d.project_id)}</small><button onClick={()=>setRecordEditor({kind:'decision',record:d})}>Edit</button></div><h3>{d.title} {statusTag(d.status)}</h3><p className="pre">{d.rationale}</p><p className="pre">{d.outcome}</p></article>)}{!scoped(decisions).length&&<Empty>No decisions recorded.</Empty>}</section>}
 {tab==='AI sessions'&&<section>{scoped(works).map(w=><article className="record" key={w.id}><small>{projectName(w.project_id)} · {new Date(w.started_at).toLocaleString()}</small><h3>{statusTag(w.status)} {w.status==='active'&&Date.parse(w.lease_expires_at)<=Date.now()&&statusTag('blocked')}</h3><p className="muted">{w.status==='active'?'Lease expires: '+new Date(w.lease_expires_at).toLocaleString():''}</p><p className="pre">{w.summary}</p><p className="pre">Next: {w.next_step||'—'}</p></article>)}{!scoped(works).length&&<Empty>No work sessions recorded.</Empty>}</section>}
 {tab==='Handover'&&<Handover projects={projects} tasks={tasks} works={works} notes={notes} decisions={decisions} scope={scope}/>}
 {tab==='Repositories'&&<RepositoryPanel projects={projects} scope={scope} data={data} snapshots={snapshots} onImport={(id,value)=>setSnapshots(old=>({...old,[id]:value}))} onClear={id=>setSnapshots(old=>{const next={...old};delete next[id];return next})}/>}
 {tab==='AI context'&&<ContextPanel projects={projects} scope={scope} data={data} snapshots={snapshots}/>}
 {tab==='Delivery'&&<ProjectOperations data={data} queue={queue} scope={scope} onOpen={openDetail}/>}
 {tab==='Approvals'&&<section>{scoped(approvals).map(a=><article className="record" key={a.id}><small>{projectName(a.project_id)}</small><h3>{a.operation}</h3><p>{tasks.find(t=>t.id===a.task_id)?.title||'Task'}</p>{statusTag(a.status)}{a.status==='pending'&&<div className="actions"><button disabled={busy} onClick={()=>{if(window.confirm('Approve this operation?'))void mutate(()=>db.from('approvals').update({status:'approved'}).eq('id',a.id).eq('status','pending'))}}>Approve</button><button disabled={busy} onClick={()=>void mutate(()=>db.from('approvals').update({status:'rejected'}).eq('id',a.id).eq('status','pending'))}>Reject</button></div>}</article>)}{!scoped(approvals).length&&<Empty>No approval requests.</Empty>}</section>}
 {tab==='Settings'&&<SettingsPanel value={preferences.value} onChange={preferences.update} error={preferences.error}/>}
 {tab==='Activity'&&<ActivityTimeline rows={scoped(activity)} projects={projects} tasks={tasks} onOpen={openDetail}/>} 
 </WorkspaceShell>
 {palette&&<CommandPalette projects={projects} tasks={tasks} projectName={projectName} onNavigate={navigate} onProject={openProject} onTask={openDetail} onClose={()=>setPalette(false)}/>} 
 {editor&&<TaskEditor editor={editor} projects={projects} tasks={tasks} deps={deps} busy={busy} editorLocked={editorLocked} error={error} setEditor={setEditor} saveTask={saveTask} mutate={mutate}/>}
 </>
}
