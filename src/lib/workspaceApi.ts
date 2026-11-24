import {db} from './supabase';
import type {Task,TaskDraft,Project,Note,Decision,Work,Approval,Activity,Dependency} from '../domain';
import {taskPayload,isManualTaskStatus} from '../domain';

import {readWithRetry,readPages} from './readPolicy';

const taskColumns='id,project_id,parent_id,kind,title,description,acceptance_criteria,next_step,branch,pr_url,test_result,status,priority,requires_approval,updated_at,created_at';
async function readRows<T>(table:string,columns:string,signal:AbortSignal,order:string,ascending=true,secondary='id',tertiary?:string):Promise<T[]>{
 return readPages<T>(async(offset,size)=>{
  const data=await readWithRetry(async()=>{
   let query=db.from(table).select(columns).order(order,{ascending});
   if(order!==secondary)query=query.order(secondary);
   if(tertiary&&tertiary!==order&&tertiary!==secondary)query=query.order(tertiary);
   return await query.range(offset,offset+size-1).abortSignal(signal);
  },signal);
  return (data??[]) as unknown as T[];
 },signal);
}
async function recentActivity(signal:AbortSignal):Promise<Activity[]>{
 const data=await readWithRetry(()=>db.from('activity_log').select('id,project_id,task_id,event,created_at,actor_source,details').order('created_at',{ascending:false}).order('id').limit(100).abortSignal(signal),signal);
 return (data??[]) as Activity[];
}
export async function loadWorkspace(signal:AbortSignal){
 const [projects,tasks,queue,notes,decisions,works,approvals,activity,deps]=await Promise.all([
  readRows<Project>('projects','id,name,description,repository,status,updated_at',signal,'name'),
  readRows<Task>('tasks',taskColumns,signal,'priority',true,'created_at','id'),
  readRows<Task>('execution_queue',taskColumns,signal,'priority',true,'created_at','id'),
  readRows<Note>('project_memory','id,project_id,title,content,category,updated_at',signal,'updated_at',false),
  readRows<Decision>('decisions','id,project_id,title,rationale,outcome,status,updated_at',signal,'created_at',false),
  readRows<Work>('work_sessions','id,project_id,task_id,summary,next_step,status,started_at,heartbeat_at,lease_expires_at',signal,'started_at',false),
  readRows<Approval>('approvals','id,project_id,task_id,operation,status,updated_at',signal,'created_at',false),
  recentActivity(signal),
  readRows<Dependency>('dependencies','project_id,task_id,depends_on_id',signal,'task_id',true,'depends_on_id')
 ]);
 return {projects,tasks,queue,notes,decisions,works,approvals,activity,deps};
}
export type WorkspaceData=Awaited<ReturnType<typeof loadWorkspace>>;
export const emptyWorkspace:WorkspaceData={projects:[],tasks:[],queue:[],notes:[],decisions:[],works:[],approvals:[],activity:[],deps:[]};
export async function saveTaskRow(task:Task|TaskDraft){
 const payload=taskPayload(task);
 if(!('id' in task))return db.from('tasks').insert(payload);
 if(!task.updated_at)return {error:new Error('Refresh the workspace before editing this task.')};
 const result=await db.from('tasks').update(payload).eq('id',task.id).eq('updated_at',task.updated_at).select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Task changed in another session. Refresh and reopen the task.'):null)};
}
export async function moveTask(task:Task,status:string){
 return updateTaskFields(task,{status});
}

type EditableTable='projects'|'project_memory'|'decisions';
export async function saveRecord(table:EditableTable,id:string|undefined,updatedAt:string|undefined,payload:Record<string,unknown>){
 if(!id)return db.from(table).insert(payload);
 if(!updatedAt)return {error:new Error('Refresh before editing this record.')};
 const result=await db.from(table).update(payload).eq('id',id).eq('updated_at',updatedAt).select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Record changed in another session. Refresh and reopen it.'):null)};
}

export async function updateTaskFields(task:Task,patch:{status?:string;priority?:number}){
 if(!task.updated_at)return {error:new Error('Refresh before updating this task.')};
 if(patch.status!==undefined&&!isManualTaskStatus(patch.status))return {error:new Error('Invalid manual status')};
 if(patch.priority!==undefined&&(!Number.isInteger(patch.priority)||patch.priority<0||patch.priority>4))return {error:new Error('Invalid priority')};
 const payload={...(patch.status!==undefined?{status:patch.status}:{}),...(patch.priority!==undefined?{priority:patch.priority}:{})};
 if(!Object.keys(payload).length)return {error:new Error('No changes requested')};
 const result=await db.from('tasks').update(payload).eq('id',task.id).eq('updated_at',task.updated_at).select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Task changed in another session. Refresh and try again.'):null)};
}

export async function resolveApproval(approval:Approval,status:'approved'|'rejected'){
 if(!approval.updated_at)return {error:new Error('Refresh before resolving this approval.')};
 const result=await db.from('approvals').update({status}).eq('id',approval.id).eq('updated_at',approval.updated_at).eq('status','pending').select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Approval is no longer pending. Refresh the workspace.'):null)};
}
export async function addDependency(dependency:Dependency){
 return db.from('dependencies').insert(dependency);
}
export async function removeDependency(dependency:Dependency){
 const result=await db.from('dependencies').delete().eq('project_id',dependency.project_id).eq('task_id',dependency.task_id).eq('depends_on_id',dependency.depends_on_id).select('task_id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Dependency is no longer present. Refresh the workspace.'):null)};
}
