import React,{useEffect,useState,useMemo,lazy,Suspense} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db} from './lib/supabase';
import {statuses,blankTask,defaultFilters,buildTaskBlockerMap,wouldCreateParentCycle} from './domain';
import type {Task,TaskDraft,Tab,TaskFilters} from './domain';
import {Empty} from './components/primitives';
import {TaskEditor} from './components/TaskEditor';
import {saveTaskRow,moveTask,saveRecord,resolveApproval} from './lib/workspaceApi';
import {DependencyOverview} from './components/Records';
import type {RecordEditor,RecordSubmission} from './components/Records';

import type {BulkPatch} from './operations';
import {EpicOverview,HealthDashboard,ActivityTimeline} from './components/Planning';

import type {RepositorySnapshot} from './context';
import {usePreferences} from './lib/preferences';

import {useWorkspaceData} from './hooks/useWorkspaceData';
import {TaskTable,TasksView} from './components/TasksView';
import {WorkspaceShell} from './components/WorkspaceShell';
import {CommandPalette} from './components/CommandPalette';
import {ProjectsView,MemoryView,DecisionsView,SessionsView,ApprovalsView} from './components/RecordViews';
const DependencyGraph=lazy(()=>import('./components/Operations').then(m=>({default:m.DependencyGraph})));
const TaskDetail=lazy(()=>import('./components/Operations').then(m=>({default:m.TaskDetail})));
const ProjectOperations=lazy(()=>import('./components/Operations').then(m=>({default:m.ProjectOperations})));
const Handover=lazy(()=>import('./components/Operations').then(m=>({default:m.Handover})));
const RepositoryPanel=lazy(()=>import('./components/Context').then(m=>({default:m.RepositoryPanel})));
const ContextPanel=lazy(()=>import('./components/Context').then(m=>({default:m.ContextPanel})));
const RankedQueue=lazy(()=>import('./components/Context').then(m=>({default:m.RankedQueue})));
const SettingsPanel=lazy(()=>import('./components/Settings').then(m=>({default:m.SettingsPanel})));
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
 const projectNames=useMemo(()=>new Map(projects.map(p=>[p.id,p.name])),[projects]);
 const projectName=(id:string)=>projectNames.get(id)||'Unknown project';
 const detail=tasks.find(t=>t.id===detailId);
 const queueIds=useMemo(()=>new Set(queue.map(t=>t.id)),[queue]);
 function openDetail(task:Task){setDetailId(task.id);setTab('Tasks');setScope(task.project_id);setPalette(false);}
 const bulkApply=(rows:Task[],patch:BulkPatch)=>applyBulk(rows,patch,activeTaskIds);
 async function saveTask(e:React.FormEvent,original:Task|TaskDraft){
  e.preventDefault();if(!editor||editorLocked||loading||busy)return;
  if(!editor.title.trim())return;
  if(editor.status==='in_progress'&&(!('id' in editor)||tasks.find(t=>t.id===editor.id)?.status!=='in_progress')){setError('Start work through the agent claim, not manual status editing.');return;}
  if('id' in editor&&editor.parent_id&&wouldCreateParentCycle(editor.id,editor.parent_id,tasks)){setError('Parent relationship would create a cycle.');return;}
  if(await mutate(()=>saveTaskRow(editor,original)))setEditor(null);
 }
 async function changeStatus(id:string,status:string){
  const task=tasks.find(t=>t.id===id);
  if(!task||task.status===status||activeTaskIds.has(id)||!statuses.includes(status))return;
  if(status==='in_progress'){setError('Start work through the execution queue / agent claim, not a manual drag.');return;}
  await mutate(()=>moveTask(task,status));
 }
 function newTask(){if(projects.length)setEditor(blankTask(projects.some(p=>p.id===scope)?scope:projects[0].id));else{setTab('Projects');setRecordEditor({kind:'project'})}}
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

 function navigate(next:Tab){setTab(next);setSearch('');setRecordEditor(null);setDetailId(null);setPalette(false);}
 function openProject(id:string){setScope(id);navigate('Tasks');}
 return <>
 <WorkspaceShell tab={tab} scope={scope} projects={projects} email={session.user.email} preferences={preferences.value} busy={busy} loading={loading} notice={notice} error={error} modalOpen={!!editor||palette} onNavigate={navigate} onScope={id=>{setScope(id);setDetailId(null);setRecordEditor(null)}} onSignOut={()=>{void db.auth.signOut().then(({error})=>{if(error)setError(error.message)}).catch(()=>setError('Unable to sign out. Try again.'))}} onRefresh={()=>void refresh()} onSearch={()=>setPalette(true)} onNewTask={newTask}>
 <Suspense fallback={<p className="muted" role="status">Loading view…</p>}>
 {tab==='Overview'&&<><div className="metrics">{[['Projects',projects.filter(p=>!scope||p.id===scope).length],['Open tasks',scoped(tasks).filter(t=>!['done','cancelled'].includes(t.status)).length],['Ready',scoped(queue).length],['Blocked',scoped(tasks).filter(t=>t.status==='blocked').length]].map(([label,value])=><div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</div><section><div className="section-head"><h2>Execution queue</h2><button onClick={()=>setTab('Execution queue')}>View all</button></div><TaskTable rows={scoped(queue).slice(0,8)} projectName={projectName} blockers={blockers} openDetail={openDetail}/></section><section><h2>Active projects</h2>{projects.filter(p=>p.status==='active'&&(!scope||p.id===scope)).map(p=>{const rows=tasks.filter(t=>t.project_id===p.id&&t.kind!=='epic'&&t.status!=='cancelled');const done=rows.filter(t=>t.status==='done').length;return <div className="project-line" key={p.id}><button className="text-button" onClick={()=>{setScope(p.id);setTab('Tasks')}}>{p.name}</button><span className="muted">{done}/{rows.length} complete</span><progress value={done} max={Math.max(1,rows.length)}/></div>})}{!projects.length&&<Empty>Create your first project to get started.</Empty>}</section></>}
 {tab==='Projects'&&<ProjectsView projects={projects} scope={scope} busy={busy||loading} editor={recordEditor} onEdit={setRecordEditor} onSave={saveWorkspaceRecord} tasks={tasks} onOpen={openProject}/>}
 {tab==='Tasks'&&detail&&<TaskDetail task={detail} project={projects.find(p=>p.id===detail.project_id)} tasks={tasks} deps={deps} works={works} approvals={approvals} activity={activity} onEdit={()=>setEditor(detail)} onOpen={openDetail} onClose={()=>setDetailId(null)}/>}
 {tab==='Tasks'&&!detail&&<TasksView userId={session.user.id} scope={scope} projects={projects} tasks={tasks} works={works} filters={filters} setFilters={setFilters} search={search} setSearch={setSearch} mode={mode} setMode={setMode} setScope={setScope} busy={busy} loading={loading} activeTaskIds={activeTaskIds} projectName={projectName} blockers={blockers} openDetail={openDetail} bulkApply={bulkApply} changeStatus={changeStatus}/>}
 {tab==='Epics'&&<EpicOverview tasks={scoped(tasks)} onOpen={openDetail}/>}
 {tab==='Health'&&<HealthDashboard projects={projects.filter(p=>!scope||p.id===scope)} tasks={tasks} queue={queue} works={works} approvals={approvals} onOpen={id=>{setScope(id);setTab('Delivery');setDetailId(null)}}/>}
 {tab==='Execution queue'&&<section><p className="muted">Ready, dependency-complete and approved where required. No autonomous actions are triggered by this view.</p><p className="muted">{scoped(queue).length} eligible · {scoped(tasks).filter(t=>t.status==='ready'&&!queueIds.has(t.id)).length} waiting on constraints</p><TaskTable rows={scoped(queue)} projectName={projectName} blockers={blockers} openDetail={openDetail}/><RankedQueue queue={scoped(queue)} deps={scoped(deps)} onOpen={openDetail}/></section>}
 {(tab==='Project memory'||tab==='Directives')&&<MemoryView projects={projects} scope={scope} busy={busy||loading} editor={recordEditor} onEdit={setRecordEditor} onSave={saveWorkspaceRecord} notes={scoped(notes)} directives={tab==='Directives'} projectName={projectName}/>}
 {tab==='Dependencies'&&<section><p className="muted">Task prerequisites and their current status. Select a task to manage its dependencies.</p><DependencyGraph tasks={scoped(tasks)} deps={scoped(deps)} onOpen={openDetail}/><DependencyOverview tasks={scoped(tasks)} dependencies={scoped(deps)} projectName={projectName} onOpen={openDetail}/></section>}
 {tab==='Decisions'&&<DecisionsView projects={projects} scope={scope} busy={busy||loading} editor={recordEditor} onEdit={setRecordEditor} onSave={saveWorkspaceRecord} decisions={scoped(decisions)} projectName={projectName}/>}
 {tab==='AI sessions'&&<SessionsView works={scoped(works)} projectName={projectName}/>}
 {tab==='Handover'&&<Handover projects={projects} tasks={tasks} works={works} notes={notes} decisions={decisions} scope={scope}/>}
 {tab==='Repositories'&&<RepositoryPanel projects={projects} scope={scope} data={data} snapshots={snapshots} onImport={(id,value)=>setSnapshots(old=>({...old,[id]:value}))} onClear={id=>setSnapshots(old=>{const next={...old};delete next[id];return next})}/>}
 {tab==='AI context'&&<ContextPanel projects={projects} scope={scope} data={data} snapshots={snapshots}/>}
 {tab==='Delivery'&&<ProjectOperations data={data} queue={queue} scope={scope} onOpen={openDetail}/>}
 {tab==='Approvals'&&<ApprovalsView approvals={scoped(approvals)} tasks={tasks} projectName={projectName} busy={busy||loading} onResolve={(approval,status)=>void mutate(()=>resolveApproval(approval,status))}/>}
 {tab==='Settings'&&<SettingsPanel value={preferences.value} onChange={preferences.update} error={preferences.error}/>}
 {tab==='Activity'&&<ActivityTimeline rows={scoped(activity)} projects={projects} tasks={tasks} onOpen={openDetail}/>} 
 </Suspense>
 </WorkspaceShell>
 {palette&&<CommandPalette projects={projects} tasks={tasks} projectName={projectName} onNavigate={navigate} onProject={openProject} onTask={openDetail} onClose={()=>setPalette(false)}/>} 
 {editor&&<TaskEditor editor={editor} projects={projects} tasks={tasks} deps={deps} busy={busy||loading} editorLocked={editorLocked} error={error} setEditor={setEditor} saveTask={saveTask} mutate={mutate}/>}
 </>
}
