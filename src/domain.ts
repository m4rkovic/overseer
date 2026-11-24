export type Project={id:string;name:string;description:string;repository:string;status:string};
export type Task={id:string;project_id:string;parent_id:string|null;kind:string;title:string;description:string;acceptance_criteria:string;next_step:string;branch:string;pr_url:string;test_result:string;status:string;priority:number;requires_approval:boolean};
export type Note={id:string;project_id:string;title:string;content:string;category:string};
export type Decision={id:string;project_id:string;title:string;rationale:string;outcome:string;status:string};
export type Work={id:string;project_id:string;task_id:string|null;summary:string;next_step:string;status:string;started_at:string;heartbeat_at:string;lease_expires_at:string};
export type Approval={id:string;project_id:string;task_id:string;operation:string;status:string};
export type Activity={id:string;project_id:string;task_id:string|null;event:string;created_at:string;actor_source:string;details:{before?:Record<string,unknown>|null;after?:Record<string,unknown>|null}};
export type Dependency={project_id:string;task_id:string;depends_on_id:string};
export const statuses=['backlog','ready','in_progress','blocked','review','done','cancelled'];
export const tabs=['Overview','Projects','Tasks','Execution queue','Project memory','Decisions','AI sessions','Approvals','Activity'] as const;
export type Tab=typeof tabs[number];
export const blankTask=(project_id:string):Omit<Task,'id'>=>({project_id,parent_id:null,kind:'task',title:'',description:'',acceptance_criteria:'',next_step:'',branch:'',pr_url:'',test_result:'',status:'backlog',priority:2,requires_approval:false});
export const message=(e:unknown)=>e instanceof Error?e.message:typeof e==='object'&&e!==null&&'message' in e?String(e.message):String(e);
export const readable=(s:string)=>s.replaceAll('_',' ');
export function githubRepo(value:string){return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)?'https://github.com/'+value:null}
export function githubPR(value:string){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+\/?$/.test(u.pathname)?u.href:null}catch{return null}}

