import type {Task,TaskDraft,Project,EditableTable} from './models.ts';
import {githubPR,githubRepo,githubBranch} from './githubLinks.ts';
import {isManualTaskStatus,wouldCreateParentCycle} from './tasks.ts';
export function validateTaskDraft(task:Task|TaskDraft,projects:readonly Project[],tasks:readonly Task[]):string|null {
 if(!task.title.trim()||task.title.trim().length>240)return 'Task title must contain 1–240 characters.';
 const project=projects.find(p=>p.id===task.project_id);
 if(!project)return 'Select an existing project.';
 if(!['epic','task','subtask'].includes(task.kind))return 'Invalid task type.';
 if(!isManualTaskStatus(task.status))return 'Select a manual task status. Active work must use the session protocol.';
 if(!Number.isInteger(task.priority)||task.priority<0||task.priority>4)return 'Priority must be P0–P4.';
 if(task.parent_id){
  const parent=tasks.find(t=>t.id===task.parent_id);
  if(!parent||parent.project_id!==task.project_id)return 'Parent must belong to the same project.';
  if('id' in task&&wouldCreateParentCycle(task.id,parent.id,tasks))return 'Parent relationship would create a cycle.';
 }
 if(task.pr_url.trim()&&!githubPR(task.pr_url.trim()))return 'Enter a valid HTTPS GitHub pull request URL.';
 if(task.branch.trim()&&(!project.repository||!githubBranch(project.repository,task.branch.trim())))return 'Enter a valid branch and configure the project repository first.';
 return null;
}
const recordFields={
 projects:['name','description','repository','status'],
 project_memory:['title','content','category'],
 decisions:['title','rationale','outcome','status']
} as const;
export function validateRecordPayload(table:EditableTable,payload:Record<string,unknown>,creating:boolean):Record<string,string>{
 const fields:string[]=[...recordFields[table]];
 if(creating&&table!=='projects')fields.push('project_id');
 if(Object.keys(payload).some(key=>!fields.includes(key)))throw new Error('Unexpected record field.');
 const result:Record<string,string>={};
 for(const key of fields){
  if(typeof payload[key]!=='string')throw new Error('Missing or invalid '+key+'.');
  result[key]=(payload[key] as string).trim();
 }
 const title=result.name??result.title;
 if(!title||title.length>(table==='projects'?120:240))throw new Error('Enter a valid name or title.');
 if(creating&&table!=='projects'&&!result.project_id)throw new Error('Select a project.');
 if(table==='projects'){
  if(result.repository&&!githubRepo(result.repository))throw new Error('Repository must use owner/name format.');
  if(!['active','paused','archived'].includes(result.status))throw new Error('Invalid project status.');
 }else if(table==='project_memory'){
  if(!result.content)throw new Error('Memory content is required.');
  if(!['context','architecture','constraint','convention','known_issue'].includes(result.category))throw new Error('Invalid memory category.');
 }else{
  if(!result.rationale)throw new Error('Decision rationale is required.');
  if(!['proposed','accepted','superseded','rejected'].includes(result.status))throw new Error('Invalid decision status.');
 }
 return result;
}
export function singleMutationError(result:{data:unknown;error:unknown},conflict:string):unknown{
 return result.error||(!Array.isArray(result.data)||result.data.length!==1?new Error(conflict):null);
}
