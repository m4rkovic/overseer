export type Project={id:string;name:string;description:string;repository:string;status:string;updated_at?:string};
export type Task={id:string;project_id:string;parent_id:string|null;kind:string;title:string;description:string;acceptance_criteria:string;next_step:string;branch:string;pr_url:string;test_result:string;status:string;priority:number;requires_approval:boolean;updated_at?:string;created_at?:string};
export type Note={id:string;project_id:string;title:string;content:string;category:string;updated_at?:string};
export type Decision={id:string;project_id:string;title:string;rationale:string;outcome:string;status:string;updated_at?:string};
export type Work={id:string;project_id:string;task_id:string|null;summary:string;next_step:string;status:string;started_at:string;heartbeat_at:string;lease_expires_at:string};
export type Approval={id:string;project_id:string;task_id:string;operation:string;status:string};
export type Activity={id:string;project_id:string;task_id:string|null;event:string;created_at:string;actor_source:string;details:{before?:Record<string,unknown>|null;after?:Record<string,unknown>|null}};
export type Dependency={project_id:string;task_id:string;depends_on_id:string};
export const statuses=['backlog','ready','in_progress','blocked','review','done','cancelled'];
export const tabs=['Overview','Projects','Tasks','Execution queue','Project memory','Directives','Dependencies','Decisions','AI sessions','Handover','Delivery','Approvals','Activity'] as const;
export type Tab=typeof tabs[number];
export const blankTask=(project_id:string):Omit<Task,'id'>=>({project_id,parent_id:null,kind:'task',title:'',description:'',acceptance_criteria:'',next_step:'',branch:'',pr_url:'',test_result:'',status:'backlog',priority:2,requires_approval:false});
export const message=(e:unknown)=>e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):String(e);
export const readable=(s:string)=>s.replaceAll('_',' ');
export function githubRepo(value:string){return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)?'https://github.com/'+value:null}
export function githubPR(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+\/?$/.test(u.pathname)?u.href:null}catch{return null}}


export type TaskDraft=Omit<Task,'id'|'created_at'|'updated_at'>;
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
export function taskBlockers(task:Task,all:readonly Task[],deps:readonly Dependency[],approvals:readonly Approval[],sessions:readonly Work[]):string[] {
 const reasons:string[]=[];
 const byId=new Map(all.map(t=>[t.id,t]));
 if(task.status==='blocked')reasons.push('Task marked blocked');
 for(const d of deps.filter(d=>d.task_id===task.id&&d.project_id===task.project_id)){
 const prereq=byId.get(d.depends_on_id);if(!prereq||prereq.status!=='done')reasons.push('Waiting for: '+(prereq?.title||'Unknown prerequisite'));
 }
 if(task.requires_approval&&!approvals.some(a=>a.task_id===task.id&&a.project_id===task.project_id&&a.status==='approved'))reasons.push('Approval required');
 if(sessions.some(s=>s.task_id===task.id&&s.status==='active'))reasons.push('Active session');
 return reasons;
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
