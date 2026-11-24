-- REVIEW CANDIDATE. Only apply in disposable CI or after explicit production approval.
begin;

-- RLS remains the ownership boundary. Column grants narrow browser writes.
revoke insert,update on public.tasks from authenticated;
grant insert(project_id,parent_id,kind,title,description,acceptance_criteria,next_step,branch,pr_url,test_result,status,priority,requires_approval) on public.tasks to authenticated;
grant update(parent_id,kind,title,description,acceptance_criteria,next_step,branch,pr_url,test_result,status,priority,requires_approval) on public.tasks to authenticated;

revoke insert,update on public.approvals from authenticated;
grant update(status) on public.approvals to authenticated;
revoke insert,update on public.projects from authenticated;
grant insert(name,description,repository,status) on public.projects to authenticated;
grant update(name,description,repository,status) on public.projects to authenticated;
revoke insert,update on public.project_memory from authenticated;
grant insert(project_id,title,content,category) on public.project_memory to authenticated;
grant update(title,content,category) on public.project_memory to authenticated;
revoke insert,update on public.decisions from authenticated;
grant insert(project_id,title,rationale,outcome,status) on public.decisions to authenticated;
grant update(title,rationale,outcome,status) on public.decisions to authenticated;

create function overseer_private.guard_browser_task() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user <> 'authenticated' then return new; end if;
 if new.status='in_progress' then
  raise exception 'Agent claims must use the trusted session protocol' using errcode='42501';
 end if;
 if tg_op='UPDATE' then
  if exists(select 1 from public.work_sessions s where s.task_id=old.id and s.project_id=old.project_id and s.status='active') then
   raise exception 'Task has an active session' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function overseer_private.guard_browser_task() from public,anon,authenticated;
create trigger guard_browser_task before insert or update on public.tasks
for each row execute function overseer_private.guard_browser_task();

-- Changes in reviewed work scope invalidate the existing approval.
-- Invoker is sufficient: both owner and trusted connector can update status.
create function overseer_private.invalidate_task_approval() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if row(old.title,old.description,old.acceptance_criteria,old.branch,old.pr_url,old.kind,old.parent_id,old.requires_approval)
    is distinct from row(new.title,new.description,new.acceptance_criteria,new.branch,new.pr_url,new.kind,new.parent_id,new.requires_approval) then
  update public.approvals set status='pending'
   where project_id=new.project_id and task_id=new.id and status<>'pending';
 end if;
 return null;
end $$;
revoke all on function overseer_private.invalidate_task_approval() from public,anon,authenticated;
create trigger invalidate_task_approval after update on public.tasks
for each row execute function overseer_private.invalidate_task_approval();

create function overseer_private.guard_approval_resolution() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and (old.status<>'pending' or new.status not in ('approved','rejected')) then
  -- The internal task-scope invalidation is allowed to reset to pending.
  if not (new.status='pending' and pg_trigger_depth()>1) then
   raise exception 'Only pending approvals may be resolved' using errcode='42501';
  end if;
 end if;
 if new.operation is distinct from old.operation or new.task_id is distinct from old.task_id or new.project_id is distinct from old.project_id then
  new.status:='pending';
 end if;
 return new;
end $$;
revoke all on function overseer_private.guard_approval_resolution() from public,anon,authenticated;
create trigger guard_approval_resolution before update on public.approvals
for each row execute function overseer_private.guard_approval_resolution();

commit;
