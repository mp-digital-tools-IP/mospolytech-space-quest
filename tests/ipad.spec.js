const { test, expect } = require('@playwright/test');

const profiles = [
  {
    name: 'iPad 2017 portrait',
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1'
  },
  {
    name: 'iPad 2017 landscape',
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 11_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15F79 Safari/604.1'
  }
];

for (const profile of profiles) {
  test(profile.name + ' — основной сценарий', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: profile.viewport,
      userAgent: profile.userAgent,
      hasTouch: true,
      isMobile: true
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(String(err)));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/');
    await expect(page.locator('#start')).toHaveClass(/active/);
    await expect(page.locator('.brand img').first()).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.locator('#startGameBtn').tap();
    await expect(page.locator('#play')).toHaveClass(/active/);

    const targetSizes = await page.locator('.module, .slot').evaluateAll(nodes =>
      nodes.map(n => {
        const r = n.getBoundingClientRect();
        return { w: r.width, h: r.height };
      })
    );
    for (const size of targetSizes) {
      expect(size.w).toBeGreaterThanOrEqual(44);
      expect(size.h).toBeGreaterThanOrEqual(44);
    }

    await page.locator('.module[data-kind="wrong"]').first().tap();
    await page.locator('#slot-energy').tap();
    await expect(page.locator('#count')).toHaveText('0');

    await page.locator('.module[data-kind="energy"]').tap();
    await page.locator('#slot-energy').tap();
    await expect(page.locator('#count')).toHaveText('1');

    await page.locator('.module[data-kind="link"]').tap();
    await page.locator('#slot-link').tap();
    await expect(page.locator('#count')).toHaveText('2');

    await page.locator('.module[data-kind="camera"]').tap();
    await page.locator('#slot-camera').tap();
    await expect(page.locator('#success')).toHaveClass(/active/);
    await expect(page.getByText('Спутник готов')).toBeVisible();

    await page.locator('#nextPlayerBtn').tap();
    await expect(page.locator('#start')).toHaveClass(/active/);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('iPad 2017 — таймаут и повторный запуск', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    userAgent: profiles[0].userAgent,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#startGameBtn').tap();
  await page.evaluate(() => { remaining = 1; });
  await page.waitForTimeout(1200);
  await expect(page.locator('#fail')).toHaveClass(/active/);
  await page.getByRole('button', { name: 'ПОВТОРИТЬ' }).tap();
  await expect(page.locator('#play')).toHaveClass(/active/);
  await expect(page.locator('#timer')).toHaveText('00:60');
  await context.close();
});
