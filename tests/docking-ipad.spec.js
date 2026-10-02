const { test, expect } = require('@playwright/test');

const profiles = [
  {name:'iPad 2017 portrait', viewport:{width:768,height:1024}},
  {name:'iPad 2017 landscape', viewport:{width:1024,height:768}}
];

for (const p of profiles) {
  test(p.name + ' docking mission starts and touch thrust works', async ({browser}) => {
    const context = await browser.newContext({
      viewport:p.viewport,
      userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
      hasTouch:true,
      isMobile:true
    });
    const page = await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

    await page.goto('/missions/docking/');
    await expect(page.locator('#gameCanvas')).toBeVisible();
    await expect(page.locator('#campaign-start-overlay')).toBeVisible();

    if (await page.locator('#tutorial-overlay').isVisible()) {
      await page.getByRole('button',{name:'ПОНЯТНО, К МИССИИ'}).tap();
    }
    await page.getByRole('button',{name:'НАЧАТЬ СТЫКОВКУ'}).tap();

    await expect(page.locator('#touch-controls')).toBeVisible();
    await expect(page.locator('#mission-time')).toHaveText('90');
    await expect(page.locator('#phase-name')).toContainText('ЭТАП 1');
    const sizes=await page.locator('.touch-btn').evaluateAll(nodes=>nodes.map(n=>{
      const r=n.getBoundingClientRect(); return {w:r.width,h:r.height};
    }));
    for(const s of sizes){expect(s.w).toBeGreaterThanOrEqual(60);expect(s.h).toBeGreaterThanOrEqual(60)}

    const fuelBefore=Number(await page.locator('#fuel').textContent());
    await page.locator('.touch-up').dispatchEvent('touchstart');
    await page.waitForTimeout(650);
    await page.locator('.touch-up').dispatchEvent('touchend');
    await page.waitForTimeout(120);
    const fuelAfter=Number(await page.locator('#fuel').textContent());
    expect(fuelAfter).toBeLessThan(fuelBefore);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('legacy bundle has no module/nullish/object spread dependency', async ({page}) => {
  const text = await page.request.get('/missions/docking/game-legacy.js').then(r=>r.text());
  expect(text).not.toContain('export const');
  expect(text).not.toContain('export function');
  expect(text).not.toMatch(/\?\?\s/);
  expect(text).not.toContain('{ ...campaign }');
  const html = await page.request.get('/missions/docking/').then(r=>r.text());
  expect(html).not.toContain('type="module"');
});


test('docking guidance progresses through three phases and success overlay works', async ({browser}) => {
  const context = await browser.newContext({
    viewport:{width:1024,height:768},
    userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch:true,
    isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/docking/');
  if (await page.locator('#tutorial-overlay').isVisible()) {
    await page.getByRole('button',{name:'ПОНЯТНО, К МИССИИ'}).tap();
  }
  await page.getByRole('button',{name:'НАЧАТЬ СТЫКОВКУ'}).tap();

  // Phase 2: sufficient altitude, still far from orbital module.
  await page.evaluate(() => {
    const lm=window.mpDockingGame.getLM();
    lm.y=210; lm.x=220; lm.vx=0; lm.vy=0;
  });
  await page.waitForTimeout(120);
  await expect(page.locator('#phase-name')).toContainText('ЭТАП 2');

  // Phase 3: close range with matched horizontal speed.
  await page.evaluate(() => {
    const lm=window.mpDockingGame.getLM();
    const csm=window.mpDockingGame.getCSM();
    lm.x=csm.x; lm.y=205; lm.vx=csm.speed; lm.vy=0;
  });
  await page.waitForTimeout(120);
  await expect(page.locator('#phase-name')).toContainText('ЭТАП 3');

  // Safe docking state.
  await page.evaluate(() => {
    const lm=window.mpDockingGame.getLM();
    const csm=window.mpDockingGame.getCSM();
    lm.x=csm.x; lm.y=csm.y+12; lm.vx=csm.speed; lm.vy=0;
  });
  await page.waitForTimeout(180);
  await expect(page.locator('#message-overlay')).toBeVisible();
  await expect(page.locator('#msg-title')).toContainText('СТЫКОВКА ВЫПОЛНЕНА');
  await context.close();
});
