import {db} from './supabase';
import type {Task,TaskDraft,Project,Note,Decision,Work,Approval,Activity,Dependency,EditableTable} from '../domain';
import {taskPayload,isManualTaskStatus,taskChanges,validateRecordPayload,singleMutationError} from '../domain';

import {readWithRetry,readPages} from './readPolicy';

// Browser projections, not generated full database schema types.
type ReadRowsByTable={
 projects:Project;tasks:Task;execution_queue:Task;project_memory:Note;
 decisions:Decision;work_sessions:Work;approvals:Approval;dependencies:Dependency;
};
type ReadTable=keyof ReadRowsByTable;
type RowField<T extends ReadTable>=Extract<keyof ReadRowsByTable[T],string>;
type OrderField<T extends ReadTable>=RowField<T>|(T extends 'decisions'|'approvals'?'created_at':never);
const taskColumns=['id','project_id','parent_id','kind','title','description','acceptance_criteria','next_step','branch','pr_url','test_result','status','priority','requires_approval','updated_at','created_at'] as const satisfies readonly RowField<'tasks'>[];
async function readRows<T extends ReadTable>(table:T,columns:readonly RowField<T>[],signal:AbortSignal,order:OrderField<T>,ascending=true,secondary:OrderField<T>,tertiary?:OrderField<T>):Promise<ReadRowsByTable[T][]>{
 return readPages<ReadRowsByTable[T]>(async(offset,size)=>{
  const data=await readWithRetry(async()=>{
   let query=db.from(table).select(columns.join(',')).order(order,{ascending});
   if(order!==secondary)query=query.order(secondary);
   if(tertiary&&tertiary!==order&&tertiary!==secondary)query=query.order(tertiary);
   return await query.range(offset,offset+size-1).abortSignal(signal);
  },signal);
  // Runtime schema is verified by isolated SQL and hosted REST integration gates.
  return (data??[]) as unknown as ReadRowsByTable[T][];
 },signal);
}
async function recentActivity(signal:AbortSignal):Promise<Activity[]>{
 const data=await readWithRetry(()=>db.from('activity_log').select('id,project_id,task_id,event,created_at,actor_source,details').order('created_at',{ascending:false}).order('id').limit(100).abortSignal(signal),signal);
 return (data??[]) as Activity[];
}
export async function loadWorkspace(signal:AbortSignal){
 const [projects,tasks,queue,notes,decisions,works,approvals,activity,deps]=await Promise.all([
  readRows('projects',['id','name','description','repository','status','updated_at'],signal,'name',true,'id'),
  readRows('tasks',taskColumns,signal,'priority',true,'created_at','id'),
  readRows('execution_queue',taskColumns,signal,'priority',true,'created_at','id'),
  readRows('project_memory',['id','project_id','title','content','category','updated_at'],signal,'updated_at',false,'id'),
  readRows('decisions',['id','project_id','title','rationale','outcome','status','updated_at'],signal,'created_at',false,'id'),
  readRows('work_sessions',['id','project_id','task_id','summary','next_step','status','started_at','heartbeat_at','lease_expires_at'],signal,'started_at',false,'id'),
  readRows('approvals',['id','project_id','task_id','operation','status','updated_at'],signal,'created_at',false,'id'),
  recentActivity(signal),
  readRows('dependencies',['project_id','task_id','depends_on_id'],signal,'task_id',true,'depends_on_id')
 ]);
 return {projects,tasks,queue,notes,decisions,works,approvals,activity,deps};
}
export type WorkspaceData=Awaited<ReturnType<typeof loadWorkspace>>;
export const emptyWorkspace:WorkspaceData={projects:[],tasks:[],queue:[],notes:[],decisions:[],works:[],approvals:[],activity:[],deps:[]};
export async function saveTaskRow(task:Task|TaskDraft,original:Task|TaskDraft){
 const payload=taskPayload(task);
 if(!('id' in task))return db.from('tasks').insert(payload);
 if(!task.updated_at)return {error:new Error('Refresh the workspace before editing this task.')};
 if(!('id' in original)||original.id!==task.id||original.project_id!==task.project_id||original.updated_at!==task.updated_at)return {error:new Error('Task editor revision is inconsistent. Reopen the task.')};
 const changes=taskChanges(original,task);
 if(!Object.keys(changes).length)return {error:new Error('No task changes to save.')};
 const result=await db.from('tasks').update(changes).eq('id',task.id).eq('updated_at',task.updated_at).select('id');
 return {error:singleMutationError(result,'Task changed in another session. Refresh and reopen the task.')};
}
export async function moveTask(task:Task,status:string){
 return updateTaskFields(task,{status});
}

export async function saveRecord(table:EditableTable,id:string|undefined,updatedAt:string|undefined,payload:Record<string,unknown>){
 const validated=validateRecordPayload(table,payload,!id);
 if(!id)return db.from(table).insert(validated);
 if(!updatedAt)return {error:new Error('Refresh before editing this record.')};
 const result=await db.from(table).update(validated).eq('id',id).eq('updated_at',updatedAt).select('id');
 return {error:singleMutationError(result,'Record changed in another session. Refresh and reopen it.')};
}

export async function updateTaskFields(task:Task,patch:{status?:string;priority?:number}){
 if(!task.updated_at)return {error:new Error('Refresh before updating this task.')};
 if(patch.status!==undefined&&!isManualTaskStatus(patch.status))return {error:new Error('Invalid manual status')};
 if(patch.priority!==undefined&&(!Number.isInteger(patch.priority)||patch.priority<0||patch.priority>4))return {error:new Error('Invalid priority')};
 const payload={...(patch.status!==undefined?{status:patch.status}:{}),...(patch.priority!==undefined?{priority:patch.priority}:{})};
 if(!Object.keys(payload).length)return {error:new Error('No changes requested')};
 const result=await db.from('tasks').update(payload).eq('id',task.id).eq('updated_at',task.updated_at).select('id');
 return {error:singleMutationError(result,'Task changed in another session. Refresh and try again.')};
}

export async function resolveApproval(approval:Approval,status:'approved'|'rejected'){
 if(!approval.updated_at)return {error:new Error('Refresh before resolving this approval.')};
 const result=await db.from('approvals').update({status}).eq('id',approval.id).eq('updated_at',approval.updated_at).eq('status','pending').select('id');
 return {error:singleMutationError(result,'Approval is no longer pending. Refresh the workspace.')};
}
export async function addDependency(dependency:Dependency){
 return db.from('dependencies').insert(dependency);
}
export async function removeDependency(dependency:Dependency){
 const result=await db.from('dependencies').delete().eq('project_id',dependency.project_id).eq('task_id',dependency.task_id).eq('depends_on_id',dependency.depends_on_id).select('task_id');
 return {error:singleMutationError(result,'Dependency is no longer present. Refresh the workspace.')};
}
