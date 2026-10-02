const { test, expect } = require('@playwright/test');

const profiles = [
  { name: 'iPad 2017 portrait', viewport: { width: 768, height: 1024 } },
  { name: 'iPad 2017 landscape', viewport: { width: 1024, height: 768 } }
];

for (const p of profiles) {
  test(p.name + ' MP-05 starts, thrusts and fires', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: p.viewport,
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('/missions/debris/');
    await expect(page.locator('#start-overlay')).toHaveClass(/active/);
    await expect(page.locator('#brandbar img')).toBeVisible();

    await page.getByRole('button', { name: 'НАЧАТЬ ОЧИСТКУ' }).tap();
    await expect(page.locator('#count-overlay')).toHaveClass(/active/);
    await page.waitForTimeout(2800);

    await expect(page.locator('#controls')).toBeVisible();
    const sizes = await page.locator('.control').evaluateAll(nodes => nodes.map(n => {
      const r = n.getBoundingClientRect(); return { w: r.width, h: r.height };
    }));
    for (const s of sizes) {
      expect(s.w).toBeGreaterThanOrEqual(60);
      expect(s.h).toBeGreaterThanOrEqual(60);
    }

    const speedBefore = await page.evaluate(() => window.mpDebrisDebug.getState().speed);
    await page.locator('[data-key="up"]').dispatchEvent('touchstart');
    await page.waitForTimeout(420);
    await page.locator('[data-key="up"]').dispatchEvent('touchend');
    await page.waitForTimeout(80);
    const speedAfter = await page.evaluate(() => window.mpDebrisDebug.getState().speed);
    expect(speedAfter).toBeGreaterThan(speedBefore);

    await page.locator('#pulse').tap();
    await page.waitForTimeout(40);
    const bulletCount = await page.evaluate(() => window.mpDebrisDebug.getState().bullets);
    expect(bulletCount).toBeGreaterThan(0);

    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - window.innerWidth,
      y: document.documentElement.scrollHeight - window.innerHeight
    }));
    expect(overflow.x).toBeLessThanOrEqual(1);
    expect(overflow.y).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('MP-05 progresses through waves and can finish', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/missions/debris/');
  await page.getByRole('button', { name: 'НАЧАТЬ ОЧИСТКУ' }).tap();
  await page.waitForTimeout(2800);

  await page.evaluate(() => window.mpDebrisDebug.forceWaveClear());
  await page.waitForTimeout(760);
  expect(await page.evaluate(() => window.mpDebrisDebug.getState().wave)).toBe(2);

  await page.evaluate(() => window.mpDebrisDebug.forceWaveClear());
  await page.waitForTimeout(760);
  expect(await page.evaluate(() => window.mpDebrisDebug.getState().wave)).toBe(3);
  await expect(page.locator('#mission-title')).toContainText('ВОЛНА 3');

  await page.evaluate(() => window.mpDebrisDebug.forceSuccess());
  await page.waitForTimeout(700);
  await expect(page.locator('#result-overlay')).toHaveClass(/active/);
  await expect(page.locator('#result-title')).toContainText('Орбитальный сектор очищен');
  await context.close();
});

test('MP-05 iPhone portrait fills viewport without scroll or double shrink', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/missions/debris/');
  const shell = await page.locator('#viewport-shell').boundingBox();
  expect(shell).not.toBeNull();
  expect(shell.width).toBeGreaterThan(370);
  expect(shell.width).toBeLessThanOrEqual(390);
  const dims = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    iw: window.innerWidth,
    ih: window.innerHeight
  }));
  expect(dims.sw).toBeLessThanOrEqual(dims.iw + 1);
  expect(dims.sh).toBeLessThanOrEqual(dims.ih + 1);
  await expect(page.locator('#rotate-note')).toBeVisible();
  await context.close();
});

test('MP-05 legacy bundle avoids module-only syntax', async ({ page }) => {
  const js = await page.request.get('/missions/debris/game-legacy.js').then(r => r.text());
  expect(js).not.toContain('type="module"');
  expect(js).not.toMatch(/\bexport\s/);
  expect(js).not.toMatch(/=>/);
  expect(js).not.toMatch(/\?\?/);
});
