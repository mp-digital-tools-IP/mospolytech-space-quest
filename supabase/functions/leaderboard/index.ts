// Public read/write gateway for the Space Quest leaderboard, deployed with --no-verify-jwt.
// Relies on SERVICE_ROLE_KEY secret within Supabase, NEVER in the browser.
import { createClient } from 'npm:@supabase/supabase-js@2';
const client = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
const ALLOWED = new Set(['https://mp-digital-tools-ip.github.io', 'http://localhost:4173', 'http://127.0.0.1:8000']);
function json(data: unknown, status = 200, origin = '') {
  const headers: Record<string,string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store',
    'Access-Control-Allow-Methods':'GET, POST, OPTIONS', 'Access-Control-Allow-Headers':'content-type' };
  if (ALLOWED.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), {status,headers});
}
function limit(n: unknown){return Math.max(0,Math.min(100,Math.round(Number(n)||0)))}
Deno.serve(async(req: Request)=>{
 const origin=req.headers.get('Origin')||'';
 if(origin && !ALLOWED.has(origin)) return json({error:'Origin not allowed'},403,'');
 if(req.method==='OPTIONS') return json({},204,origin);
 const url=new URL(req.url);
 if(!url.pathname.endsWith('/scores'))return json({error:'Not found'},404,origin);
 try{
  if(req.method==='GET'){
   const cap=Math.max(1,Math.min(1000,Number(url.searchParams.get('limit')||1000)||1000));
   const {data,error}=await client.from('space_quest_scores')
     .select('id,name,docking,landing,orbit,debris,total,updated_at')
     .order('total',{ascending:false}).order('updated_at',{ascending:true}).limit(cap);
   if(error)throw error;
   const entries=(data||[]).map((r:any)=>({id:r.id,name:r.name,total:r.total,updated:r.updated_at,scores:{
     docking:{points:r.docking},landing:{points:r.landing},orbit:{points:r.orbit},debris:{points:r.debris}
   }}));
   return json({entries},200,origin);
  }
  if(req.method==='POST'){
   if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Payload too large'},413,origin);
   let v:any;try{v=await req.json()}catch(_){return json({error:'Invalid JSON'},400,origin)}
   if(!v || typeof v.id!=='string' || !/^p[0-9a-z]{8,45}$/.test(v.id))return json({error:'Invalid player ID'},400,origin);
   const name=String(v.name||'').trim().replace(/\s+/g,' ');
   if(!/^[a-zа-яё0-9 _.-]{2,25}$/i.test(name))return json({error:'Invalid player name'},400,origin);
   const scores=v.scores||{};
   const vals=['docking','landing','orbit','debris'].map(id=>limit(scores[id]?.points));
   if(vals.every(n=>n===0))return json({error:'No completed mission'},400,origin);
   const {error}=await client.rpc('space_quest_upsert_best',{p_id:v.id,p_name:name,p_docking:vals[0],p_landing:vals[1],p_orbit:vals[2],p_debris:vals[3]});
   if(error)throw error;
   return json({ok:true},200,origin);
  }
  return json({error:'Method not allowed'},405,origin);
 }catch(e){console.error('Leaderboard server error',e);return json({error:'Server unavailable'},503,origin)}
});
