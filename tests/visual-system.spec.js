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

test('MP-02 intro has no internal scroll and all content fits', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/missions/docking/');
  await expect(page.locator('#campaign-start-overlay')).toBeVisible();
  const box = await page.locator('#campaign-start-overlay').evaluate(el => {
    const cs = getComputedStyle(el);
    return { scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, overflowY: cs.overflowY };
  });
  expect(box.overflowY).toBe('hidden');
  expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight + 1);
  expect(await page.locator('#tutorial-overlay').evaluate(el => getComputedStyle(el).overflowY)).toBe('hidden');
  await context.close();
});

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

const nextFlow = [
  { path: 'docking', overlay: 'message-overlay', title: 'msg-title', success: 'СТЫКОВКА ВЫПОЛНЕНА', next: /\/missions\/landing\/$/, label: 'СЛЕДУЮЩАЯ ИГРА' },
  { path: 'landing', overlay: 'result-overlay', title: 'result-title', success: 'Мягкая посадка выполнена', next: /\/missions\/orbit\/$/, label: 'СЛЕДУЮЩАЯ ИГРА' },
  { path: 'orbit', overlay: 'result-overlay', title: 'result-title', success: 'Орбита стабилизирована', next: /\/missions\/debris\/$/, label: 'СЛЕДУЮЩАЯ ИГРА' },
  { path: 'debris', overlay: 'result-overlay', title: 'result-title', success: 'Орбитальный сектор очищен', next: /\/?complete=1$/, label: 'ЗАВЕРШИТЬ КВЕСТ' }
];

for (const m of nextFlow) {
  test(`${m.path} completed standalone mission advances instead of retrying`, async ({ page }) => {
    await page.goto(`/missions/${m.path}/`);
    await page.evaluate(({ overlay, title, success }) => {
      const start = document.getElementById('start-overlay') || document.getElementById('campaign-start-overlay');
      if (start) { start.style.display = 'none'; start.className = (start.className || '').replace(/\s*active/g, ''); }
      const result = document.getElementById(overlay);
      document.getElementById(title).textContent = success;
      if (result.classList) result.classList.add('active');
      result.style.display = 'flex';
    }, m);
    await page.waitForTimeout(320);
    const action = page.locator(`#${m.overlay} .action`);
    await expect(action).toContainText(m.label);
    await action.evaluate(el => el.click());
    await expect(page).toHaveURL(m.next);
  });
}
