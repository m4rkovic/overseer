-- Audit, dependency integrity and atomic task claiming.
create schema if not exists overseer_private;
revoke all on schema overseer_private from public, anon, authenticated;

alter table public.activity_log add column actor_id uuid references auth.users(id) on delete set null;
alter table public.activity_log add column actor_source text not null default 'unknown';
revoke insert,update,delete on public.activity_log from authenticated,anon;

create function overseer_private.audit_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; row_data jsonb; pid uuid; tid uuid;
begin
 if TG_OP <> 'INSERT' then before_row:=to_jsonb(OLD)-'updated_at'; end if;
 if TG_OP <> 'DELETE' then after_row:=to_jsonb(NEW)-'updated_at'; end if;
 if before_row is not distinct from after_row then return null; end if;
 row_data:=coalesce(after_row,before_row);
 if TG_TABLE_NAME='projects' then pid:=(row_data->>'id')::uuid;
 else pid:=(row_data->>'project_id')::uuid; end if;
 if TG_TABLE_NAME='tasks' then tid:=(row_data->>'id')::uuid;
 else tid:=(row_data->>'task_id')::uuid; end if;
 if not exists(select 1 from public.projects where id=pid) then return null; end if;
 if tid is not null and not exists(select 1 from public.tasks where id=tid and project_id=pid) then tid:=null; end if;
 -- Store operational fields only; do not duplicate free-text project memory or descriptions.
 insert into public.activity_log(project_id,task_id,event,details,actor_id,actor_source)
 values(pid,tid,TG_TABLE_NAME||'.'||lower(TG_OP),
 jsonb_build_object('record_id',coalesce(row_data->>'id',row_data->>'task_id'),
 'before',case when before_row is null then null else
 jsonb_strip_nulls(jsonb_build_object('status',before_row->'status','priority',before_row->'priority','kind',before_row->'kind','requires_approval',before_row->'requires_approval','parent_id',before_row->'parent_id','depends_on_id',before_row->'depends_on_id')) end,
 'after',case when after_row is null then null else
 jsonb_strip_nulls(jsonb_build_object('status',after_row->'status','priority',after_row->'priority','kind',after_row->'kind','requires_approval',after_row->'requires_approval','parent_id',after_row->'parent_id','depends_on_id',after_row->'depends_on_id')) end),
 auth.uid(),case when auth.uid() is null then 'database' else 'authenticated' end);
 return null;
end $$;
revoke all on function overseer_private.audit_change() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['projects','tasks','dependencies','project_memory','decisions','work_sessions','approvals'] loop
 execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function overseer_private.audit_change()',t);
 end loop;
end $$;

create function overseer_private.guard_dependency() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,0));
 if exists(with recursive reachable(id) as (
 select NEW.depends_on_id
 union
 select d.depends_on_id from public.dependencies d join reachable r on d.task_id=r.id where d.project_id=NEW.project_id
 ) select 1 from reachable where id=NEW.task_id) then
 raise exception 'Dependency cycle is not allowed' using errcode='23514';
 end if;
 return NEW;
end $$;
revoke all on function overseer_private.guard_dependency() from public,anon,authenticated;
create trigger guard_dependency before insert or update on public.dependencies for each row execute function overseer_private.guard_dependency();

create function overseer_private.guard_parent() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if NEW.parent_id is null then return NEW; end if;
 perform pg_advisory_xact_lock(hashtextextended(NEW.project_id::text,0));
 if exists(with recursive ancestors(id) as (
 select NEW.parent_id
 union
 select t.parent_id from public.tasks t join ancestors a on t.id=a.id where t.project_id=NEW.project_id and t.parent_id is not null
 ) select 1 from ancestors where id=NEW.id) then
 raise exception 'Parent cycle is not allowed' using errcode='23514';
 end if;
 return NEW;
end $$;
revoke all on function overseer_private.guard_parent() from public,anon,authenticated;
create trigger guard_parent before insert or update of parent_id,project_id on public.tasks for each row execute function overseer_private.guard_parent();

create unique index work_sessions_one_active_task on public.work_sessions(task_id) where status='active' and task_id is not null;
create function public.claim_next_task(p_project_id uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare picked uuid; sid uuid;
begin
 select t.id into picked from public.tasks t join public.execution_queue q on q.id=t.id
 where t.project_id=p_project_id and not exists(select 1 from public.work_sessions s where s.task_id=t.id and s.status='active')
 order by t.priority,t.created_at,t.id limit 1 for update of t skip locked;
 if picked is null then return null; end if;
 update public.tasks set status='in_progress' where id=picked;
 insert into public.work_sessions(project_id,task_id,status,summary) values(p_project_id,picked,'active','Task claimed') returning id into sid;
 return sid;
end $$;
revoke all on function public.claim_next_task(uuid) from public,anon,authenticated;
grant execute on function public.claim_next_task(uuid) to service_role;

-- Staging remains private until the single administrator account is provisioned.
create table overseer_private.pending_projects(
 name text primary key, repository text not null, description text not null
);
alter table overseer_private.pending_projects enable row level security;
revoke all on overseer_private.pending_projects from public,anon,authenticated;
