const { test, expect } = require('@playwright/test');

const profiles=[
  {name:'iPad 2017 portrait',viewport:{width:768,height:1024}},
  {name:'iPad 2017 landscape',viewport:{width:1024,height:768}}
];

for(const p of profiles){
  test(p.name+' MP-04 starts and orbital burn works',async({browser})=>{
    const context=await browser.newContext({
      viewport:p.viewport,
      userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
      hasTouch:true,isMobile:true
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

    await page.goto('/missions/orbit/');
    await expect(page.locator('#start-overlay')).toHaveClass(/active/);
    await expect(page.locator('#brandbar img')).toBeVisible();

    await page.getByRole('button',{name:'НАЧАТЬ МАНЁВР'}).tap();
    await expect(page.locator('#count-overlay')).toHaveClass(/active/);
    await page.waitForTimeout(2800);

    await expect(page.locator('#controls')).toBeVisible();
    const burnsBefore=await page.evaluate(()=>window.mpOrbitDebug.getBurns());
    const apoBefore=await page.evaluate(()=>window.mpOrbitDebug.getElements().apo);
    await page.locator('#prograde').tap();
    await page.waitForTimeout(120);
    const burnsAfter=await page.evaluate(()=>window.mpOrbitDebug.getBurns());
    const apoAfter=await page.evaluate(()=>window.mpOrbitDebug.getElements().apo);

    expect(burnsAfter).toBe(burnsBefore-1);
    expect(apoAfter).toBeGreaterThan(apoBefore);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('MP-04 force-stable target orbit completes mission',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:1024,height:768},
    userAgent:'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch:true,isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/orbit/');
  await page.getByRole('button',{name:'НАЧАТЬ МАНЁВР'}).tap();
  await page.waitForTimeout(2800);
  await page.evaluate(()=>window.mpOrbitDebug.forceSuccess());
  await page.waitForTimeout(700);
  await expect(page.locator('#result-overlay')).toHaveClass(/active/);
  await expect(page.locator('#result-title')).toContainText('Орбита стабилизирована');
  await context.close();
});

test('MP-04 iPhone portrait fills viewport without scroll or double shrink',async({browser})=>{
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch:true,isMobile:true
  });
  const page=await context.newPage();
  await page.goto('/missions/orbit/');
  const shell=await page.locator('#viewport-shell').boundingBox();
  expect(shell).not.toBeNull();
  expect(shell.width).toBeGreaterThan(370);
  expect(shell.width).toBeLessThanOrEqual(390);
  const dims=await page.evaluate(()=>({
    sw:document.documentElement.scrollWidth,
    sh:document.documentElement.scrollHeight,
    iw:window.innerWidth,
    ih:window.innerHeight
  }));
  expect(dims.sw).toBeLessThanOrEqual(dims.iw+1);
  expect(dims.sh).toBeLessThanOrEqual(dims.ih+1);
  await expect(page.locator('#rotate-note')).toBeVisible();
  await context.close();
});
