"""Browser smoke test of the real build; all non-local network traffic is mocked or denied."""
import base64
import json
import os
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

STAMP = '2026-01-01T00:00:00Z'
PROJECT = '11111111-1111-4111-8111-111111111111'
USER = '22222222-2222-4222-8222-222222222222'
TASK = '33333333-3333-4333-8333-333333333333'


def jwt_part(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip('=')


class MockApi:
    def __init__(self, origin):
        self.origin = origin
        self.user = {'id': USER, 'aud': 'authenticated', 'role': 'authenticated', 'email': 'demo@example.invalid', 'app_metadata': {}, 'user_metadata': {}, 'created_at': STAMP}
        self.tasks = [{'id': TASK, 'project_id': PROJECT, 'parent_id': None, 'kind': 'task', 'title': 'Fixture task', 'description': 'Synthetic QA data', 'acceptance_criteria': '', 'next_step': 'Verify UI', 'branch': '', 'pr_url': '', 'test_result': '', 'status': 'ready', 'priority': 2, 'requires_approval': False, 'updated_at': STAMP, 'created_at': STAMP}]
        self.projects = [{'id': PROJECT, 'name': 'Fixture project', 'description': 'Local smoke test', 'repository': 'example/fixture', 'status': 'active', 'updated_at': STAMP}]
        self.writes = []
        self.unexpected = []
        self.reads = 0
        self.fail_task_reads = 0

    def handle(self, route):
        request = route.request
        url = urlparse(request.url)
        method = request.method
        if url.scheme + '://' + url.netloc == self.origin:
            route.continue_()
            return
        if url.scheme != 'https' or not (url.hostname or '').endswith('.supabase.co'):
            self.unexpected.append(request.url)
            route.abort()
            return
        headers = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range', 'content-type': 'application/json'}
        def reply(data, status=200):
            route.fulfill(status=status, headers=headers, body=json.dumps(data))
        if method == 'OPTIONS':
            route.fulfill(status=204, headers=headers, body='')
            return
        if url.path == '/auth/v1/token' and method == 'POST':
            exp = int(time.time()) + 3600
            token = jwt_part({'alg': 'HS256', 'typ': 'JWT'}) + '.' + jwt_part({'sub': USER, 'aud': 'authenticated', 'role': 'authenticated', 'exp': exp, 'iat': exp-3600}) + '.fixture'
            reply({'access_token': token, 'refresh_token': 'fixture-refresh', 'expires_in': 3600, 'expires_at': exp, 'token_type': 'bearer', 'user': self.user})
            return
        if url.path == '/auth/v1/logout' and method == 'POST':
            route.fulfill(status=204, headers=headers, body='')
            return
        if url.path == '/auth/v1/user' and method == 'GET':
            reply(self.user)
            return
        if url.path.startswith('/rest/v1/'):
            table = url.path.rsplit('/', 1)[-1]
            if method == 'GET':
                self.reads += 1
                if table == 'tasks' and self.fail_task_reads:
                    self.fail_task_reads -= 1
                    reply({'message': 'Synthetic transient failure', 'code': 'FIXTURE'}, 503)
                    return
                rows = {'projects': self.projects, 'tasks': self.tasks, 'execution_queue': [t for t in self.tasks if t['status']=='ready']}.get(table, [])
                headers['content-range'] = f'0-{len(rows)-1}/{len(rows)}' if rows else '*/0'
                reply(rows)
                return
            if table == 'tasks' and method == 'PATCH':
                query = parse_qs(url.query)
                payload = request.post_data_json
                self.writes.append(payload)
                rows = [t for t in self.tasks if query.get('id') == ['eq.'+t['id']] and query.get('updated_at') == ['eq.'+t['updated_at']]]
                for t in rows:
                    t.update(payload)
                    t['updated_at'] = '2026-01-02T00:00:00Z'
                reply([{'id': t['id']} for t in rows])
                return
        self.unexpected.append(method + ' ' + url.path)
        reply({'message': 'Unexpected mock request'}, 400)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    dist = Path(sys.argv[1] if len(sys.argv)>1 else 'dist').resolve()
    if not (dist/'index.html').is_file():
        raise RuntimeError('Build dist before running browser smoke tests')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(dist)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    mock = MockApi(origin)
    try:
        with sync_playwright() as p:
            launch = {'headless': True}
            if os.getenv('CHROMIUM_PATH'):
                launch['executable_path'] = os.environ['CHROMIUM_PATH']
            browser = p.chromium.launch(**launch)
            context = browser.new_context(service_workers='block')
            context.route('**/*', mock.handle)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin+'/')
            expect(page.get_by_role('button', name='Sign in', exact=True)).to_be_visible()
            assert mock.reads == 0, 'Logged-out browser requested workspace records'
            page.get_by_label('Email').fill('demo@example.invalid')
            page.get_by_label('Password').fill('fixture-password')
            page.get_by_role('button', name='Sign in', exact=True).click()
            expect(page.get_by_role('heading', name='Overview', exact=True)).to_be_visible()
            expect(page.get_by_role('button', name='Fixture task', exact=True)).to_be_visible()
            page.get_by_role('button', name='Fixture task', exact=True).click()
            expect(page.get_by_role('heading', name='Fixture task', exact=True)).to_be_visible()
            page.get_by_role('button', name='Edit', exact=True).click()
            dialog = page.get_by_role('dialog', name='Task editor')
            expect(dialog).to_be_visible()
            dialog.get_by_label('Title', exact=True).fill('Updated fixture task')
            dialog.get_by_role('button', name='Save task').click()
            expect(dialog).not_to_be_visible()
            expect(page.get_by_role('heading', name='Updated fixture task', exact=True)).to_be_visible()
            assert len(mock.writes) == 1, mock.writes
            assert 'id' not in mock.writes[0] and 'updated_at' not in mock.writes[0]
            page.get_by_role('button', name='Back', exact=True).click()
            page.get_by_role('button', name='Board', exact=True).click()
            expect(page.locator('.task-card').filter(has_text='Updated fixture task')).to_be_visible()
            page.keyboard.press('Control+k')
            palette = page.get_by_role('dialog', name='Command palette')
            expect(palette).to_be_visible()
            palette.get_by_role('textbox').fill('settings')
            palette.get_by_role('button', name='Navigate Settings').click()
            expect(page.get_by_role('heading', name='Workspace settings')).to_be_visible()
            page.get_by_label('Density').select_option('compact')
            expect(page.locator('.shell')).to_have_class('shell density-compact')
            mock.fail_task_reads = 1
            page.get_by_role('button', name='Refresh', exact=True).click()
            expect(page.get_by_role('button', name='Refresh', exact=True)).to_be_enabled()
            assert mock.fail_task_reads == 0
            assert not page.get_by_role('alert').count(), 'Read retry left a visible error'
            page.get_by_role('button', name='Sign out', exact=True).click()
            expect(page.get_by_role('button', name='Sign in', exact=True)).to_be_visible()
            assert not errors, errors
            assert not mock.unexpected, mock.unexpected
            browser.close()
            print('PASS: login, task detail/edit, board, palette, settings, retry, logout; all API requests isolated')
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
