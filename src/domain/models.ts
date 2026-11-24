export type Project={id:string;name:string;description:string;repository:string;status:string;updated_at?:string};
export type Task={id:string;project_id:string;parent_id:string|null;kind:string;title:string;description:string;acceptance_criteria:string;next_step:string;branch:string;pr_url:string;test_result:string;status:string;priority:number;requires_approval:boolean;updated_at?:string;created_at?:string};
export type Note={id:string;project_id:string;title:string;content:string;category:string;updated_at?:string};
export type Decision={id:string;project_id:string;title:string;rationale:string;outcome:string;status:string;updated_at?:string};
export type Work={id:string;project_id:string;task_id:string|null;summary:string;next_step:string;status:string;started_at:string;heartbeat_at:string;lease_expires_at:string};
export type Approval={id:string;project_id:string;task_id:string;operation:string;status:string;updated_at?:string};
export type Activity={id:string;project_id:string;task_id:string|null;event:string;created_at:string;actor_source:string;details:{before?:Record<string,unknown>|null;after?:Record<string,unknown>|null}};
export type Dependency={project_id:string;task_id:string;depends_on_id:string};

export type TaskDraft=Omit<Task,'id'|'created_at'|'updated_at'>;
export type EditableTable='projects'|'project_memory'|'decisions';
