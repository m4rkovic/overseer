import React,{useEffect,useState,lazy,Suspense} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db} from './lib/supabase';
import {message} from './domain';
import {Field} from './components/primitives';
const Workspace=lazy(()=>import('./Workspace').then(module=>({default:module.Workspace})));
export function App(){
 const [session,setSession]=useState<Session|null>(null),[initial,setInitial]=useState(true),[authError,setAuthError]=useState('');
 useEffect(()=>{let alive=true,authEventReceived=false;db.auth.getSession().then(({data,error})=>{if(alive&&!authEventReceived){setSession(data.session);setAuthError(error?.message||'');setInitial(false)}}).catch(()=>{if(alive&&!authEventReceived){setAuthError('Unable to initialize authentication. Try signing in again.');setInitial(false)}});const {data}=db.auth.onAuthStateChange((_event,next)=>{if(alive){authEventReceived=true;setSession(next);setInitial(false)}});return()=>{alive=false;data.subscription.unsubscribe()}},[]);
 if(initial)return <main className="login"><p>Initializing workspace…</p></main>;
 if(!session)return <Login error={authError}/>;
 return <Suspense fallback={<main className="login"><p>Loading workspace…</p></main>}><Workspace key={session.user.id} session={session}/></Suspense>;
}
function Login({error}:{error:string}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[notice,setNotice]=useState(error),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice('');try{const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error}catch(e){setNotice(message(e))}finally{setBusy(false)}}
 return <main className="login"><form className="login-panel" onSubmit={submit}><div className="login-brand"><h1>OVERSEER<span>.</span></h1><p>One workspace. Total oversight.</p></div><Field label="Email"><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></Field><Field label="Password"><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><button disabled={busy} className="primary">{busy?'Signing in…':'Sign in'}</button>{notice&&<p role="alert" className="error">{notice}</p>}<small>Access is provisioned by the workspace administrator.</small></form></main>
}
