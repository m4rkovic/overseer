import {db} from './supabase';
import type {Task,TaskDraft,Project,Note,Decision,Work,Approval,Activity,Dependency} from '../domain';
import {taskPayload} from '../domain';

const PAGE_SIZE=500;
async function readRows<T>(table:string,order:string,ascending=true,secondary='id',tertiary?:string):Promise<T[]> {
 const out:T[]=[];
 for(let offset=0;;offset+=PAGE_SIZE){
  let query=db.from(table).select('*').order(order,{ascending});
  if(order!==secondary)query=query.order(secondary);
  if(tertiary&&tertiary!==order&&tertiary!==secondary)query=query.order(tertiary);
  const {data,error}=await query.range(offset,offset+PAGE_SIZE-1);
  if(error)throw error;
  const rows=(data??[]) as unknown as T[];
  out.push(...rows);
  if(rows.length<PAGE_SIZE)return out;
 }
}
async function recentActivity():Promise<Activity[]> {
 const {data,error}=await db.from('activity_log').select('*').order('created_at',{ascending:false}).order('id').limit(100);
 if(error)throw error;return (data??[]) as Activity[];
}
export async function loadWorkspace(){
 const [projects,tasks,queue,notes,decisions,works,approvals,activity,deps]=await Promise.all([
  readRows<Project>('projects','name'),readRows<Task>('tasks','priority',true,'created_at','id'),readRows<Task>('execution_queue','priority',true,'created_at','id'),
  readRows<Note>('project_memory','updated_at',false),readRows<Decision>('decisions','created_at',false),
  readRows<Work>('work_sessions','started_at',false),readRows<Approval>('approvals','created_at',false),
  recentActivity(),readRows<Dependency>('dependencies','task_id',true,'depends_on_id')
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
 if(patch.status!==undefined&&!['backlog','ready','blocked','review','done','cancelled'].includes(patch.status))return {error:new Error('Invalid manual status')};
 if(patch.priority!==undefined&&(!Number.isInteger(patch.priority)||patch.priority<0||patch.priority>4))return {error:new Error('Invalid priority')};
 const payload={...(patch.status!==undefined?{status:patch.status}:{}),...(patch.priority!==undefined?{priority:patch.priority}:{})};
 if(!Object.keys(payload).length)return {error:new Error('No changes requested')};
 const result=await db.from('tasks').update(payload).eq('id',task.id).eq('updated_at',task.updated_at).select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Task changed in another session. Refresh and try again.'):null)};
}

export async function resolveApproval(approvalId:string,status:'approved'|'rejected'){
 const result=await db.from('approvals').update({status}).eq('id',approvalId).eq('status','pending').select('id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Approval is no longer pending. Refresh the workspace.'):null)};
}
export async function addDependency(dependency:Dependency){
 return db.from('dependencies').insert(dependency);
}
export async function removeDependency(dependency:Dependency){
 const result=await db.from('dependencies').delete().eq('project_id',dependency.project_id).eq('task_id',dependency.task_id).eq('depends_on_id',dependency.depends_on_id).select('task_id').maybeSingle();
 return {error:result.error||(!result.data?new Error('Dependency is no longer present. Refresh the workspace.'):null)};
}
