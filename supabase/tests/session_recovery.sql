do $$
declare u uuid:=gen_random_uuid(); p uuid; t uuid; s uuid; t2 uuid; s2 uuid;
begin
 begin
 insert into auth.users(id,email) values(u,'overseer-test-'||u::text||'@example.invalid');
 insert into public.projects(owner_id,name) values(u,'Session fixture') returning id into p;
 insert into public.tasks(project_id,title,status) values(p,'Task A','ready') returning id into t;
 s:=public.claim_next_task(p);
 if s is null or not public.checkpoint_session(s,'Checkpoint','Next step') then raise exception 'Checkpoint failed'; end if;
 if not public.finish_session(s,'review','Finished','Review','passed') then raise exception 'Finish failed'; end if;
 if public.checkpoint_session(s,'late','late') or public.finish_session(s,'done','late','late') then raise exception 'Closed session writable'; end if;
 if not exists(select 1 from public.tasks where id=t and status='review' and test_result='passed') then raise exception 'Finish state mismatch'; end if;
 insert into public.tasks(project_id,title,status) values(p,'Task B','ready') returning id into t2;
 s2:=public.claim_next_task(p);
 update public.work_sessions set heartbeat_at=now()-interval '40 minutes',lease_expires_at=now()-interval '10 minutes' where id=s2;
 if public.checkpoint_session(s2,'expired','expired') then raise exception 'Expired session renewed'; end if;
 if public.finish_session(s2,'done','expired','expired') then raise exception 'Expired session finished'; end if;
 if public.recover_expired_sessions(p)<>1 or public.recover_expired_sessions(p)<>0 then raise exception 'Recovery not idempotent'; end if;
 if not exists(select 1 from public.tasks where id=t2 and status='blocked') or not exists(select 1 from public.work_sessions where id=s2 and status='interrupted') then raise exception 'Recovery state mismatch'; end if;
 if exists(select 1 from public.execution_queue where id=t2) then raise exception 'Interrupted task auto-requeued'; end if;
 if has_function_privilege('authenticated','public.recover_expired_sessions(uuid)','EXECUTE') or has_table_privilege('authenticated','public.work_sessions','UPDATE') then raise exception 'Privilege leak'; end if;
 raise exception 'fixture rollback' using errcode='PZ001';
 exception when sqlstate 'PZ001' then null;
 end;
end $$;
