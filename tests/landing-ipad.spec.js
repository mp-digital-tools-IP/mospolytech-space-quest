const { test, expect } = require('@playwright/test');

const profiles=[
  {name:'iPad 2017 portrait',viewport:{width:768,height:1024}},
  {name:'iPad 2017 landscape',viewport:{width:1024,height:768}}
];

for(const p of profiles){
  test(p.name+' MP-03 starts and touch thrust works',async({browser})=>{
    const context=await browser.newContext({
      viewport:p.viewport,
      userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
      hasTouch:true,isMobile:true
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

    await page.goto('/missions/landing/');
    await expect(page.locator('#start-overlay')).toHaveClass(/active/);
    await expect(page.locator('#brandbar img')).toBeVisible();
    await expect(page.locator('#start-overlay')).toContainText('V↓ ≤ 30 м/с');

    await page.getByRole('button',{name:'НАЧАТЬ ПОСАДКУ'}).tap();
    await expect(page.locator('#count-overlay')).toHaveClass(/active/);
    await page.waitForTimeout(2850);

    await expect(page.locator('#touch-controls')).toBeVisible();
    const sizes=await page.locator('.control').evaluateAll(nodes=>nodes.map(n=>{
      const r=n.getBoundingClientRect();return {w:r.width,h:r.height};
    }));
    for(const s of sizes){expect(s.w).toBeGreaterThanOrEqual(60);expect(s.h).toBeGreaterThanOrEqual(60)}

    const fuelBefore=Number(await page.locator('#fuel').textContent());
    await page.locator('#thrust').dispatchEvent('touchstart');
    await page.waitForTimeout(500);
    await page.locator('#thrust').dispatchEvent('touchend');
    await page.waitForTimeout(100);
    const fuelAfter=Number(await page.locator('#fuel').textContent());
    expect(fuelAfter).toBeLessThan(fuelBefore);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('MP-03 successful landing produces result screen',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:1024,height:768},
    userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch:true,isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/landing/');
  await page.getByRole('button',{name:'НАЧАТЬ ПОСАДКУ'}).tap();
  await page.waitForTimeout(2850);
  await page.evaluate(()=>window.mpLandingDebug.forceSuccess());
  await page.waitForTimeout(900);
  await expect(page.locator('#result-overlay')).toHaveClass(/active/);
  await expect(page.locator('#result-title')).toContainText('Мягкая посадка выполнена');
  await context.close();
});

test('MP-03 accepts a gentle vertical descent even when total speed exceeds old limit',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:1024,height:768},
    userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch:true,isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/landing/');
  await page.getByRole('button',{name:'НАЧАТЬ ПОСАДКУ'}).tap();
  await page.waitForTimeout(2850);
  const limits=await page.evaluate(()=>window.mpLandingDebug.getLimits());
  expect(limits).toEqual({vertical:30,horizontal:25,angle:16});

  // Total speed is about 34.4 m/s, which used to fail the old 25 m/s total-speed rule.
  await page.evaluate(()=>window.mpLandingDebug.forceLanding(20,28,0));
  await page.waitForTimeout(900);
  await expect(page.locator('#result-overlay')).toHaveClass(/active/);
  await expect(page.locator('#result-title')).toContainText('Мягкая посадка выполнена');
  const resultText=await page.locator('#result-text').textContent();
  const verticalMatch=/V↓:\s*([\d.]+)/.exec(resultText||'');
  expect(verticalMatch).not.toBeNull();
  expect(Number(verticalMatch[1])).toBeLessThanOrEqual(30);
  await context.close();
});

test('MP-03 iPhone portrait fills viewport width without double shrink',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch:true,isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/landing/');
  const shell=await page.locator('#viewport-shell').boundingBox();
  expect(shell).not.toBeNull();
  expect(shell.width).toBeGreaterThan(370);
  expect(shell.width).toBeLessThanOrEqual(390);
  await expect(page.locator('#rotate-note')).toBeVisible();
  await context.close();
});
