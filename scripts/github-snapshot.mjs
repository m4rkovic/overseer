// Read-only GitHub CLI exporter. Run locally with an already authenticated gh.
import {execFileSync} from 'node:child_process';
const repository=process.argv[2];
if(!repository||!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository)){console.error('Usage: node scripts/github-snapshot.mjs OWNER/REPO > snapshot.json');process.exit(2);}
function gh(args){return JSON.parse(execFileSync('gh',args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']}))}
try{
 const info=gh(['repo','view',repository,'--json','nameWithOwner,defaultBranchRef']);
 if(info.nameWithOwner.toLowerCase()!==repository.toLowerCase())throw new Error('Repository identity mismatch');
 const branch=info.defaultBranchRef?.name;if(!branch)throw new Error('Repository has no default branch');
 const commits=gh(['api','--method','GET','repos/'+repository+'/commits','-f','sha='+branch,'-f','per_page=20']);
 const prs=gh(['pr','list','--repo',repository,'--state','all','--limit','30','--json','number,title,state,headRefName,baseRefName,updatedAt']);
 const out={format:'overseer-github-v1',repository:info.nameWithOwner,captured_at:new Date().toISOString(),default_branch:branch,commits:commits.map(c=>({sha:c.sha,subject:String(c.commit.message).split('\n')[0].slice(0,1000),date:c.commit.committer.date})),pull_requests:prs.map(p=>({number:p.number,title:p.title.slice(0,1000),state:p.state,head:p.headRefName,base:p.baseRefName,updated_at:p.updatedAt}))};
 process.stdout.write(JSON.stringify(out,null,2)+'\n');
}catch(e){console.error('GitHub snapshot failed. Check repository access and gh auth status.');process.exitCode=1;}
