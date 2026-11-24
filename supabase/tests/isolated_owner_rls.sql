-- Run after migrations in disposable test database.
insert into auth.users(id,email) values
 ('11111111-1111-4111-8111-111111111111','owner@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','other@example.invalid');
insert into public.projects(id,owner_id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','Owner fixture'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','Other fixture');
insert into public.tasks(id,project_id,title,status) values
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Claim fixture','ready'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Other task','ready');

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$
declare n int;
begin
 if (select count(*) from public.projects)<>1 or (select count(*) from public.tasks)<>1 or (select count(*) from public.execution_queue)<>1 then
  raise exception 'Owner isolation failed';
 end if;
 update public.tasks set title='unauthorized' where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 get diagnostics n=row_count;
 if n<>0 then raise exception 'Foreign task writable'; end if;
 begin
  insert into public.tasks(project_id,title) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Forbidden');
  raise exception 'Foreign project insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.activity_log(project_id,event) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','forged');
  raise exception 'Audit insert allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.claim_next_task('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  raise exception 'Untrusted claim allowed';
 exception when insufficient_privilege then null; end;
 if has_table_privilege(current_user,'public.work_sessions','UPDATE') then raise exception 'Untrusted session writable'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
do $$ begin
 if has_table_privilege(current_user,'public.projects','SELECT') or has_table_privilege(current_user,'public.execution_queue','SELECT') then
  raise exception 'Anonymous data access';
 end if;
end $$;
reset role;
