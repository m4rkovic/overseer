-- Run only after workflow_write_hardening.sql in disposable PostgreSQL.
-- Existing isolated_owner_rls and concurrent_claim fixtures are prerequisites.
begin;
insert into public.tasks(id,project_id,title,status,requires_approval) values
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Approval scope fixture','ready',true);
insert into public.approvals(project_id,task_id,operation,status) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','Review fixture','approved');

set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$
begin
 begin
  update public.tasks set title='Forbidden while active' where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  raise exception 'Active task update allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.tasks set status='in_progress' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  raise exception 'Manual claim allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.tasks(project_id,title,status) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Fake active task','in_progress');
  raise exception 'Manual active insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.tasks set updated_at=now() where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  raise exception 'Client revision forgery allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.approvals set operation='Changed operation' where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  raise exception 'Browser approval scope edit allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.approvals set status='rejected' where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  raise exception 'Resolved approval overwritten';
 exception when insufficient_privilege then null; end;
 update public.tasks set next_step='Checkpoint only' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if not exists(select 1 from public.approvals where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and status='approved') then raise exception 'Checkpoint invalidated approval'; end if;
 update public.tasks set description='New scope' where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if not exists(select 1 from public.approvals where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and status='pending') then raise exception 'Scope edit did not invalidate approval'; end if;
 if exists(select 1 from public.execution_queue where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'Unapproved task claimable'; end if;
 update public.approvals set status='approved' where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if not exists(select 1 from public.execution_queue where id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then raise exception 'Reapproved task missing from queue'; end if;
 begin
  insert into public.dependencies(project_id,task_id,depends_on_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  raise exception 'Active dependency edit allowed';
 exception when insufficient_privilege then null; end;
 insert into public.dependencies(project_id,task_id,depends_on_id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
 if not exists(select 1 from public.approvals where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and status='pending') then raise exception 'Dependency edit did not invalidate approval'; end if;
 update public.approvals set status='approved' where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 delete from public.dependencies where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 if not exists(select 1 from public.approvals where task_id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' and status='pending') then raise exception 'Dependency removal did not invalidate approval'; end if;

end $$;
reset role;
set local role service_role;
do $$ declare sid uuid; begin
 select id into sid from public.work_sessions where task_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and status='active';
 if not public.finish_session(sid,'done','Finished fixture','None','passed') then raise exception 'Trusted completion broken'; end if;
end $$;
reset role;
rollback;
