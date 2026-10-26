/* Космические миссии МП — безопасное локальное хранение игровых результатов.
   Общая таблица активируется после настройки assets/leaderboard-config.js. */
(function(root){
'use strict';
var KEY='mp_space_rankings_v1',PLAYER='mp_space_player_v1',CURRENT='mp_space_current_scores_v1';
var MISSIONS=['docking','landing','orbit','debris'];
function clamp(x,a,b){return Math.max(a,Math.min(b,Number(x)||0))}
function read(store,key,fallback){try{var x=JSON.parse(store.getItem(key));return x===null?fallback:x}catch(e){return fallback}}
function write(store,key,x){try{store.setItem(key,JSON.stringify(x));return true}catch(e){return false}}
function cleanName(name){return String(name||'').replace(/[<>\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,25)}
function player(){var p=read(sessionStorage,PLAYER,null);return p&&p.id&&p.name?p:null}
function uid(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,12)}
function current(){return read(sessionStorage,CURRENT,{})||{}}
function table(){var v=read(localStorage,KEY,[]);return Array.isArray(v)?v:[]}
function total(scores){return MISSIONS.reduce(function(sum,id){return sum+clamp(scores&&scores[id]&&scores[id].points,0,100)},0)}
function entries(list){return list.slice().map(function(e){return {id:e.id,name:e.name,scores:e.scores||{},total:total(e.scores),updated:e.updated||0}}).sort(function(a,b){return b.total-a.total||a.updated-b.updated})}
function apiUrl(){return (root.MP_LEADERBOARD_API||'').replace(/\/+$/,'')}
function setName(name){
 name=cleanName(name);if(!/^[a-zа-яё0-9 _.-]{2,25}$/i.test(name))return {ok:false,message:'Имя: 2–25 символов, буквы, цифры, пробел, дефис или точка.'};
 var p=player();if(!p)p={id:uid(),name:name};else p.name=name;
 write(sessionStorage,PLAYER,p);
 var scores=current();if(Object.keys(scores).length){updateLocal(p,scores);postRemote(p)}
 return {ok:true,player:p}
}
function clearPlayer(){try{sessionStorage.removeItem(PLAYER);sessionStorage.removeItem(CURRENT)}catch(e){}}
function updateLocal(p,scores){
 if(!p)return;
 var list=table(),record=null;
 for(var i=0;i<list.length;i++){if(list[i].id===p.id){record=list[i];break}}
 if(!record){record={id:p.id,name:p.name,scores:{},updated:Date.now()};list.push(record)}
 record.name=p.name;
 MISSIONS.forEach(function(id){var s=scores[id];if(s&&(!record.scores[id]||s.points>record.scores[id].points))record.scores[id]=s});
 record.updated=Date.now();
 write(localStorage,KEY,entries(list).map(function(e){return {id:e.id,name:e.name,scores:e.scores,updated:e.updated}}));
}
function getNum(text,label,fallback){
 var pattern=new RegExp(label+'[^\\d-]*(-?\\d+(?:[.,]\\d+)?)','i');
 var m=pattern.exec(String(text||''));
 return m?Number(m[1].replace(',','.')):fallback
}
function calculate(id){
 var detail=document.getElementById(id==='docking'?'msg-detail':'result-text');
 var t=detail?detail.textContent||detail.innerText||'':'';
 var base=60,bonus=0,parts=[];
 if(id==='docking'){
   var fuel=clamp(getNum(t,'Топливо',50),0,100),vx=clamp(getNum(t,'ΔVx',10),0,50),vy=clamp(getNum(t,'ΔVy',10),0,50),sec=clamp(getNum(t,'Время',60),0,300);
   var a=Math.round(15*fuel/100),b=Math.round(15*clamp(1-(vx+vy)/35,0,1)),c=Math.round(10*clamp(1-sec/120,0,1));
   bonus=a+b+c;parts=['Топливо +'+a,'Точность +'+b,'Время +'+c];
 }else if(id==='landing'){
   var land=root.mpLandingDebug&&root.mpLandingDebug.getLander?root.mpLandingDebug.getLander():null;
   var fuel=clamp(land?land.fuel/1500*100:getNum(t,'Топливо',50),0,100);
   var down=clamp(land?Math.abs(land.vy):getNum(t,'V↓',20),0,100);
   var side=clamp(land?Math.abs(land.vx):getNum(t,'V→',10),0,100);
   var tilt=clamp(getNum(t,'Угол',0),0,180);
   var a=Math.round(12*clamp(1-down/30,0,1)),b=Math.round(9*clamp(1-side/25,0,1)),c=Math.round(13*fuel/100),d=Math.round(6*clamp(1-tilt/16,0,1));
   bonus=a+b+c+d;parts=['Снижение +'+a,'Снос +'+b,'Топливо +'+c,'Угол +'+d];
 }else if(id==='orbit'){
   var dbg=root.mpOrbitDebug;var el=dbg&&dbg.getElements?dbg.getElements():null;
   var peri=el?el.peri:getNum(t,'Перигей',1.4),apo=el?el.apo:getNum(t,'Апогей',1.4),ecc=el?el.e:getNum(t,'e:',0.04);
   var burns=dbg&&dbg.getBurns?dbg.getBurns():getNum(t,'Осталось импульсов',5);
   var a=Math.round(18*clamp(1-(Math.abs(peri-1.4)+Math.abs(apo-1.4))/.20,0,1));
   var b=Math.round(9*clamp(1-ecc/.055,0,1)),c=Math.round(13*clamp(burns/15,0,1));
   bonus=a+b+c;parts=['Точность орбиты +'+a,'Круговая форма +'+b,'Экономия импульсов +'+c];
 }else if(id==='debris'){
   var dbg=root.mpDebrisDebug;var s=dbg&&dbg.getState?dbg.getState():{};
   var shield=clamp(s.shield===undefined?getNum(t,'Защита',2):s.shield,0,3);
   var errors=clamp(s.errors===undefined?getNum(t,'Ошибки',0):s.errors,0,3);
   var left=clamp(s.time===undefined?getNum(t,'Время',40):s.time,0,90);
   var a=Math.round(15*shield/3),b=Math.round(15*left/90),c=Math.round(10*(3-errors)/3);
   bonus=a+b+c;parts=['Сохранность +'+a,'Время +'+b,'Безопасность +'+c];
 }
 return {points:clamp(base+bonus,60,100),base:base,bonus:bonus,parts:parts};
}
function postRemote(p){var url=apiUrl();if(!url||!p)return Promise.resolve(false);
 return fetch(url+'/scores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:p.id,name:p.name,scores:current()})}).then(function(r){return r.ok}).catch(function(){return false});
}
function recordMission(id,sc){
 if(MISSIONS.indexOf(id)<0||!sc)return null;
 var all=current(),old=all[id];
 if(!old||sc.points>old.points)all[id]={points:Math.round(clamp(sc.points,0,100)),base:sc.base,bonus:sc.bonus,parts:sc.parts,at:Date.now()};
 write(sessionStorage,CURRENT,all);
 var p=player();if(p){updateLocal(p,all);postRemote(p)}
 return all[id];
}
function getLast(id){return current()[id]||null}
function leaderboard(){
 var p=player(),arr=entries(table());var url=apiUrl();
 if(!url)return Promise.resolve({source:'local',entries:arr});
 return fetch(url+'/scores?limit=1000',{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(function(j){
  if(!j||!Array.isArray(j.entries))throw Error('Некорректный ответ сервера');
  return {source:'global',entries:j.entries};
 }).catch(function(){return {source:'offline',entries:arr}});
}
root.mpScore={
 setName:setName,player:player,clearPlayer:clearPlayer,recordMission:recordMission,calculate:calculate,
 getLast:getLast,current:current,total:total,entries:entries,local:table,leaderboard:leaderboard,
 apiReady:function(){return !!apiUrl()},cleanName:cleanName
};
})(window);
