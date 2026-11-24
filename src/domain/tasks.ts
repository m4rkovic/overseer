import type {Task,TaskDraft,Dependency,Approval,Work} from './models.ts';
export const statuses=['backlog','ready','in_progress','blocked','review','done','cancelled'];
export const tabs=['Overview','Projects','Tasks','Epics','Health','Execution queue','Project memory','Directives','Dependencies','Decisions','AI sessions','Handover','AI context','Repositories','Delivery','Approvals','Activity','Settings'] as const;
export type Tab=typeof tabs[number];
export const blankTask=(project_id:string):Omit<Task,'id'>=>({project_id,parent_id:null,kind:'task',title:'',description:'',acceptance_criteria:'',next_step:'',branch:'',pr_url:'',test_result:'',status:'backlog',priority:2,requires_approval:false});
export const message=(e:unknown)=>e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):String(e);
export const readable=(s:string)=>s.replaceAll('_',' ');
export const taskFields=['project_id','parent_id','kind','title','description','acceptance_criteria','next_step','branch','pr_url','test_result','status','priority','requires_approval'] as const;
export function taskPayload(task:Task|TaskDraft):TaskDraft {
 const {project_id,parent_id,kind,title,description,acceptance_criteria,next_step,branch,pr_url,test_result,status,priority,requires_approval}=task;
 return {project_id,parent_id,kind,title:title.trim(),description,acceptance_criteria,next_step,branch,pr_url,test_result,status,priority,requires_approval};
}
export type TaskFilters={query:string;status:string;priority:string;kind:string;sort:'priority'|'title'|'newest'};
export const defaultFilters:TaskFilters={query:'',status:'',priority:'',kind:'',sort:'priority'};
export function filterTasks(tasks:readonly Task[],filters:TaskFilters):Task[] {
 const q=filters.query.trim().toLowerCase();
 const rows=tasks.filter(t=>(!q||[t.title,t.description,t.branch,t.next_step].join(' ').toLowerCase().includes(q))&&
 (!filters.status||t.status===filters.status)&&(!filters.priority||String(t.priority)===filters.priority)&&(!filters.kind||t.kind===filters.kind));
 return rows.sort((a,b)=>filters.sort==='title'?a.title.localeCompare(b.title)||a.id.localeCompare(b.id):filters.sort==='newest'?(b.created_at||'').localeCompare(a.created_at||'')||a.id.localeCompare(b.id):a.priority-b.priority||(a.created_at||'').localeCompare(b.created_at||'')||a.id.localeCompare(b.id));
}
export function buildTaskBlockerMap(all:readonly Task[],deps:readonly Dependency[],approvals:readonly Approval[],sessions:readonly Work[]):Map<string,string[]> {
 const byId=new Map(all.map(t=>[t.id,t])),result=new Map(all.map(t=>[t.id,t.status==='blocked'?['Task marked blocked']:[] as string[]]));
 for(const d of deps){
  const task=byId.get(d.task_id);if(!task||task.project_id!==d.project_id)continue;
  const prerequisite=byId.get(d.depends_on_id);
  if(!prerequisite||prerequisite.project_id!==task.project_id||prerequisite.status!=='done')result.get(task.id)!.push('Waiting for: '+(prerequisite?.project_id===task.project_id?prerequisite.title:'Unknown prerequisite'));
 }
 const approved=new Set(approvals.filter(a=>a.status==='approved').map(a=>a.project_id+':'+a.task_id));
 const active=new Set(sessions.filter(s=>s.status==='active').map(s=>s.task_id));
 for(const t of all){const reasons=result.get(t.id)!;if(t.requires_approval&&!approved.has(t.project_id+':'+t.id))reasons.push('Approval required');if(active.has(t.id))reasons.push('Active session');}
 return result;
}
export function taskBlockers(task:Task,all:readonly Task[],deps:readonly Dependency[],approvals:readonly Approval[],sessions:readonly Work[]):string[] {
 return buildTaskBlockerMap([...all.filter(t=>t.id!==task.id),task],deps,approvals,sessions).get(task.id)||[];
}
export function wouldCreateCycle(taskId:string,prerequisiteId:string,deps:readonly Dependency[]):boolean {
 const pending=[prerequisiteId],seen=new Set<string>();
 while(pending.length){const id=pending.pop()!;if(id===taskId)return true;if(seen.has(id))continue;seen.add(id);for(const d of deps)if(d.task_id===id)pending.push(d.depends_on_id);}
 return false;
}
export function wouldCreateParentCycle(taskId:string,parentId:string,tasks:readonly Task[]):boolean {
 const byId=new Map(tasks.map(t=>[t.id,t])),seen=new Set<string>();let id:string|null=parentId;
 while(id){if(id===taskId||seen.has(id))return true;seen.add(id);id=byId.get(id)?.parent_id||null;}return false;
}

export function isManualTaskStatus(status:string):boolean {
 return statuses.includes(status)&&status!=='in_progress';
}
export function groupTasksByStatus(tasks:readonly Task[]):Map<string,Task[]> {
 const groups=new Map<string,Task[]>();
 for(const task of tasks){
  const lane=groups.get(task.status)||[];
  lane.push(task);
  groups.set(task.status,lane);
 }
 return groups;
}

/** Compare normalized editable values; revision and ownership are never write fields. */
export function taskDraftEqual(a:Task|TaskDraft,b:Task|TaskDraft):boolean {
 const left=taskPayload(a),right=taskPayload(b);
 return taskFields.every(key=>left[key]===right[key]);
}
export function taskChanges(original:Task|TaskDraft,draft:Task|TaskDraft):Partial<Omit<TaskDraft,'project_id'>> {
 const before=taskPayload(original),after=taskPayload(draft);
 return Object.fromEntries(taskFields.filter(key=>key!=='project_id'&&before[key]!==after[key]).map(key=>[key,after[key]]));
}
/** A prerequisite cannot be the task itself, an existing prerequisite, or a task that transitively depends on it. */
export function dependencyCandidates(task:Task,tasks:readonly Task[],deps:readonly Dependency[]):Task[] {
 const reverse=new Map<string,string[]>(),excluded=new Set([task.id]);
 for(const dep of deps){
  if(dep.project_id!==task.project_id)continue;
  const dependents=reverse.get(dep.depends_on_id)||[];
  dependents.push(dep.task_id);
  reverse.set(dep.depends_on_id,dependents);
  if(dep.task_id===task.id)excluded.add(dep.depends_on_id);
 }
 const visited=new Set<string>(),pending=[task.id];
 for(let i=0;i<pending.length;i++){
  const id=pending[i];if(visited.has(id))continue;
  visited.add(id);excluded.add(id);
  for(const next of reverse.get(id)||[])if(!visited.has(next))pending.push(next);
 }
 return tasks.filter(t=>t.project_id===task.project_id&&!excluded.has(t.id));
}

