import {useMemo,useRef} from 'react';
import type {FormEvent} from 'react';
import {addDependency,removeDependency} from '../lib/workspaceApi';
import {statuses,readable,githubPR,wouldCreateParentCycle,taskDraftEqual,dependencyCandidates} from '../domain';
import type {Task,TaskDraft,Project,Dependency} from '../domain';
import {Field} from './primitives';
import {TemplatePicker} from './Planning';
import {useModalFocus} from '../hooks/useModalFocus';

type Props={
 editor:Task|TaskDraft;
 projects:Project[];
 tasks:Task[];
 deps:Dependency[];
 busy:boolean;
 editorLocked:boolean;
 error:string;
 setEditor:(value:Task|TaskDraft|null)=>void;
 saveTask:(event:FormEvent,original:Task|TaskDraft)=>void|Promise<void>;
 mutate:(fn:()=>PromiseLike<{error:unknown}>)=>Promise<boolean>;
};

function TaskDependencies({task,tasks,deps,disabled,mutate}:{task:Task;tasks:Task[];deps:Dependency[];disabled:boolean;mutate:Props['mutate']}){
 const candidates=useMemo(()=>dependencyCandidates(task,tasks,deps),[task.id,task.project_id,tasks,deps]);
 const names=useMemo(()=>new Map(tasks.map(t=>[t.id,t.title])),[tasks]);
 const existing=deps.filter(d=>d.project_id===task.project_id&&d.task_id===task.id);
 return <div>
  <h3>Dependencies</h3>
  <p className="muted">Dependency changes save immediately, separately from task fields. Save or discard task edits first.</p>
  {existing.map(d=><p key={d.depends_on_id}>{names.get(d.depends_on_id)||'Task'} <button type="button" disabled={disabled} onClick={()=>void mutate(()=>removeDependency(d))}>Remove</button></p>)}
  <Field label="Add prerequisite"><select value="" disabled={disabled} onChange={e=>{
   const id=e.target.value;
   if(candidates.some(t=>t.id===id))void mutate(()=>addDependency({project_id:task.project_id,task_id:task.id,depends_on_id:id}));
  }}><option value="">Select task</option>{candidates.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
 </div>;
}

export function TaskEditor({editor,projects,tasks,deps,busy,editorLocked,error,setEditor,saveTask,mutate}:Props){
 const panelRef=useRef<HTMLElement|null>(null);
 const original=useRef(editor);
 const dirty=!taskDraftEqual(original.current,editor);
 const editing='id' in editor;
 const current=editing?tasks.find(t=>t.id===editor.id):undefined;
 const stale=editing&&(!current||current.updated_at!==editor.updated_at);
 const disabled=busy||editorLocked||stale;
 const close=()=>{
  if(busy)return;
  if(dirty&&!window.confirm('Discard unsaved task changes?'))return;
  setEditor(null);
 };
 useModalFocus(panelRef,close,busy,'input:not(:disabled)');
 const parentOptions=useMemo(()=>tasks.filter(t=>t.project_id===editor.project_id&&(!('id' in editor)||t.id!==editor.id&&!wouldCreateParentCycle(editor.id,t.id,tasks))),[tasks,editor.project_id,editing?editor.id:null]);
 const pr=githubPR(editor.pr_url);
 return <div className="overlay">
  <section ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Task editor" className="drawer">
   <div className="section-head"><h2>{editing?'Edit task':'New task'}</h2><button disabled={busy} onClick={close}>Close</button></div>
   {error&&<p role="alert" className="error">{error}</p>}
   {editorLocked&&<p className="notice">This task has an active work session. Editing is disabled until it is finished or recovered.</p>}
   {stale&&<p className="notice">A newer task revision is available. Copy any unsaved text, close and reopen the editor before making changes.</p>}
   <form onSubmit={e=>{e.preventDefault();if(!disabled&&dirty)void saveTask(e,original.current)}}>
    <fieldset disabled={disabled} className="editor-fields">
     {!editing&&<TemplatePicker draft={editor} onChange={setEditor}/>}
     <Field label="Project"><select disabled={editing} value={editor.project_id} onChange={e=>setEditor({...editor,project_id:e.target.value,parent_id:null})}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
     <Field label="Title"><input required maxLength={240} value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})}/></Field>
     <div className="form-grid">
      <Field label="Type"><select value={editor.kind} onChange={e=>setEditor({...editor,kind:e.target.value})}>{['epic','task','subtask'].map(k=><option key={k}>{k}</option>)}</select></Field>
      <Field label="Priority"><select value={editor.priority} onChange={e=>setEditor({...editor,priority:Number(e.target.value)})}>{[0,1,2,3,4].map(p=><option key={p} value={p}>P{p}</option>)}</select></Field>
      <Field label="Status"><select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value})}>{statuses.filter(s=>s!=='in_progress'||editor.status==='in_progress').map(s=><option key={s} value={s}>{readable(s)}</option>)}</select></Field>
     </div>
     <Field label="Parent"><select value={editor.parent_id||''} onChange={e=>setEditor({...editor,parent_id:e.target.value||null})}><option value="">None</option>{parentOptions.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></Field>
     {(['description','acceptance_criteria','next_step','branch','pr_url','test_result'] as const).map(k=><Field label={readable(k)} key={k}><textarea rows={k==='description'||k==='acceptance_criteria'?3:2} value={editor[k]} onChange={e=>setEditor({...editor,[k]:e.target.value})}/></Field>)}
     <label className="checkbox"><input type="checkbox" checked={editor.requires_approval} onChange={e=>setEditor({...editor,requires_approval:e.target.checked})}/> Requires approval</label>
     {pr&&<a href={pr} target="_blank" rel="noreferrer">Open pull request ↗</a>}
     <button className="primary" disabled={disabled||!dirty||!editor.title.trim()}>Save task</button>
    </fieldset>
   </form>
   {editing&&<TaskDependencies task={editor} tasks={tasks} deps={deps} disabled={disabled||dirty} mutate={mutate}/>}
  </section>
 </div>;
}
