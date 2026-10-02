/*
 * MP-05 «Очистка орбиты»
 * Movement/collision/splitting mechanics are adapted from the browser game
 * Asteroids.js by James Socol (2010–2023). See upstream/LICENSE.txt.
 * Exhibition scenario, UI, rendering and touch controls are Moscow Polytech adaptation.
 */
(function(){
'use strict';

var W=800,H=600,PLAY_H=420;
var canvas,ctx,stars=[];
var ship,keys={left:false,right:false,up:false,fire:false};
var debris=[],bullets=[],particles=[],satellites=[];
var running=false,ended=false,wave=1,waveTransition=false;
var shield=3,errors=0,timeLeft=90,lastTime=0,acc=0;
var fireCooldown=0,invincible=0;
var clearedUnits=0,TOTAL_UNITS=24;
var STEP=1/60;

function $(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function dist(a,b){var dx=a.x-b.x,dy=a.y-b.y;return Math.sqrt(dx*dx+dy*dy)}
function wrap(o,margin){margin=margin||0;if(o.x<-margin)o.x=W+margin;if(o.x>W+margin)o.x=-margin;if(o.y<-margin)o.y=PLAY_H+margin;if(o.y>PLAY_H+margin)o.y=-margin}
function rand(a,b){return a+Math.random()*(b-a)}
function speed(o){return Math.sqrt(o.vx*o.vx+o.vy*o.vy)}

function createStars(){stars=[];for(var i=0;i<100;i++)stars.push({x:Math.random()*W,y:Math.random()*PLAY_H,r:Math.random()<.86?1:2,a:.2+Math.random()*.75,p:Math.random()*6.28})}
function makeShip(){return{x:W/2,y:PLAY_H/2,vx:0,vy:0,angle:-Math.PI/2,r:13}}
function shapePoints(n){var a=[];for(var i=0;i<n;i++)a.push(rand(.72,1.18));return a}
function spawnDebris(gen,x,y,vx,vy){
 var radius=gen===2?25:12;
 debris.push({x:x,y:y,vx:vx,vy:vy,r:radius,gen:gen,rot:Math.random()*6.28,spin:rand(-1.1,1.1),shape:shapePoints(10)});
}
function safeSpawn(gen){
 var x,y,tries=0;do{x=rand(45,W-45);y=rand(48,PLAY_H-45);tries++}while(Math.sqrt((x-ship.x)*(x-ship.x)+(y-ship.y)*(y-ship.y))<150&&tries<30);
 var a=Math.random()*Math.PI*2,s=gen===2?rand(20,36):rand(32,48);spawnDebris(gen,x,y,Math.cos(a)*s,Math.sin(a)*s);
}
function spawnSatellites(){
 satellites=[
  {x:125,y:105,vx:24,vy:7,r:18,angle:.12},
  {x:660,y:300,vx:-19,vy:-8,r:18,angle:-.18}
 ];
}
function spawnWave(n){
 debris=[];bullets=[];wave=n;waveTransition=false;
 var large=n===1?2:3;
 for(var i=0;i<large;i++)safeSpawn(2);
 satellites=[];if(n===3)spawnSatellites();
 $('wave-top').innerHTML=n+'/3';$('mission-status').innerHTML='MP-05 · '+n+'/3';
}
function resetCore(keepRunning){
 ship=makeShip();shield=3;errors=0;timeLeft=90;clearedUnits=0;wave=1;ended=false;waveTransition=false;fireCooldown=0;invincible=0;particles=[];satellites=[];keys={left:false,right:false,up:false,fire:false};spawnWave(1);running=!!keepRunning;lastTime=performance.now();acc=0;$('result-overlay').className='overlay';$('warning').className='';updateHUD();
}
function resetMission(){resetCore(false);$('start-overlay').className='overlay active'}
function resetQuick(){resetCore(true);$('start-overlay').className='overlay';try{if(navigator.vibrate)navigator.vibrate([30,20,30])}catch(e){}}
window.resetMission=resetMission;

function bindButton(btn,key){
 function down(e){if(e)e.preventDefault();keys[key]=true;if(key==='fire')firePulse()}
 function up(e){if(e)e.preventDefault();keys[key]=false}
 btn.addEventListener('touchstart',down,false);btn.addEventListener('touchend',up,false);btn.addEventListener('touchcancel',up,false);btn.addEventListener('mousedown',down,false);btn.addEventListener('mouseup',up,false);btn.addEventListener('mouseleave',up,false);
}
function bind(){
 var bs=document.querySelectorAll('.control[data-key]');for(var i=0;i<bs.length;i++)bindButton(bs[i],bs[i].getAttribute('data-key'));
 $('reset').onclick=resetQuick;
 window.addEventListener('keydown',function(e){if(e.keyCode===37)keys.left=true;if(e.keyCode===39)keys.right=true;if(e.keyCode===38)keys.up=true;if(e.keyCode===32){firePulse();e.preventDefault()}},false);
 window.addEventListener('keyup',function(e){if(e.keyCode===37)keys.left=false;if(e.keyCode===39)keys.right=false;if(e.keyCode===38)keys.up=false},false);
 if(('ontouchstart' in window)||(navigator.maxTouchPoints>0))$('controls').style.display='flex';
}
function firePulse(){
 if(!running||ended||fireCooldown>0)return;
 var c=Math.cos(ship.angle),s=Math.sin(ship.angle);
 bullets.push({x:ship.x+c*17,y:ship.y+s*17,vx:ship.vx+c*390,vy:ship.vy+s*390,r:3,life:1.25});
 fireCooldown=.16;try{if(navigator.vibrate)navigator.vibrate(18)}catch(e){}
}
function burst(x,y,color,count){for(var i=0;i<count;i++){var a=Math.random()*6.28,sp=rand(25,100);particles.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.25,.7),max:.7,color:color})}}
function hitDebris(index){
 var d=debris[index];if(!d)return;
 clearedUnits++;burst(d.x,d.y,d.gen===2?'#e51d2a':'#ffffff',d.gen===2?16:9);
 debris.splice(index,1);
 if(d.gen===2){
  var base=Math.atan2(d.vy,d.vx),s=rand(42,58);
  spawnDebris(1,d.x,d.y,Math.cos(base+.9)*s,Math.sin(base+.9)*s);
  spawnDebris(1,d.x,d.y,Math.cos(base-.9)*s,Math.sin(base-.9)*s);
 }
}
function satelliteMistake(s){
 errors++;burst(s.x,s.y,'#ffbe55',10);$('warning').className='show';setTimeout(function(){$('warning').className=''},850);try{if(navigator.vibrate)navigator.vibrate([70,35,70])}catch(e){}
 if(errors>=3)finish(false,'Три импульса попали по действующим спутникам. Сектор нельзя считать безопасно очищенным.');
}
function damage(reason){
 if(invincible>0||ended)return;shield--;invincible=1.15;burst(ship.x,ship.y,'#ff626c',18);try{if(navigator.vibrate)navigator.vibrate([100,35,80])}catch(e){};if(shield<=0)finish(false,reason||'Аппарат потерял защиту после столкновений с мусором.');
}
function checkCollisions(){
 var i,j,b,d,s;
 for(i=bullets.length-1;i>=0;i--){
  b=bullets[i];var removed=false;
  for(j=debris.length-1;j>=0;j--){d=debris[j];if(dist(b,d)<=b.r+d.r){bullets.splice(i,1);hitDebris(j);removed=true;break}}
  if(removed)continue;
  for(j=0;j<satellites.length;j++){s=satellites[j];if(dist(b,s)<=b.r+s.r){bullets.splice(i,1);satelliteMistake(s);break}}
 }
 if(invincible<=0){
  for(i=debris.length-1;i>=0;i--){d=debris[i];if(dist(ship,d)<=ship.r+d.r){hitDebris(i);damage('Аппарат получил критические повреждения при столкновениях с фрагментами.');break}}
  for(i=0;i<satellites.length;i++){s=satellites[i];if(dist(ship,s)<=ship.r+s.r){damage('Аппарат столкнулся с действующим спутником.');ship.vx*=-.65;ship.vy*=-.65;break}}
 }
}
function updateWave(){
 if(debris.length===0&&!waveTransition&&!ended){
  if(wave<3){waveTransition=true;var next=wave+1;$('mission-title').innerHTML='СЕКТОР ЧИСТ · ПЕРЕХОД К ВОЛНЕ '+next;setTimeout(function(){if(!ended)spawnWave(next)},650)}
  else finish(true,'Все три волны отработаны: опасные фрагменты удалены, действующие спутники сохранены.');
 }
}
function update(dt){
 if(!running||ended)return;
 timeLeft-=dt;if(timeLeft<=0){timeLeft=0;finish(false,'Время вышло: часть опасных объектов осталась в секторе.');return}
 if(fireCooldown>0)fireCooldown-=dt;if(invincible>0)invincible-=dt;
 if(keys.left)ship.angle-=3.3*dt;if(keys.right)ship.angle+=3.3*dt;
 if(keys.up){ship.vx+=Math.cos(ship.angle)*112*dt;ship.vy+=Math.sin(ship.angle)*112*dt;if(speed(ship)>175){var q=175/speed(ship);ship.vx*=q;ship.vy*=q}if(Math.random()<.7)particles.push({x:ship.x-Math.cos(ship.angle)*15,y:ship.y-Math.sin(ship.angle)*15,vx:-Math.cos(ship.angle)*rand(40,75),vy:-Math.sin(ship.angle)*rand(40,75),life:.3,max:.3,color:'#e51d2a'})}
 ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;wrap(ship,10);
 for(var i=debris.length-1;i>=0;i--){var d=debris[i];d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.spin*dt;wrap(d,d.r)}
 for(i=bullets.length-1;i>=0;i--){var b=bullets[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;wrap(b,2);if(b.life<=0)bullets.splice(i,1)}
 for(i=0;i<satellites.length;i++){var s=satellites[i];s.x+=s.vx*dt;s.y+=s.vy*dt;wrap(s,25)}
 for(i=particles.length-1;i>=0;i--){var p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1)}
 checkCollisions();updateWave();updateHUD();
}
function cleanliness(){return clamp(Math.round(clearedUnits/TOTAL_UNITS*100),0,100)}
function updateHUD(){
 var c=cleanliness();$('clean').innerHTML=c;$('clean-top').innerHTML=c+'%';$('debris-left').innerHTML=debris.length;$('shield').innerHTML=shield;$('errors').innerHTML=errors;$('time').innerHTML=Math.ceil(timeLeft);$('wave-top').innerHTML=wave+'/3';
 if(wave===1){$('mission-title').innerHTML='ВОЛНА 1 · ОСВОЙ УПРАВЛЕНИЕ';$('mission-hint').innerHTML='Разверни аппарат к фрагменту. Тяга меняет скорость, импульс летит по направлению носа.'}
 else if(wave===2){$('mission-title').innerHTML='ВОЛНА 2 · ПЛОТНЫЙ СЕКТОР';$('mission-hint').innerHTML='Крупные обломки распадаются. Не зависай на месте — используй инерцию и короткую тягу.'}
 else if(wave===3){$('mission-title').innerHTML='ВОЛНА 3 · РАБОТАЮЩИЕ СПУТНИКИ';$('mission-hint').innerHTML='Синие аппараты — действующие спутники. Три попадания по ним сорвут миссию.'}
}
function finish(success,reason){
 if(ended)return;ended=true;running=false;
 $('result-kicker').innerHTML=success?'МИССИЯ ВЫПОЛНЕНА':'МИССИЯ НЕ ВЫПОЛНЕНА';$('result-title').innerHTML=success?'Орбитальный сектор очищен':'Очистка прервана';$('result-title').style.color=success?'#44ff88':'#ff626c';$('result-text').innerHTML=reason+'<br><br>Очищено: <b>'+cleanliness()+'%</b> · Защита: <b>'+shield+'/3</b> · Ошибки: <b>'+errors+'/3</b> · Осталось времени: <b>'+Math.ceil(timeLeft)+' с</b>';
 try{if(navigator.vibrate)navigator.vibrate(success?[40,30,80]:[120,40,120])}catch(e){};setTimeout(function(){$('result-overlay').className='overlay active'},success?500:250)
}
function drawBackground(){
 var g=ctx.createLinearGradient(0,0,0,PLAY_H);g.addColorStop(0,'#050812');g.addColorStop(1,'#101827');ctx.fillStyle=g;ctx.fillRect(0,0,W,PLAY_H);
 var t=Date.now()/900;for(var i=0;i<stars.length;i++){var s=stars[i],a=s.a*(.58+.42*Math.sin(t*.32+s.p));ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.fillRect(s.x,s.y,s.r,s.r)}
 ctx.save();ctx.translate(W/2,500);ctx.strokeStyle='rgba(78,139,205,.13)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,235,Math.PI*1.08,Math.PI*1.92);ctx.stroke();ctx.beginPath();ctx.arc(0,0,285,Math.PI*1.08,Math.PI*1.92);ctx.stroke();ctx.restore();
 var earth=ctx.createRadialGradient(400,535,50,400,535,250);earth.addColorStop(0,'rgba(82,156,220,.42)');earth.addColorStop(.58,'rgba(25,75,120,.18)');earth.addColorStop(1,'rgba(10,35,70,0)');ctx.fillStyle=earth;ctx.beginPath();ctx.arc(400,535,250,0,Math.PI*2);ctx.fill();
}
function drawShip(){
 ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.angle);ctx.globalAlpha=invincible>0&&Math.floor(invincible*10)%2===0?.35:1;ctx.fillStyle='#f2f4f7';ctx.strokeStyle='#bcc3cd';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-12,10);ctx.lineTo(-8,0);ctx.lineTo(-12,-10);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#e51d2a';ctx.fillRect(-7,-5,5,10);ctx.fillStyle='#151925';ctx.beginPath();ctx.arc(5,0,3,0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawDebris(){
 for(var i=0;i<debris.length;i++){var d=debris[i];ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.beginPath();for(var k=0;k<d.shape.length;k++){var a=k/d.shape.length*Math.PI*2,r=d.r*d.shape[k],x=Math.cos(a)*r,y=Math.sin(a)*r;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.closePath();ctx.fillStyle=d.gen===2?'rgba(104,109,119,.78)':'rgba(133,139,150,.78)';ctx.strokeStyle=d.gen===2?'#d4d7dc':'#afb5bf';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();if(d.gen===2){ctx.strokeStyle='rgba(229,29,42,.5)';ctx.beginPath();ctx.moveTo(-d.r*.5,0);ctx.lineTo(d.r*.45,d.r*.25);ctx.stroke()}ctx.restore()}
}
function drawSatellites(){
 for(var i=0;i<satellites.length;i++){var s=satellites[i];ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.angle);ctx.fillStyle='#edf2f7';ctx.fillRect(-9,-6,18,12);ctx.fillStyle='#1c5b94';ctx.fillRect(-28,-5,15,10);ctx.fillRect(13,-5,15,10);ctx.strokeStyle='#76b7ed';ctx.strokeRect(-28,-5,15,10);ctx.strokeRect(13,-5,15,10);ctx.fillStyle='#44b7ff';ctx.font='bold 7px Arial';ctx.textAlign='center';ctx.fillText('ACTIVE',0,-10);ctx.restore()}
}
function drawBullets(){for(var i=0;i<bullets.length;i++){var b=bullets[i];ctx.fillStyle='#ff626c';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(229,29,42,.4)';ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.stroke()}}
function drawParticles(){for(var i=0;i<particles.length;i++){var p=particles[i],a=clamp(p.life/p.max,0,1);ctx.globalAlpha=a;ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,2.5,2.5)}ctx.globalAlpha=1}
function render(){ctx.clearRect(0,0,W,H);drawBackground();drawParticles();drawDebris();drawSatellites();drawBullets();drawShip()}
function frame(ts){if(!lastTime)lastTime=ts;acc+=Math.min(.12,(ts-lastTime)/1000);lastTime=ts;while(acc>=STEP){update(STEP);acc-=STEP}render();requestAnimationFrame(frame)}

window.startCountdown=function(){
 $('start-overlay').className='overlay';$('count-overlay').className='overlay active';var frames=[['3','СИСТЕМЫ ПЕРЕХВАТА ГОТОВЫ'],['2','ОРБИТАЛЬНЫЙ СЕКТОР ЗАХВАЧЕН'],['1','КАНАЛ ИМПУЛЬСА ГОТОВ'],['ПУСК','МИССИЯ MP-05']],i=0;function show(){$('countdown').innerHTML=frames[i][0];$('count-sub').innerHTML=frames[i][1];try{if(navigator.vibrate)navigator.vibrate(35)}catch(e){};i++;if(i<frames.length)setTimeout(show,540);else setTimeout(function(){$('count-overlay').className='overlay';running=true;lastTime=performance.now()},520)}show()
};
window.mpDebrisDebug={getState:function(){return{wave:wave,shield:shield,errors:errors,time:timeLeft,clean:cleanliness(),debris:debris.length,bullets:bullets.length,speed:speed(ship)}},fire:function(){firePulse()},forceWaveClear:function(){debris=[];updateWave()},forceSuccess:function(){wave=3;debris=[];waveTransition=false;finish(true,'Тестовое завершение сектора.')}};

function init(){canvas=$('gameCanvas');ctx=canvas.getContext('2d');createStars();bind();resetMission();requestAnimationFrame(frame)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
