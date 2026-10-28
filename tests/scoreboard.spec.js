const {test,expect}=require('@playwright/test');

test('Home provides four illustrated mission cards, name entry and an honest local ranking on iPhone',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/assets/leaderboard-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.MP_LEADERBOARD_API='';"}));
 await page.goto('/');
 await expect(page.locator('.cardvisual')).toHaveCount(4);
 for(const src of await page.locator('.cardvisual').evaluateAll(nodes=>nodes.map(i=>({loaded:i.complete&&i.naturalWidth>0,src:i.getAttribute('src')})))){
  expect(src.loaded,src.src).toBe(true);
 }
 await page.locator('#player-name').fill('Инженер 01');
 await page.locator('#save-player').click();
 expect(await page.evaluate(()=>window.mpScore.player().name)).toBe('Инженер 01');
 await page.locator('#open-ranking').click();
 await expect(page.locator('#ranking')).toHaveClass(/active/);
 await expect(page.locator('#rank-status')).toContainText('Локальный рейтинг');
 await page.locator('#close-ranking').click();
 const size=await page.evaluate(()=>({w:document.documentElement.scrollWidth-window.innerWidth,h:document.documentElement.scrollHeight-window.innerHeight}));
 expect(size.w).toBeLessThanOrEqual(1);expect(size.h).toBeLessThanOrEqual(1);
 expect(errors).toEqual([]);await ctx.close();
});

test('Mission awards 60–100 points and keeps best personal score in ranking across page loads',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1024,height:768},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/assets/leaderboard-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.MP_LEADERBOARD_API='';"}));
 await page.goto('/');
 await page.locator('#player-name').fill('Марина');
 await page.locator('#save-player').click();
 await page.goto('/missions/landing/');
 await page.getByRole('button',{name:'НАЧАТЬ ПОСАДКУ'}).tap();
 await page.waitForTimeout(2850);
 await page.evaluate(()=>window.mpLandingDebug.forceSuccess());
 await expect(page.locator('.mp-earned-score')).toBeVisible({timeout:5000});
 const points=await page.evaluate(()=>window.mpScore.getLast('landing').points);
 expect(points).toBeGreaterThanOrEqual(60);expect(points).toBeLessThanOrEqual(100);
 await page.goto('/');
 await page.locator('#open-ranking').click();
 await expect(page.locator('.rankrow')).toHaveCount(1);
 await expect(page.locator('.rankrow')).toContainText('Марина');
 await expect(page.locator('.rankrow')).toContainText(points+'/400');
 await expect(page.locator('.rankrow')).toContainText('1/4');
 await page.reload();
 await page.locator('#open-ranking').click();
 await expect(page.locator('.rankrow')).toHaveCount(1);
 expect(errors).toEqual([]);await ctx.close();
});

test('New participant never inherits the previous participant score',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1024,height:768}});
 const page=await ctx.newPage();await page.route('**/assets/leaderboard-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.MP_LEADERBOARD_API='';"}));await page.goto('/');
 await page.evaluate(()=>{
  mpScore.setName('Первый');mpScore.recordMission('landing',{points:91,base:60,bonus:31});
  mpScore.clearPlayer();mpScore.setName('Второй');mpScore.recordMission('orbit',{points:77,base:60,bonus:17});
 });
 await page.locator('#open-ranking').click();
 await expect(page.locator('.rankrow')).toHaveCount(2);
 await expect(page.locator('.rankrow').first()).toContainText('Первый');
 await expect(page.locator('.rankrow').first()).toContainText('91/400');
 await expect(page.locator('.rankrow').nth(1)).toContainText('Второй');
 await expect(page.locator('.rankrow').nth(1)).toContainText('77/400');
 await ctx.close();
});


test('Global leaderboard displays remote players and correct cross-device scores',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1024,height:768}});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/functions/v1/leaderboard/scores?*',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({entries:[{id:'remotePlayer',name:'Участник из другого города',total:267,scores:{docking:{points:88},landing:{points:92},orbit:{points:87},debris:{points:0}}}]})}));
 await page.goto('/');
 await page.locator('#open-ranking').click();
 await expect(page.locator('#rank-status')).toContainText('Общий рейтинг');
 await expect(page.locator('.rankrow')).toHaveCount(1);
 await expect(page.locator('.rankrow')).toContainText('267/400');
 await expect(page.locator('.rankrow')).toContainText('Участник из другого города');
 await expect(page.locator('.rankrow')).toContainText('3/4');
 expect(errors).toEqual([]);await ctx.close();
});

test('desktop wide and compact mobile home show navigation and mission cards without viewport overflow',async({browser})=>{
 for(const [width,height] of [[1920,1080],[1366,768],[390,844],[375,667],[320,568]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500});
  const page=await ctx.newPage();await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(4);
  await expect(page.locator('#open-ranking')).toBeVisible();
  await expect(page.locator('.actions .primary')).toBeVisible();
  const dims=await page.evaluate(()=>({x:document.documentElement.scrollWidth-innerWidth,y:document.documentElement.scrollHeight-innerHeight,card:document.querySelector('.card').getBoundingClientRect().height}));
  expect(dims.x,`width ${width}`).toBeLessThanOrEqual(1);
  expect(dims.y,`height ${height}`).toBeLessThanOrEqual(1);
  expect(dims.card).toBeGreaterThan(60);
  await ctx.close();
 }
});

test('mission cover images display crisp vector fallbacks if HD files are absent',async({browser})=>{
 const ctx=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await ctx.newPage();
 await page.route('**/assets/covers/*.webp',r=>r.fulfill({status:404,body:'',contentType:'text/plain'}));
 await page.goto('/');
 await expect(page.locator('.cardvisual')).toHaveCount(4);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.cardvisual')).every(img=>img.complete&&img.naturalWidth>0));
 const imgs=await page.locator('.cardvisual').evaluateAll(nodes=>nodes.map(n=>({src:n.getAttribute('src'),width:n.naturalWidth})));
 for(const img of imgs){expect(img.src).toMatch(/assets\/splash-.*\.svg$/);expect(img.width).toBeGreaterThan(400);}
 await ctx.close();
});
