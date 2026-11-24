-- Explicit session heartbeat, safe recovery and completion.
alter table public.work_sessions add column heartbeat_at timestamptz not null default now();
alter table public.work_sessions add column lease_expires_at timestamptz not null default (now()+interval '30 minutes');
alter table public.work_sessions add constraint work_sessions_lease_valid check(lease_expires_at>=heartbeat_at);
create index work_sessions_expiry_idx on public.work_sessions(lease_expires_at) where status='active';
-- Browser is a reader of agent sessions; only trusted connector operations manage claims.
revoke insert,update,delete on public.work_sessions from authenticated,anon;

create function public.checkpoint_session(p_session_id uuid,p_summary text,p_next_step text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.work_sessions set summary=p_summary,next_step=p_next_step,
 heartbeat_at=now(),lease_expires_at=now()+interval '30 minutes'
 where id=p_session_id and status='active' and lease_expires_at>now();
 return found;
end $$;

create function public.finish_session(p_session_id uuid,p_status text,p_summary text,p_next_step text,p_test_result text default '')
returns boolean language plpgsql security invoker set search_path='' as $$
declare s public.work_sessions%rowtype;
begin
 if p_status not in ('review','done','blocked','ready') then raise exception 'Invalid finishing status'; end if;
 select * into s from public.work_sessions where id=p_session_id and status='active' and lease_expires_at>now() for update;
 if not found then return false; end if;
 if s.task_id is not null then
 update public.tasks set status=p_status,next_step=p_next_step,test_result=p_test_result where id=s.task_id and status='in_progress';
 if not found then raise exception 'Task changed outside active session'; end if;
 end if;
 update public.work_sessions set status='completed',ended_at=now(),summary=p_summary,next_step=p_next_step where id=s.id;
 return true;
end $$;

create function public.recover_expired_sessions(p_project_id uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare s public.work_sessions%rowtype; n integer:=0;
begin
 for s in select * from public.work_sessions where project_id=p_project_id and status='active' and lease_expires_at<=now() for update skip locked loop
 update public.work_sessions set status='interrupted',ended_at=now() where id=s.id;
 if s.task_id is not null then
 update public.tasks set status='blocked',next_step='Reconcile repository state and previous session checkpoint before resuming.' where id=s.task_id and status='in_progress';
 end if;
 n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function public.checkpoint_session(uuid,text,text),public.finish_session(uuid,text,text,text,text),public.recover_expired_sessions(uuid) from public,anon,authenticated;
grant execute on function public.checkpoint_session(uuid,text,text),public.finish_session(uuid,text,text,text,text),public.recover_expired_sessions(uuid) to service_role;

-- No unreviewed duplicate task execution while a session remains active.
create or replace view public.execution_queue with (security_invoker=true) as
select t.* from public.tasks t join public.projects p on p.id=t.project_id
where p.status='active' and t.kind<>'epic' and t.status='ready'
and not exists(select 1 from public.dependencies d join public.tasks prereq on prereq.id=d.depends_on_id and prereq.project_id=d.project_id where d.task_id=t.id and d.project_id=t.project_id and prereq.status<>'done')
and (not t.requires_approval or exists(select 1 from public.approvals a where a.task_id=t.id and a.project_id=t.project_id and a.status='approved'))
and not exists(select 1 from public.work_sessions s where s.task_id=t.id and s.status='active');
-- Explicit deny policy on internal staging, no browser schema grants.
create policy staging_deny on overseer_private.pending_projects for all to authenticated using(false) with check(false);
