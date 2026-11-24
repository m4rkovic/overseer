-- OVERSEER initial schema. Private, owner-scoped workspaces.
create table public.projects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null check (length(btrim(name)) between 1 and 120),
 description text not null default '',
 repository text not null default '',
 status text not null default 'active' check(status in ('active','paused','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,name)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 parent_id uuid,
 kind text not null default 'task' check(kind in ('epic','task','subtask')),
 title text not null check(length(btrim(title)) between 1 and 240),
 description text not null default '',
 acceptance_criteria text not null default '',
 next_step text not null default '',
 branch text not null default '',
 pr_url text not null default '',
 test_result text not null default '',
 status text not null default 'backlog' check(status in ('backlog','ready','in_progress','blocked','review','done','cancelled')),
 priority smallint not null default 2 check(priority between 0 and 4),
 requires_approval boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(project_id,id),
 foreign key(project_id,parent_id) references public.tasks(project_id,id),
 check(parent_id is distinct from id)
);
create table public.dependencies (
 project_id uuid not null,
 task_id uuid not null,
 depends_on_id uuid not null,
 primary key(task_id,depends_on_id),
 foreign key(project_id,task_id) references public.tasks(project_id,id) on delete cascade,
 foreign key(project_id,depends_on_id) references public.tasks(project_id,id) on delete cascade,
 check(task_id<>depends_on_id)
);
create table public.project_memory (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null,
 content text not null,
 category text not null default 'context' check(category in ('context','architecture','constraint','convention','known_issue')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.decisions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null,
 rationale text not null,
 outcome text not null default '',
 status text not null default 'proposed' check(status in ('proposed','accepted','superseded','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.work_sessions (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid,
 summary text not null default '',
 next_step text not null default '',
 status text not null default 'active' check(status in ('active','completed','interrupted')),
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 foreign key(project_id,task_id) references public.tasks(project_id,id),
 check(ended_at is null or ended_at >= started_at)
);
create table public.approvals (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null unique,
 operation text not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(project_id,task_id) references public.tasks(project_id,id) on delete cascade
);
create table public.activity_log (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid,
 event text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(project_id,task_id) references public.tasks(project_id,id)
);
create index projects_owner_idx on public.projects(owner_id);
create index tasks_queue_idx on public.tasks(project_id,status,priority,created_at);
create index tasks_parent_idx on public.tasks(project_id,parent_id);
create index dependencies_reverse_idx on public.dependencies(project_id,depends_on_id);
create index dependencies_task_idx on public.dependencies(project_id,task_id);
create index memory_project_idx on public.project_memory(project_id);
create index decisions_project_idx on public.decisions(project_id);
create index sessions_task_idx on public.work_sessions(project_id,task_id);
create index approvals_task_idx on public.approvals(project_id,task_id);
create index activity_task_idx on public.activity_log(project_id,task_id);
create index activity_time_idx on public.activity_log(project_id,created_at desc);
create function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
revoke execute on function public.touch_updated_at() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['projects','tasks','project_memory','decisions','approvals'] loop
 execute format('create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',t);
 end loop;
end $$;
alter table public.projects enable row level security;
revoke all on public.projects from public,anon,authenticated;
grant select,insert,update on public.projects to authenticated;
grant select,insert,update,delete on public.projects to service_role;
create policy project_owner on public.projects for all to authenticated using (owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
do $$ declare t text; begin
 foreach t in array array['tasks','dependencies','project_memory','decisions','work_sessions','approvals','activity_log'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on public.%I to service_role',t);
 if t='activity_log' then
 execute format('grant select,insert on public.%I to authenticated',t);
 elsif t='dependencies' then
 execute format('grant select,insert,delete on public.%I to authenticated',t);
 else
 execute format('grant select,insert,update on public.%I to authenticated',t);
 end if;
 execute format('create policy project_owner on public.%I for all to authenticated using (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid()))) with check (exists (select 1 from public.projects p where p.id=project_id and p.owner_id=(select auth.uid())))',t);
 end loop;
end $$;
create view public.execution_queue with (security_invoker=true) as
select t.* from public.tasks t join public.projects p on p.id=t.project_id
where p.status='active' and t.kind<>'epic' and t.status='ready'
and not exists (select 1 from public.dependencies d join public.tasks prereq on prereq.id=d.depends_on_id and prereq.project_id=d.project_id where d.task_id=t.id and d.project_id=t.project_id and prereq.status<>'done')
and (not t.requires_approval or exists(select 1 from public.approvals a where a.task_id=t.id and a.project_id=t.project_id and a.status='approved'));
revoke all on public.execution_queue from public,anon,authenticated;
grant select on public.execution_queue to authenticated,service_role;
