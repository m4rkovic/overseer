import {defineConfig,loadEnv} from 'vite';

export default defineConfig(({command,mode})=>{
  if(command!=='build')return {base:'./'};
  const env=loadEnv(mode,process.cwd(),'VITE_');
  const url=new URL(env.VITE_SUPABASE_URL||'https://ihbauxyledvtdnzyulzz.supabase.co');
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)
    throw new Error('Production Supabase URL must be an HTTPS origin');
  const key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(key&&!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error('Production browser builds require a Supabase publishable key, never a privileged or secret key');
  const policy=[
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' "+url.origin,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ');
  return {
    base:'./',
    plugins:[{
      name:'overseer-production-csp',
      transformIndexHtml(){
        return [{tag:'meta',attrs:{'http-equiv':'Content-Security-Policy',content:policy},injectTo:'head-prepend'}];
      }
    }]
  };
});
