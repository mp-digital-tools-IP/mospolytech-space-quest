(function(){
'use strict';
var meta={
  docking:{series:'01 / 04',code:'MP-02',name:'ОРБИТАЛЬНАЯ СТЫКОВКА'},
  landing:{series:'02 / 04',code:'MP-03',name:'МЯГКАЯ ПОСАДКА'},
  orbit:{series:'03 / 04',code:'MP-04',name:'ВЫВОД НА ОРБИТУ'},
  debris:{series:'04 / 04',code:'MP-05',name:'ОЧИСТКА ОРБИТЫ'}
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
function init(){
  var id=detect(),m=meta[id];if(!m)return;
  var inCampaign=false;try{inCampaign=window.self!==window.top}catch(e){inCampaign=true}
  if(inCampaign)document.documentElement.className+=' mp-in-campaign';
  var container=document.getElementById('game-container');insertTop(container,m);decorateStart(m);decorateResults();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
