import type {FormEvent} from 'react';
import {Field,Empty} from './primitives';
import {readable,githubRepo} from '../domain';
import type {Project,Note,Decision,Task,Dependency} from '../domain';

export type RecordEditor={kind:'project';record?:Project}|{kind:'memory';record?:Note;directives?:boolean}|{kind:'decision';record?:Decision};
export type RecordSubmission={table:'projects'|'project_memory'|'decisions';id?:string;updatedAt?:string;payload:Record<string,unknown>};
export function RecordForm({editor,projects,scope,busy,onClose,onSave}:{editor:RecordEditor;projects:Project[];scope:string;busy:boolean;onClose:()=>void;onSave:(value:RecordSubmission)=>Promise<boolean>}){
 const record=editor.record;
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();const f=new FormData(e.currentTarget);const get=(name:string)=>String(f.get(name)??'').trim();
  let value:RecordSubmission;
  if(editor.kind==='project'){
   if(!get('name'))return;
   value={table:'projects',id:record?.id,updatedAt:record?.updated_at,payload:{name:get('name'),description:get('description'),repository:get('repository'),status:get('status')}};
  }else if(editor.kind==='memory'){
   if(!get('title')||!get('content'))return;
   value={table:'project_memory',id:record?.id,updatedAt:record?.updated_at,payload:{title:get('title'),content:get('content'),category:get('category'),...(!record?{project_id:get('project_id')}:{})}};
  }else{
   if(!get('title')||!get('rationale'))return;
   value={table:'decisions',id:record?.id,updatedAt:record?.updated_at,payload:{title:get('title'),rationale:get('rationale'),outcome:get('outcome'),status:get('status'),...(!record?{project_id:get('project_id')}:{})}};
  }
  if(await onSave(value))onClose();
 }
 return <form className="inline-form" onSubmit={submit}>
  <div className="section-head"><h3>{record?'Edit':'New'} {editor.kind==='memory'&&editor.directives?'directive':editor.kind}</h3><button type="button" onClick={onClose}>Close</button></div>
  <fieldset disabled={busy} className="editor-fields">
  {editor.kind==='project'?<>
   <Field label="Name"><input name="name" required maxLength={120} defaultValue={editor.record?.name}/></Field>
   <Field label="Repository (owner/name)"><input name="repository" pattern="[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+" defaultValue={editor.record?.repository}/></Field>
   <Field label="Description"><textarea name="description" defaultValue={editor.record?.description}/></Field>
   <Field label="Status"><select name="status" defaultValue={editor.record?.status||'active'}>{['active','paused','archived'].map(s=><option key={s}>{s}</option>)}</select></Field>
  </>:<>
   {!record&&<Field label="Project"><select name="project_id" required defaultValue={scope||projects[0]?.id}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
   <Field label="Title"><input name="title" required defaultValue={editor.record?.title}/></Field>
   {editor.kind==='memory'?<>
    <Field label="Category"><select name="category" defaultValue={editor.record?.category||(editor.directives?'constraint':'context')}>{(editor.directives?['constraint','convention']:['context','architecture','constraint','convention','known_issue']).map(c=><option key={c} value={c}>{readable(c)}</option>)}</select></Field>
    <Field label="Content"><textarea name="content" rows={6} required defaultValue={editor.record?.content}/></Field>
   </>:<>
    <Field label="Rationale"><textarea name="rationale" rows={4} required defaultValue={editor.record?.rationale}/></Field>
    <Field label="Outcome"><textarea name="outcome" rows={4} defaultValue={editor.record?.outcome}/></Field>
    <Field label="Status"><select name="status" defaultValue={editor.record?.status||'proposed'}>{['proposed','accepted','superseded','rejected'].map(s=><option key={s}>{s}</option>)}</select></Field>
   </>}
  </>}
  <button className="primary" disabled={busy}>Save</button></fieldset>
 </form>;
}

export function ProjectRegistry({projects,tasks,onEdit,onOpen}:{projects:Project[];tasks:Task[];onEdit:(p:Project)=>void;onOpen:(id:string)=>void}){
 return projects.length?<div className="registry">{projects.map(p=>{const rows=tasks.filter(t=>t.project_id===p.id&&t.kind!=='epic'&&t.status!=='cancelled');const done=rows.filter(t=>t.status==='done').length;const repo=githubRepo(p.repository);return <article className="record" key={p.id}>
 <div className="section-head"><h3>{p.name}</h3><span className={'status '+p.status}>{p.status}</span></div>
 <p>{p.description||'No description'}</p><small>{repo?<a href={repo} target="_blank" rel="noreferrer">{p.repository} ↗</a>:p.repository||'No repository linked'}</small>
 <div className="project-progress"><progress value={done} max={Math.max(rows.length,1)}/><small>{done}/{rows.length} complete</small></div>
 <div className="actions"><button onClick={()=>onOpen(p.id)}>Open tasks</button><button onClick={()=>onEdit(p)}>Edit</button>{repo&&<a href={repo+'/pulls'} target="_blank" rel="noreferrer">Pull requests ↗</a>}</div></article>})}</div>:<Empty>No projects yet.</Empty>;
}

export function DependencyOverview({tasks,dependencies,projectName,onOpen}:{tasks:Task[];dependencies:Dependency[];projectName:(id:string)=>string;onOpen:(t:Task)=>void}){
 const byId=new Map(tasks.map(t=>[t.id,t]));
 const groups=tasks.filter(t=>dependencies.some(d=>d.task_id===t.id));
 return groups.length?<div className="dependency-list">{groups.map(t=><article className="record" key={t.id}><div className="section-head"><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button><small>{projectName(t.project_id)}</small></div><p className="muted">Depends on</p>{dependencies.filter(d=>d.task_id===t.id).map(d=>{const prereq=byId.get(d.depends_on_id);return <div className="dependency-edge" key={d.depends_on_id}><span aria-hidden="true">↳</span>{prereq?<button className="text-button" onClick={()=>onOpen(prereq)}>{prereq.title}</button>:<span>Unknown prerequisite</span>}<span className={'status '+(prereq?.status||'blocked')}>{readable(prereq?.status||'unknown')}</span></div>})}</article>)}</div>:<Empty>No task dependencies in this view.</Empty>;
}
