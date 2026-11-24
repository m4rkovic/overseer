import type {Task,TaskDraft,TaskFilters,Activity,Work,Approval,Project} from './domain';

export const templates=[
 {id:'feature',label:'Feature',title:'',description:'Goal and scope:\n',acceptance_criteria:'- Intended behavior is implemented.\n- Existing behavior is preserved.\n- Regression tests pass.',next_step:'Inspect existing implementation and define scope.',priority:2,requires_approval:false},
 {id:'bug',label:'Bug fix',title:'',description:'Observed behavior:\nExpected behavior:\nReproduction steps:\n',acceptance_criteria:'- Reproduction is documented.\n- Root cause is fixed.\n- Regression test covers the failure.',next_step:'Reproduce and isolate the issue.',priority:1,requires_approval:false},
 {id:'refactor',label:'Refactoring',title:'',description:'Target module:\nBehavior to preserve:\n',acceptance_criteria:'- Public behavior is unchanged.\n- Existing and new tests pass.\n- Changes remain reviewable.',next_step:'Establish baseline tests and inspect dependencies.',priority:2,requires_approval:false},
 {id:'release',label:'Release preparation',title:'',description:'Release scope:\nTarget environment:\n',acceptance_criteria:'- Build and regression checks pass.\n- Release notes are prepared.\n- Actual user authorization is verified before publication.',next_step:'Check release prerequisites; do not publish without authorization.',priority:1,requires_approval:true}
] as const;
export function applyTemplate(draft:TaskDraft,id:string):TaskDraft{
 const template=templates.find(t=>t.id===id);if(!template)return draft;
 return {...draft,description:template.description,acceptance_criteria:template.acceptance_criteria,next_step:template.next_step,priority:template.priority,requires_approval:template.requires_approval};
}
export function epicProgress(epic:Task,tasks:readonly Task[]){
 const children=new Map<string,Task[]>();
 for(const task of tasks)if(task.project_id===epic.project_id&&task.parent_id){const rows=children.get(task.parent_id)||[];rows.push(task);children.set(task.parent_id,rows)}
 const seen=new Set([epic.id]),pending=[...(children.get(epic.id)||[])],descendants:Task[]=[];
 for(let i=0;i<pending.length;i++){const t=pending[i];if(seen.has(t.id))continue;seen.add(t.id);if(t.kind!=='epic'&&t.status!=='cancelled')descendants.push(t);pending.push(...(children.get(t.id)||[]))}
 const done=descendants.filter(t=>t.status==='done').length;
 return {total:descendants.length,done,blocked:descendants.filter(t=>t.status==='blocked').length,descendants};
}
export function projectHealth(project:Project,tasks:readonly Task[],queue:readonly Task[],works:readonly Work[],approvals:readonly Approval[],now:number){
 const rows=tasks.filter(t=>t.project_id===project.id&&t.kind!=='epic'&&!['done','cancelled'].includes(t.status));
 const ids=new Set(rows.map(t=>t.id));
 const ready=queue.filter(t=>ids.has(t.id)).length;
 const waiting=rows.filter(t=>t.status==='ready').length-ready;
 const expired=works.filter(w=>w.project_id===project.id&&w.status==='active'&&Date.parse(w.lease_expires_at)<=now).length;
 const blocked=rows.filter(t=>t.status==='blocked').length;
 const pending=approvals.filter(a=>a.project_id===project.id&&a.status==='pending'&&ids.has(a.task_id)).length;
 const missingNext=rows.filter(t=>!t.next_step.trim()).length;
 return {open:rows.length,ready,waiting:Math.max(0,waiting),expired,blocked,pending,missingNext};
}
export type ActivityFilters={query:string;entity:string;actor:string;operation:string;since:string};
export const emptyActivityFilters:ActivityFilters={query:'',entity:'',actor:'',operation:'',since:''};
export function filterActivity(rows:readonly Activity[],filters:ActivityFilters,names:ReadonlyMap<string,string>,now:number){
 const q=filters.query.trim().toLowerCase();const days=Number(filters.since);
 return rows.filter(a=>{
  const [entity,op]=a.event.split('.');
  if(filters.entity&&entity!==filters.entity||filters.actor&&a.actor_source!==filters.actor||filters.operation&&op!==filters.operation)return false;
  if(filters.since&&Number.isFinite(days)&&Date.parse(a.created_at)<now-days*86400000)return false;
  return !q||[a.event,a.actor_source,names.get(a.project_id)||'',a.task_id?names.get(a.task_id)||'':'',JSON.stringify(a.details)].join(' ').toLowerCase().includes(q);
 });
}
export type ViewMode='table'|'board'|'bulk';
export type SavedView={id:string;name:string;scope:string;filters:TaskFilters;mode:ViewMode};
export function parseViews(raw:string|null):SavedView[]{
 if(!raw)return [];
 try{const rows:unknown=JSON.parse(raw);if(!Array.isArray(rows))return [];
 return rows.filter((v):v is SavedView=>{
  if(!v||typeof v!=='object'||typeof v.id!=='string'||typeof v.name!=='string'||typeof v.scope!=='string'||!['table','board','bulk'].includes(v.mode))return false;
  const f=v.filters;return !!f&&typeof f.query==='string'&&['','backlog','ready','in_progress','blocked','review','done','cancelled'].includes(f.status)&&['','0','1','2','3','4'].includes(f.priority)&&['','epic','task','subtask'].includes(f.kind)&&['priority','title','newest'].includes(f.sort);
 }).slice(0,30)}catch{return []}
}
