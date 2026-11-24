export function githubRepo(value:string){
 const parts=value.split('/');
 return parts.length===2&&/^[A-Za-z0-9_-]+$/.test(parts[0])&&/^[A-Za-z0-9_.-]+$/.test(parts[1])&&!['.','..'].includes(parts[1])?'https://github.com/'+value:null;
}
export function githubPR(value:string){
 try{
  const u=new URL(value);
  if(u.protocol!=='https:'||u.hostname!=='github.com'||u.port||u.username||u.password)return null;
  const m=/^\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)\/?$/.exec(u.pathname);
  if(!m||!githubRepo(m[1]+'/'+m[2])||!Number.isSafeInteger(Number(m[3])))return null;
  return 'https://github.com/'+m[1]+'/'+m[2]+'/pull/'+m[3];
 }catch{return null}
}
export function githubBranch(repository:string,branch:string){
 const repo=githubRepo(repository);
 if(!repo||!branch||branch.split('/').some(p=>!p||p==='.'||p==='..')||/[\u0000-\u001f\u007f]/.test(branch))return null;
 return repo+'/tree/'+encodeURIComponent(branch);
}

