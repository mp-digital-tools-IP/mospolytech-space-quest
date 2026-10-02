const { test, expect } = require('@playwright/test');

const missions = [
  { path: 'docking', series: '01 / 04', code: 'MP-02' },
  { path: 'landing', series: '02 / 04', code: 'MP-03' },
  { path: 'orbit', series: '03 / 04', code: 'MP-04' },
  { path: 'debris', series: '04 / 04', code: 'MP-05' }
];

for (const m of missions) {
  test(`${m.path} uses unified standalone mission chrome`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`/missions/${m.path}/`);
    await expect(page.locator('.mp-series-badge')).toBeVisible();
    await expect(page.locator('.mp-series-badge')).toContainText(`МИССИЯ ${m.series}`);
    await expect(page.locator('.mp-series-badge')).toContainText(m.code);
    await expect(page.locator('.mp-home')).toBeVisible();
    await expect(page.locator('#brandbar img')).toBeVisible();

    const dims = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      iw: window.innerWidth,
      ih: window.innerHeight
    }));
    expect(dims.sw).toBeLessThanOrEqual(dims.iw + 1);
    expect(dims.sh).toBeLessThanOrEqual(dims.ih + 1);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('campaign hides duplicate standalone mission navigation', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/campaign.html?step=1');
  await expect(page.locator('#game')).toHaveAttribute('src', /missions\/landing\//);
  const frame = page.frameLocator('#game');
  await expect(frame.locator('#start-overlay')).toHaveClass(/active/);
  await expect(frame.locator('.mp-series-badge')).toBeHidden();
  await expect(frame.locator('.mp-home')).toBeHidden();
  await expect(page.locator('#mission-label')).toHaveText('МИССИЯ 2 ИЗ 4');
  await context.close();
});

test('orbit mission visibly starts with fifteen impulses', async ({ page }) => {
  await page.goto('/missions/orbit/');
  await expect(page.locator('#burns')).toHaveText('15');
  await expect(page.locator('#start-overlay .card p')).toContainText('15 коротких импульсов');
});
