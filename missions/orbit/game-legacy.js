/*
 * MP-04 Orbit Insertion
 * Orbital mechanics and RK4 integration adapted from:
 * hiroyuki-suwa/orbit-simulator (MIT License, Copyright 2025 SUWA Hiroyuki)
 * Original source and license are preserved in missions/orbit/upstream/.
 */
(function(){
'use strict';

var W=800,H=600,PLAY_H=420;
var CX=400,CY=210,SCALE=132;
var MU=1,EARTH_R=0.42,TARGET_MIN=1.33,TARGET_MAX=1.47;
var TARGET_CENTER=(TARGET_MIN+TARGET_MAX)/2;
var DT=0.018;
var canvas,ctx,state,trail,stars,running=false,ended=false,last=0,acc=0;
var hold=0,HOLD_NEEDED=4.2;
var MAX_BURNS=15,burnBudget=MAX_BURNS,BURN_STEP=0.04;
var burnAngle=0,ANGLE_STEP=5,MAX_ANGLE=35;

function $(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function norm(x,y){return Math.sqrt(x*x+y*y)}
function copyState(s){return {x:s.x,y:s.y,vx:s.vx,vy:s.vy}}

function acceleration(s){
  var r2=s.x*s.x+s.y*s.y;
  var r=Math.sqrt(r2);
  var f=-MU/(r2*r);
  return {ax:f*s.x,ay:f*s.y};
}
function deriv(s){
  var a=acceleration(s);
  return {x:s.vx,y:s.vy,vx:a.ax,vy:a.ay};
}
function addState(s,k,h){
  return {x:s.x+k.x*h,y:s.y+k.y*h,vx:s.vx+k.vx*h,vy:s.vy+k.vy*h};
}
function rk4(s,dt){
  var k1=deriv(s);
  var k2=deriv(addState(s,k1,dt/2));
  var k3=deriv(addState(s,k2,dt/2));
  var k4=deriv(addState(s,k3,dt));
  return {
    x:s.x+dt*(k1.x+2*k2.x+2*k3.x+k4.x)/6,
    y:s.y+dt*(k1.y+2*k2.y+2*k3.y+k4.y)/6,
    vx:s.vx+dt*(k1.vx+2*k2.vx+2*k3.vx+k4.vx)/6,
    vy:s.vy+dt*(k1.vy+2*k2.vy+2*k3.vy+k4.vy)/6
  };
}
function elements(s){
  var r=norm(s.x,s.y),v2=s.vx*s.vx+s.vy*s.vy;
  var energy=v2/2-MU/r;
  var h=s.x*s.vy-s.y*s.vx;
  if(energy>=0)return {r:r,peri:0,apo:999,e:9,energy:energy,h:h};
  var a=-MU/(2*energy);
  var e=Math.sqrt(Math.max(0,1+2*energy*h*h/(MU*MU)));
  return {r:r,peri:a*(1-e),apo:a*(1+e),e:e,a:a,energy:energy,h:h};
}
function unitVelocity(s){
  var v=norm(s.vx,s.vy)||1;
  return {x:s.vx/v,y:s.vy/v};
}
function burnDirection(s){
  var u=unitVelocity(s);
  var a=burnAngle*Math.PI/180;
  return {x:u.x*Math.cos(a)-u.y*Math.sin(a),y:u.x*Math.sin(a)+u.y*Math.cos(a)};
}
function updateAngleReadout(){
  var text=(burnAngle>0?'+':'')+burnAngle+'°';
  if($('burn-angle'))$('burn-angle').innerHTML=text;
  if($('angle-telemetry'))$('angle-telemetry').innerHTML=text;
}
function changeBurnAngle(delta){
  if(ended)return;
  burnAngle=clamp(burnAngle+delta,-MAX_ANGLE,MAX_ANGLE);
  updateAngleReadout();
  try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}
}
function radialVelocity(s){
  var r=norm(s.x,s.y)||1;
  return (s.x*s.vx+s.y*s.vy)/r;
}
function orbitQuality(el){
  return el.peri>=TARGET_MIN&&el.peri<=TARGET_MAX&&el.apo>=TARGET_MIN&&el.apo<=TARGET_MAX&&el.e<=0.055;
}
function createStars(){
  stars=[];
  for(var i=0;i<90;i++)stars.push({x:Math.random()*W,y:Math.random()*PLAY_H,r:Math.random()<.85?1:2,a:.2+Math.random()*.75,p:Math.random()*6.28});
}
function resetCore(keepRunning){
  state={x:1.0,y:0,vx:0,vy:1.0};
  trail=[];hold=0;burnBudget=MAX_BURNS;burnAngle=0;ended=false;last=performance.now();acc=0;
  running=!!keepRunning;
  $('burns').innerHTML=burnBudget;
  updateAngleReadout();
  $('holdfill').style.width='0%';$('holdbar').className='';
  $('result-overlay').className='overlay';
}
function resetState(){
  resetCore(false);
  $('start-overlay').className='overlay active';
}
function resetManeuver(){
  resetCore(true);
  $('start-overlay').className='overlay';
  var flash=$('burn-flash');
  if(flash){flash.className='active';setTimeout(function(){flash.className=''},300)}
  try{if(navigator.vibrate)navigator.vibrate([35,25,35])}catch(e){}
}
function burn(sign){
  if(!running||ended||burnBudget<=0)return;
  var u=burnDirection(state);
  state.vx+=u.x*BURN_STEP*sign;
  state.vy+=u.y*BURN_STEP*sign;
  burnBudget--;
  $('burns').innerHTML=burnBudget;
  var flash=$('burn-flash');flash.className='active';
  setTimeout(function(){flash.className=''},300);
  try{if(navigator.vibrate)navigator.vibrate(35)}catch(e){}
}
function bind(){
  $('prograde').onclick=function(){burn(1)};
  $('retrograde').onclick=function(){burn(-1)};
  if($('angle-left'))$('angle-left').onclick=function(){changeBurnAngle(-ANGLE_STEP)};
  if($('angle-right'))$('angle-right').onclick=function(){changeBurnAngle(ANGLE_STEP)};
  var controls=$('controls');
  var resetButton=document.getElementById('reset-orbit');
  if(resetButton)resetButton.onclick=resetManeuver;
  if(!resetButton&&controls){
    resetButton=document.createElement('button');
    resetButton.id='reset-orbit';
    resetButton.type='button';
    resetButton.className='burn';
    resetButton.innerHTML='СБРОС<small>ЗАНОВО</small>';
    resetButton.style.minWidth='82px';
    resetButton.style.width='82px';
    resetButton.style.background='#252a34';
    resetButton.style.borderColor='#626a78';
    resetButton.onclick=resetManeuver;
    controls.appendChild(resetButton);
    controls.style.width='330px';
    controls.style.minWidth='330px';
  }
  var intro=document.querySelector('#start-overlay .card p');
  if(intro)intro.innerHTML='Спутник находится на низкой круговой орбите. У тебя <b>15 коротких импульсов</b>. Управляй величиной ΔV и <b>углом импульса</b>, чтобы перевести аппарат в красный орбитальный коридор и стабилизировать траекторию.';
  if(('ontouchstart' in window)||(navigator.maxTouchPoints>0))controls.style.display='flex';
}
function finish(success,reason){
  if(ended)return;
  ended=true;running=false;
  var el=elements(state);
  $('result-kicker').innerHTML=success?'МИССИЯ ВЫПОЛНЕНА':'МИССИЯ НЕ ВЫПОЛНЕНА';
  $('result-title').innerHTML=success?'Орбита стабилизирована':'Орбита потеряна';
  $('result-title').style.color=success?'#44ff88':'#ff626c';
  $('result-text').innerHTML=reason+'<br><br>Перигей: <b>'+el.peri.toFixed(2)+' R</b> · Апогей: <b>'+el.apo.toFixed(2)+' R</b> · e: <b>'+el.e.toFixed(3)+'</b> · Угол последнего направления: <b>'+(burnAngle>0?'+':'')+burnAngle+'°</b> · Осталось импульсов: <b>'+burnBudget+'</b>';
  try{if(navigator.vibrate)navigator.vibrate(success?[40,30,80]:[120,40,120])}catch(e){}
  setTimeout(function(){$('result-overlay').className='overlay active'},success?500:250);
}
function update(){
  if(!running||ended)return;
  state=rk4(state,DT);
  trail.push({x:state.x,y:state.y});
  if(trail.length>700)trail.shift();

  var el=elements(state);
  var r=el.r;
  if(r<=EARTH_R+0.035){finish(false,'Спутник вошёл в атмосферу и потерян.');return}
  if(r>2.45||el.energy>=0){finish(false,'Аппарат получил слишком большую скорость и ушёл с рабочей орбиты.');return}

  if(orbitQuality(el)){
    hold+=DT;
    $('holdbar').className='show';
    $('holdfill').style.width=clamp(hold/HOLD_NEEDED*100,0,100)+'%';
    if(hold>=HOLD_NEEDED){finish(true,'Спутник удержался в целевом орбитальном коридоре.');return}
  }else{
    hold=Math.max(0,hold-DT*1.6);
    $('holdfill').style.width=clamp(hold/HOLD_NEEDED*100,0,100)+'%';
    if(hold<=0)$('holdbar').className='';
  }
}
function toScreen(x,y){return {x:CX+x*SCALE,y:CY+y*SCALE}}
function drawBackground(){
  var g=ctx.createLinearGradient(0,0,0,PLAY_H);
  g.addColorStop(0,'#050812');g.addColorStop(1,'#0d1422');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,PLAY_H);
  var t=Date.now()/900;
  for(var i=0;i<stars.length;i++){
    var s=stars[i],a=s.a*(.6+.4*Math.sin(t*.35+s.p));
    ctx.fillStyle='rgba(255,255,255,'+a+')';
    ctx.fillRect(s.x,s.y,s.r,s.r);
  }
}
function drawTarget(){
  ctx.save();ctx.translate(CX,CY);
  ctx.strokeStyle='rgba(229,29,42,.2)';ctx.lineWidth=(TARGET_MAX-TARGET_MIN)*SCALE;
  ctx.beginPath();ctx.arc(0,0,TARGET_CENTER*SCALE,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(229,29,42,.9)';ctx.lineWidth=1.5;ctx.setLineDash([7,7]);
  ctx.beginPath();ctx.arc(0,0,TARGET_MIN*SCALE,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,TARGET_MAX*SCALE,0,Math.PI*2);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='#e51d2a';ctx.font='bold 10px Arial';ctx.textAlign='center';
  ctx.fillText('ЦЕЛЕВАЯ ОРБИТА',0,-TARGET_MAX*SCALE-9);
  ctx.restore();
}
function drawEarth(){
  var rg=ctx.createRadialGradient(CX-18,CY-22,10,CX,CY,EARTH_R*SCALE);
  rg.addColorStop(0,'#7bc4ff');rg.addColorStop(.55,'#276ea8');rg.addColorStop(1,'#123652');
  ctx.fillStyle=rg;ctx.beginPath();ctx.arc(CX,CY,EARTH_R*SCALE,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(150,215,255,.45)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(CX,CY,EARTH_R*SCALE+4,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText('ЗЕМЛЯ',CX,CY+3);
}
function drawTrail(){
  if(trail.length<2)return;
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1.5;ctx.beginPath();
  var p=toScreen(trail[0].x,trail[0].y);ctx.moveTo(p.x,p.y);
  for(var i=1;i<trail.length;i++){p=toScreen(trail[i].x,trail[i].y);ctx.lineTo(p.x,p.y)}
  ctx.stroke();
}
function drawSatellite(){
  var p=toScreen(state.x,state.y);
  ctx.save();ctx.translate(p.x,p.y);
  var angle=Math.atan2(state.vy,state.vx)+burnAngle*Math.PI/180;ctx.rotate(angle);
  ctx.fillStyle='#eef1f5';ctx.strokeStyle='#aab3bf';ctx.lineWidth=1;
  ctx.fillRect(-9,-6,18,12);ctx.strokeRect(-9,-6,18,12);
  ctx.fillStyle='#e51d2a';ctx.fillRect(-9,1,18,3);
  ctx.fillStyle='#1e4d7c';ctx.fillRect(-25,-5,13,10);ctx.fillRect(12,-5,13,10);
  ctx.strokeStyle='#74a9d8';ctx.strokeRect(-25,-5,13,10);ctx.strokeRect(12,-5,13,10);
  ctx.restore();
}
function drawBurnVector(){
  if(!running||ended)return;
  var p=toScreen(state.x,state.y),d=burnDirection(state),len=38;
  ctx.save();
  ctx.strokeStyle='rgba(255,190,85,.95)';ctx.fillStyle='rgba(255,190,85,.95)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+d.x*len,p.y+d.y*len);ctx.stroke();
  var ex=p.x+d.x*len,ey=p.y+d.y*len,a=Math.atan2(d.y,d.x);
  ctx.beginPath();
  ctx.moveTo(ex,ey);
  ctx.lineTo(ex-Math.cos(a-.48)*8,ey-Math.sin(a-.48)*8);
  ctx.lineTo(ex-Math.cos(a+.48)*8,ey-Math.sin(a+.48)*8);
  ctx.closePath();ctx.fill();
  ctx.restore();
}
function render(){
  ctx.clearRect(0,0,W,H);drawBackground();drawTarget();drawTrail();drawEarth();drawSatellite();drawBurnVector();
  var el=elements(state),rv=radialVelocity(state),speed=norm(state.vx,state.vy);
  $('radius').innerHTML=el.r.toFixed(2);$('peri').innerHTML=el.peri.toFixed(2);$('apo').innerHTML=(el.apo>99?'∞':el.apo.toFixed(2));$('ecc').innerHTML=el.e.toFixed(3);$('burns').innerHTML=burnBudget;
  if($('speed'))$('speed').innerHTML=speed.toFixed(2);
  updateAngleReadout();

  var periEl=$('peri'),apoEl=$('apo'),eccEl=$('ecc');
  periEl.className=el.peri>=TARGET_MIN&&el.peri<=TARGET_MAX?'good':'';
  apoEl.className=el.apo>=TARGET_MIN&&el.apo<=TARGET_MAX?'good':'';
  eccEl.className=el.e<=.055?'good':'';

  if(el.apo<TARGET_MIN){
    $('mission-title').innerHTML='ЭТАП 1 · ПОДНИМИ АПОГЕЙ';
    $('mission-hint').innerHTML='Для основного разгона держи угол 0° и дай +ΔV по касательной. Угол ±5° используй для тонкой коррекции траектории.';
  }else if(el.peri<TARGET_MIN){
    $('mission-title').innerHTML='ЭТАП 2 · ДОЖДИСЬ АПОГЕЯ';
    if(rv>0.08)$('mission-hint').innerHTML='Ты поднимаешься к апогею. Не спеши: второй +ΔV лучше дать в верхней точке.';
    else if(rv<-0.08)$('mission-hint').innerHTML='Апогей уже пройден. Можно дождаться следующего витка или корректировать осторожно.';
    else $('mission-hint').innerHTML='Ты около верхней точки. Дай +ΔV при угле 0°. Если траектория уходит радиально, подправь направление на ±5°.';
  }else if(el.e>.055){
    $('mission-title').innerHTML='ЭТАП 3 · КРУГОВИЗАЦИЯ';
    $('mission-hint').innerHTML='Обе высоты близки к цели. Небольшими ±ΔV и углом импульса до ±10° уменьши эксцентриситет.';
  }else{
    $('mission-title').innerHTML='ЭТАП 3 · СТАБИЛИЗАЦИЯ';
    $('mission-hint').innerHTML='ЗЕЛЁНЫЙ КОРИДОР: не вмешивайся и удержи орбиту до заполнения индикатора.';
  }
}
function frame(ts){
  if(!last)last=ts;
  acc+=Math.min(.12,(ts-last)/1000);last=ts;
  while(acc>=1/60){update();acc-=1/60}
  render();requestAnimationFrame(frame);
}
window.startCountdown=function(){
  $('start-overlay').className='overlay';$('count-overlay').className='overlay active';
  var frames=[['3','НАВИГАЦИЯ ГОТОВА'],['2','ЦЕЛЕВАЯ ОРБИТА ЗАДАНА'],['1','ДВИГАТЕЛЬ ГОТОВ'],['ПУСК','МИССИЯ MP-04']],i=0;
  function show(){
    $('countdown').innerHTML=frames[i][0];$('count-sub').innerHTML=frames[i][1];
    try{if(navigator.vibrate)navigator.vibrate(35)}catch(e){}
    i++;if(i<frames.length)setTimeout(show,540);else setTimeout(function(){$('count-overlay').className='overlay';running=true;last=performance.now()},520);
  }show();
};
window.resetMission=function(){resetState()};
window.mpOrbitDebug={
  getState:function(){return copyState(state)},
  getElements:function(){return elements(state)},
  getBurns:function(){return burnBudget},
  getBurnAngle:function(){return burnAngle},
  setBurnAngle:function(v){burnAngle=clamp(Math.round(v/ANGLE_STEP)*ANGLE_STEP,-MAX_ANGLE,MAX_ANGLE);updateAngleReadout()},
  getBurnDirection:function(){return burnDirection(state)},
  burnPro:function(){burn(1)},
  reset:function(){resetManeuver()},
  forceSuccess:function(){
    state={x:TARGET_CENTER,y:0,vx:0,vy:Math.sqrt(MU/TARGET_CENTER)};
    hold=HOLD_NEEDED-.15;running=true;ended=false;
  }
};
function init(){
  canvas=$('gameCanvas');ctx=canvas.getContext('2d');createStars();bind();resetState();requestAnimationFrame(frame);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();