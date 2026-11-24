"""Real parallel transactions against a disposable PostgreSQL CI service."""
import os
import subprocess

PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
CONTAINER = os.environ['TEST_POSTGRES_CONTAINER']
BASE = ['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d','overseer_test']
CLAIM = "select coalesce(public.claim_next_task('%s')::text,'EMPTY');" % PROJECT

def run(sql):
    return subprocess.run(BASE, input=sql, text=True, capture_output=True, check=True, timeout=15).stdout.strip()

first = subprocess.Popen(BASE, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
try:
    first.stdin.write('begin; set local role service_role;\n'+CLAIM+'\n')
    first.stdin.flush()
    claimed = first.stdout.readline().strip()
    assert claimed and claimed != 'EMPTY', 'First transaction failed to claim'
    second = run('set role service_role;\n'+CLAIM)
    assert second == 'EMPTY', f'Concurrent claim unexpectedly returned {second}'
    first.stdin.write('commit;\n')
    first.stdin.close()
    assert first.wait(timeout=15) == 0
    assert run("select count(*) from public.work_sessions where project_id='%s' and status='active';" % PROJECT) == '1'
    assert run('set role service_role;\n'+CLAIM) == 'EMPTY'
    print('PASS: two independent PostgreSQL sessions cannot claim the same ready task')
finally:
    if first.poll() is None:
        first.kill()
        first.wait()
