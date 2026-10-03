(function(){
'use strict';
var meta={
  docking:{series:'01 / 04',code:'MP-02',name:'ОРБИТАЛЬНАЯ СТЫКОВКА',success:'СТЫКОВКА ВЫПОЛНЕНА',next:'../landing/',nextLabel:'СЛЕДУЮЩАЯ ИГРА →'},
  landing:{series:'02 / 04',code:'MP-03',name:'МЯГКАЯ ПОСАДКА',success:'Мягкая посадка выполнена',next:'../orbit/',nextLabel:'СЛЕДУЮЩАЯ ИГРА →'},
  orbit:{series:'03 / 04',code:'MP-04',name:'ВЫВОД НА ОРБИТУ',success:'Орбита стабилизирована',next:'../debris/',nextLabel:'СЛЕДУЮЩАЯ ИГРА →'},
  debris:{series:'04 / 04',code:'MP-05',name:'ОЧИСТКА ОРБИТЫ',success:'Орбитальный сектор очищен',next:'../../?complete=1',nextLabel:'ЗАВЕРШИТЬ КВЕСТ'}
};
function detect(){
  var p=location.pathname;
  if(p.indexOf('/docking/')!==-1)return 'docking';
  if(p.indexOf('/landing/')!==-1)return 'landing';
  if(p.indexOf('/orbit/')!==-1)return 'orbit';
  if(p.indexOf('/debris/')!==-1)return 'debris';
  return null;
}
function insertTop(container,m){
  if(!container||document.querySelector('.mp-series-badge'))return;
  var badge=document.createElement('div');
  badge.className='mp-series-badge';
  badge.innerHTML='<b>МИССИЯ '+m.series+'</b><span>'+m.code+'</span>';
  var line=document.createElement('div');line.className='mp-series-line';
  var home=document.createElement('a');home.className='mp-home';home.href='../../';home.innerHTML='← МИССИИ';
  container.appendChild(badge);container.appendChild(line);container.appendChild(home);
}
function decorateStart(m){
  var kickers=document.querySelectorAll('.kicker');
  for(var i=0;i<kickers.length;i++){
    var k=kickers[i];
    if((k.textContent||'').toLowerCase().indexOf('космическ')!==-1){
      k.className+=' mp-card-kicker';
      k.textContent='МИССИЯ '+m.series+' · '+m.code;
    }
  }
  var campaignDay=document.getElementById('campaign-day-number');
  if(campaignDay)campaignDay.textContent='МИССИЯ '+m.series+' · '+m.code;
  var status=document.getElementById('mission-status');
  if(status&&status.textContent.indexOf(m.code)===0)status.textContent=m.code;
}
function decorateResults(){
  var overlays=[document.getElementById('message-overlay'),document.getElementById('result-overlay')];
  for(var i=0;i<overlays.length;i++){
    var o=overlays[i];if(!o)continue;
    var title=o.querySelector('h1');if(!title)continue;
    if(o.querySelector('.mp-result-stamp'))continue;
    var stamp=document.createElement('div');stamp.className='mp-result-stamp';stamp.innerHTML='✓ РЕЗУЛЬТАТ МИССИИ';
    title.parentNode.insertBefore(stamp,title);
  }
}
function visible(el){
  if(!el)return false;
  var cs=window.getComputedStyle?window.getComputedStyle(el):el.currentStyle;
  return !!cs&&cs.display!=='none'&&cs.visibility!=='hidden'&&parseFloat(cs.opacity||'1')>0;
}
function wireNextGame(m,inCampaign){
  if(inCampaign)return;
  var overlay=document.getElementById('message-overlay')||document.getElementById('result-overlay');
  if(!overlay)return;
  var button=overlay.querySelector('.action');
  var title=overlay.querySelector('h1');
  if(!button||!title)return;
  var retryClick=button.onclick;
  var retryText=button.innerHTML;
  var successText=(m.success||'').toLowerCase();
  function refresh(){
    if(!visible(overlay))return;
    var current=(title.textContent||title.innerText||'').toLowerCase();
    var success=successText&&current.indexOf(successText)!==-1;
    if(success){
      if(button.getAttribute('data-mp-next')==='1')return;
      button.setAttribute('data-mp-next','1');
      button.innerHTML=m.nextLabel;
      button.onclick=function(){location.href=m.next;return false};
    }else if(button.getAttribute('data-mp-next')==='1'){
      button.removeAttribute('data-mp-next');
      button.innerHTML=retryText;
      button.onclick=retryClick;
    }
  }
  refresh();
  window.setInterval(refresh,220);
}
function init(){
  var id=detect(),m=meta[id];if(!m)return;
  var inCampaign=false;try{inCampaign=window.self!==window.top}catch(e){inCampaign=true}
  if(inCampaign)document.documentElement.className+=' mp-in-campaign';
  var container=document.getElementById('game-container');insertTop(container,m);decorateStart(m);decorateResults();wireNextGame(m,inCampaign);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
