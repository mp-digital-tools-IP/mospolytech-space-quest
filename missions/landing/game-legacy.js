/*
 * MP-03 Soft Landing
 * Physics and terrain logic adapted from:
 * cscazorla/javascript-videogame-lunar-lander
 * MIT License. Original license preserved in missions/landing/upstream/LICENSE.
 */
(function(){
'use strict';

var W=800,H=600,WORLD_BOTTOM=420;
var canvas,ctx;
var running=false,gameEnded=false,last=0,acc=0,step=1/60;
var keys={left:false,right:false,up:false};
var terrain=[],landingRange=[0,0];
var stars=[];
var particles=[];
var lander=null;
var CONFIG={
  gravity:30,
  thrust:70,
  rotate:5,
  fuel:1500,
  vmax:120,
  landingVerticalSpeed:30,
  landingHorizontalSpeed:25,
  landingAngle:16
};

function $(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function normAngle(rad){
  var d=rad*180/Math.PI;
  while(d>180)d-=360;
  while(d<-180)d+=360;
  return d;
}
function createStars(){
  stars=[];
  for(var i=0;i<85;i++)stars.push({x:Math.random()*W,y:Math.random()*WORLD_BOTTOM*.82,r:Math.random()<.82?1:2,a:.25+Math.random()*.75,p:Math.random()*6.28});
}
function generateTerrain(){
  var steps=32,minY=315,maxY=395,dx=W/steps;
  var zoneWidth=3;
  var zonePos=4+Math.floor(Math.random()*(steps-zoneWidth-9));
  var zoneY=330+Math.random()*45;
  terrain=[[0,maxY]];
  for(var i=0;i<steps;i++){
    if(i>=zonePos&&i<=zonePos+zoneWidth){
      terrain.push([dx*(i+1),zoneY]);
    }else{
      terrain.push([dx*(i+1),minY+Math.random()*(maxY-minY)]);
    }
  }
  landingRange=[terrain[zonePos+1][0],terrain[zonePos+1+zoneWidth][0]];
}
function initLander(){
  var center=(landingRange[0]+landingRange[1])/2;
  var startX=center+(Math.random()<.5?-1:1)*(180+Math.random()*90);
  startX=clamp(startX,90,W-90);
  lander={
    x:startX,y:82,
    vx:(center-startX)*.025,
    vy:8,
    theta:(Math.random()-.5)*.18,
    omega:0,
    fuel:CONFIG.fuel,
    crashed:false,landed:false
  };
}
function setPressed(name,value){keys[name]=value}
function bindControls(){
  window.addEventListener('keydown',function(e){
    if(e.keyCode===37)setPressed('left',true);
    if(e.keyCode===39)setPressed('right',true);
    if(e.keyCode===38){setPressed('up',true);e.preventDefault()}
  },false);
  window.addEventListener('keyup',function(e){
    if(e.keyCode===37)setPressed('left',false);
    if(e.keyCode===39)setPressed('right',false);
    if(e.keyCode===38)setPressed('up',false);
  },false);

  var buttons=document.querySelectorAll('.control');
  for(var i=0;i<buttons.length;i++){
    (function(btn){
      var key=btn.getAttribute('data-key');
      function down(e){if(e)e.preventDefault();setPressed(key,true)}
      function up(e){if(e)e.preventDefault();setPressed(key,false)}
      btn.addEventListener('touchstart',down,{passive:false});
      btn.addEventListener('touchend',up,{passive:false});
      btn.addEventListener('touchcancel',up,{passive:false});
      btn.addEventListener('mousedown',down,false);
      btn.addEventListener('mouseup',up,false);
      btn.addEventListener('mouseleave',up,false);
    })(buttons[i]);
  }
  if(('ontouchstart' in window)||(navigator.maxTouchPoints>0))$('touch-controls').style.display='flex';
}
function terrainHeightAt(x){
  for(var i=0;i<terrain.length-1;i++){
    var a=terrain[i],b=terrain[i+1];
    if(x>=a[0]&&x<=b[0]){
      var t=(x-a[0])/(b[0]-a[0]||1);
      return a[1]+(b[1]-a[1])*t;
    }
  }
  return WORLD_BOTTOM;
}
function directionVectors(theta){
  var ca=Math.cos(theta),sa=Math.sin(theta);
  return {
    thrust:{x:sa,y:-ca},
    exhaust:{x:-sa,y:ca}
  };
}
function spawnExhaust(){
  var d=directionVectors(lander.theta).exhaust;
  var bx=lander.x+d.x*15,by=lander.y+d.y*15;
  for(var i=0;i<3;i++){
    var speed=30+Math.random()*22;
    particles.push({
      x:bx+(Math.random()-.5)*5,
      y:by+(Math.random()-.5)*3,
      vx:d.x*speed+(Math.random()-.5)*8,
      vy:d.y*speed+(Math.random()-.5)*8,
      life:16+Math.random()*15
    });
  }
}
function explode(){
  for(var i=0;i<55;i++){
    var a=Math.random()*Math.PI*2,s=25+Math.random()*75;
    particles.push({x:lander.x,y:lander.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:35+Math.random()*45,boom:true});
  }
}
function updateParticles(dt){
  for(var i=particles.length-1;i>=0;i--){
    var p=particles[i];
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.vy+=(p.boom?18:8)*dt;
    p.life-=1;
    if(p.life<=0)particles.splice(i,1);
  }
}
function finish(success,reason){
  if(gameEnded)return;
  gameEnded=true;running=false;
  lander.landed=success;lander.crashed=!success;
  if(!success)explode();
  try{
    if(navigator.vibrate)navigator.vibrate(success?[40,30,80]:[120,40,120]);
  }catch(e){}
  var verticalSpeed=Math.abs(lander.vy);
  var horizontalSpeed=Math.abs(lander.vx);
  var angle=Math.abs(normAngle(lander.theta));
  $('result-kicker').innerHTML=success?'МИССИЯ ВЫПОЛНЕНА':'МИССИЯ НЕ ВЫПОЛНЕНА';
  $('result-title').innerHTML=success?'Мягкая посадка выполнена':'Посадка сорвана';
  $('result-title').style.color=success?'#44ff88':'#ff626c';
  var msg=reason+'<br><br>V↓: <b>'+verticalSpeed.toFixed(1)+' м/с</b> · V→: <b>'+horizontalSpeed.toFixed(1)+' м/с</b> · Угол: <b>'+angle.toFixed(1)+'°</b> · Топливо: <b>'+Math.max(0,Math.round(lander.fuel/CONFIG.fuel*100))+'%</b>';
  $('result-text').innerHTML=msg;
  setTimeout(function(){$('result-overlay').className='overlay active'},success?650:350);
}
function update(dt){
  if(!running||gameEnded)return;

  var thrusting=lander.fuel>0&&keys.up;
  var thrust=thrusting?1:0;
  if(thrusting){lander.fuel=Math.max(0,lander.fuel-1);spawnExhaust()}

  var thrustDir=directionVectors(lander.theta).thrust;
  var ax=thrust*CONFIG.thrust*thrustDir.x;
  var ay=CONFIG.gravity+thrust*CONFIG.thrust*thrustDir.y;
  lander.vx=clamp(lander.vx+ax*dt,-CONFIG.vmax,CONFIG.vmax);
  lander.vy=clamp(lander.vy+ay*dt,-CONFIG.vmax,CONFIG.vmax);
  lander.x+=lander.vx*dt;
  lander.y+=lander.vy*dt;

  var direction=keys.left?-1:(keys.right?1:0);
  lander.omega+=direction*CONFIG.rotate*dt-0.75*lander.omega*dt;
  lander.theta+=lander.omega*dt;

  if(lander.x<15||lander.x>W-15||lander.y<0){
    finish(false,'Аппарат вышел за безопасный коридор.');
    return;
  }

  var ground=terrainHeightAt(lander.x);
  var bottom=lander.y+16;
  if(bottom>=ground){
    var verticalSpeed=Math.max(0,lander.vy);
    var horizontalSpeed=Math.abs(lander.vx);
    var angle=Math.abs(normAngle(lander.theta));
    var inZone=lander.x>=landingRange[0]&&lander.x<=landingRange[1];
    if(inZone&&verticalSpeed<=CONFIG.landingVerticalSpeed&&horizontalSpeed<=CONFIG.landingHorizontalSpeed&&angle<=CONFIG.landingAngle&&lander.vy>=0){
      lander.y=ground-16;
      finish(true,'Ты посадил модуль точно в отмеченной зоне.');
    }else{
      var why=!inZone?'Касание произошло вне посадочной площадки.':
              verticalSpeed>CONFIG.landingVerticalSpeed?'Вертикальная скорость была слишком высокой. Нужно не более '+CONFIG.landingVerticalSpeed+' м/с.':
              horizontalSpeed>CONFIG.landingHorizontalSpeed?'Слишком большой боковой снос. Нужно не более '+CONFIG.landingHorizontalSpeed+' м/с.':
              'Аппарат коснулся поверхности с большим наклоном.';
      finish(false,why);
    }
  }

  updateParticles(dt);
}
function drawBackground(){
  var g=ctx.createLinearGradient(0,0,0,WORLD_BOTTOM);
  g.addColorStop(0,'#050812');g.addColorStop(1,'#111827');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,WORLD_BOTTOM);
  var t=Date.now()/650;
  for(var i=0;i<stars.length;i++){
    var s=stars[i],a=s.a*(.55+.45*Math.sin(t*.3+s.p));
    ctx.fillStyle='rgba(255,255,255,'+a+')';
    ctx.fillRect(s.x,s.y,s.r,s.r);
  }
  var glow=ctx.createRadialGradient(700,340,20,700,340,150);
  glow.addColorStop(0,'rgba(49,111,181,.16)');glow.addColorStop(1,'rgba(49,111,181,0)');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(700,340,150,0,Math.PI*2);ctx.fill();
}
function drawTerrain(){
  ctx.beginPath();ctx.moveTo(terrain[0][0],terrain[0][1]);
  for(var i=1;i<terrain.length;i++)ctx.lineTo(terrain[i][0],terrain[i][1]);
  ctx.lineTo(W,WORLD_BOTTOM);ctx.lineTo(0,WORLD_BOTTOM);ctx.closePath();
  var gr=ctx.createLinearGradient(0,315,0,WORLD_BOTTOM);
  gr.addColorStop(0,'#555b66');gr.addColorStop(1,'#292d35');
  ctx.fillStyle=gr;ctx.fill();
  ctx.strokeStyle='#aeb5bf';ctx.lineWidth=2;ctx.stroke();

  var y=terrainHeightAt((landingRange[0]+landingRange[1])/2);
  ctx.strokeStyle='#e51d2a';ctx.lineWidth=6;ctx.beginPath();
  ctx.moveTo(landingRange[0],y-2);ctx.lineTo(landingRange[1],y-2);ctx.stroke();
  ctx.fillStyle='#e51d2a';ctx.font='bold 10px Arial';ctx.textAlign='center';
  ctx.fillText('ПОСАДОЧНАЯ ЗОНА', (landingRange[0]+landingRange[1])/2, y-13);
}
function drawLander(){
  if(lander.crashed)return;
  ctx.save();ctx.translate(lander.x,lander.y);ctx.rotate(lander.theta);
  ctx.fillStyle='#f4f6f8';ctx.strokeStyle='#b7bdc7';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(13,8);ctx.lineTo(8,14);ctx.lineTo(-8,14);ctx.lineTo(-13,8);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#e51d2a';ctx.fillRect(-10,4,20,5);
  ctx.fillStyle='#151925';ctx.beginPath();ctx.arc(0,-4,4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#b7bdc7';ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(-8,12);ctx.lineTo(-16,20);ctx.lineTo(-22,20);
  ctx.moveTo(8,12);ctx.lineTo(16,20);ctx.lineTo(22,20);ctx.stroke();
  ctx.fillStyle='#11141b';ctx.font='bold 6px Arial';ctx.textAlign='center';ctx.fillText('MP',0,3);
  ctx.restore();
}
function drawParticles(){
  for(var i=0;i<particles.length;i++){
    var p=particles[i],alpha=Math.max(0,p.life/50);
    ctx.fillStyle=p.boom?'rgba(229,29,42,'+alpha+')':'rgba(255,175,80,'+alpha+')';
    ctx.beginPath();ctx.arc(p.x,p.y,p.boom?3:2,0,Math.PI*2);ctx.fill();
  }
}
function render(){
  ctx.clearRect(0,0,W,H);
  drawBackground();drawTerrain();drawParticles();drawLander();

  if(!lander)return;
  var speed=Math.sqrt(lander.vx*lander.vx+lander.vy*lander.vy);
  var verticalSpeed=Math.abs(lander.vy);
  var horizontalSpeed=Math.abs(lander.vx);
  var angle=Math.abs(normAngle(lander.theta));
  var alt=Math.max(0,terrainHeightAt(lander.x)-(lander.y+16));
  $('altitude').innerHTML=Math.round(alt);
  $('velocity').innerHTML=speed.toFixed(1);
  $('vvelocity').innerHTML=verticalSpeed.toFixed(1);
  $('angle').innerHTML=angle.toFixed(0);
  $('fuel').innerHTML=Math.max(0,Math.round(lander.fuel/CONFIG.fuel*100));
  $('vvelocity').style.color=verticalSpeed<=CONFIG.landingVerticalSpeed?'#44ff88':'#ffbe55';

  var warn=verticalSpeed>CONFIG.landingVerticalSpeed&&alt<120;
  $('warning').className=warn?'show':'';

  if(alt>180){
    $('mission-title').innerHTML='ЭТАП 1 · СБЛИЖЕНИЕ';
    $('mission-hint').innerHTML='Найди красную площадку и начни смещаться к ней. Не трать топливо непрерывно.';
  }else if(alt>65){
    $('mission-title').innerHTML='ЭТАП 2 · ТОРМОЖЕНИЕ';
    $('mission-hint').innerHTML=verticalSpeed>CONFIG.landingVerticalSpeed?'Гаси вертикальную скорость до '+CONFIG.landingVerticalSpeed+' м/с или ниже.':'Вертикальная скорость уже в допустимом диапазоне. Держи аппарат над площадкой.';
  }else{
    $('mission-title').innerHTML='ЭТАП 3 · КАСАНИЕ';
    $('mission-hint').innerHTML=(verticalSpeed<=CONFIG.landingVerticalSpeed&&horizontalSpeed<=CONFIG.landingHorizontalSpeed&&angle<=CONFIG.landingAngle)?'ЗЕЛЁНЫЙ РЕЖИМ: V↓ ≤ '+CONFIG.landingVerticalSpeed+' м/с. Удерживай ориентацию до касания.':'Для посадки: V↓ ≤ '+CONFIG.landingVerticalSpeed+' м/с, боковой снос ≤ '+CONFIG.landingHorizontalSpeed+' м/с, угол ≤ '+CONFIG.landingAngle+'°.';
  }
}
function frame(ts){
  if(!last)last=ts;
  acc+=Math.min(.12,(ts-last)/1000);last=ts;
  while(acc>=step){update(step);acc-=step}
  updateParticles(step);
  render();
  requestAnimationFrame(frame);
}
function newMission(){
  generateTerrain();createStars();initLander();
  particles=[];gameEnded=false;running=false;last=0;acc=0;
  $('result-overlay').className='overlay';
  $('start-overlay').className='overlay active';
  $('warning').className='';
  keys={left:false,right:false,up:false};
}
window.startCountdown=function(){
  $('start-overlay').className='overlay';
  $('count-overlay').className='overlay active';
  var frames=[['3','СИСТЕМЫ ГОТОВЫ'],['2','ПОСАДОЧНЫЙ РАДАР АКТИВЕН'],['1','ТЯГА ГОТОВА'],['ПУСК','МИССИЯ MP-03']];
  var i=0;
  function show(){
    $('countdown').innerHTML=frames[i][0];$('count-sub').innerHTML=frames[i][1];
    try{if(navigator.vibrate)navigator.vibrate(40)}catch(e){}
    i++;
    if(i<frames.length)setTimeout(show,560);
    else setTimeout(function(){$('count-overlay').className='overlay';running=true;last=performance.now()},550);
  }
  show();
};
window.resetMission=function(){newMission()};
window.mpLandingDebug={
  getLander:function(){return lander},
  getLandingRange:function(){return landingRange.slice()},
  getLimits:function(){return {vertical:CONFIG.landingVerticalSpeed,horizontal:CONFIG.landingHorizontalSpeed,angle:CONFIG.landingAngle}},
  getDirectionVectors:function(angleDeg){return directionVectors(angleDeg*Math.PI/180)},
  forceSuccess:function(){
    var x=(landingRange[0]+landingRange[1])/2;
    lander.x=x;lander.y=terrainHeightAt(x)-17;lander.vx=0;lander.vy=1;lander.theta=0;running=true;gameEnded=false;
  },
  forceLanding:function(vx,vy,angleDeg){
    var x=(landingRange[0]+landingRange[1])/2;
    lander.x=x;lander.y=terrainHeightAt(x)-17;lander.vx=vx;lander.vy=vy;lander.theta=angleDeg*Math.PI/180;running=true;gameEnded=false;
  }
};

function init(){
  canvas=$('gameCanvas');ctx=canvas.getContext('2d');
  bindControls();newMission();requestAnimationFrame(frame);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();