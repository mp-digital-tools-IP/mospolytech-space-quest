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
  test(profile.name + ' — финальный хаб помещается без скролла', async ({ browser }) => {
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
    await expect(page.locator('.logo')).toBeVisible();
    await expect(page.getByRole('link', { name: 'ПРОЙТИ ВСЕ 4' })).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(4);
    await expect(page.locator('.card h2')).toHaveText([
      'Орбитальная стыковка',
      'Мягкая посадка',
      'Вывод на орбиту',
      'Очистка орбиты'
    ]);

    const dims = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      sh: document.documentElement.scrollHeight,
      iw: window.innerWidth,
      ih: window.innerHeight,
      overflow: getComputedStyle(document.body).overflow
    }));
    expect(dims.sw).toBeLessThanOrEqual(dims.iw + 1);
    expect(dims.sh).toBeLessThanOrEqual(dims.ih + 1);
    expect(dims.overflow).toBe('hidden');
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('iPhone — хаб 2x2 без вертикального скролла', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(4);
  const boxes = await page.locator('.card').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right };
  }));
  expect(Math.max(...boxes.map(b => b.bottom))).toBeLessThanOrEqual(844);
  const dims = await page.evaluate(() => ({ sh:document.documentElement.scrollHeight, ih:window.innerHeight, sw:document.documentElement.scrollWidth, iw:window.innerWidth }));
  expect(dims.sh).toBeLessThanOrEqual(dims.ih + 1);
  expect(dims.sw).toBeLessThanOrEqual(dims.iw + 1);
  await context.close();
});

test('режим пройти все проводит через 4 миссии, выдаёт экран для штампа и сбрасывается для следующего участника', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: profiles[1].userAgent,
    hasTouch: true,
    isMobile: true
  });
  const page = await context.newPage();
  await page.goto('/campaign.html?step=0');
  await expect(page.locator('#mission-label')).toHaveText('МИССИЯ 1 ИЗ 4');

  async function winDocking() {
    const frame = page.frames().find(f => /missions\/docking\/?$/.test(f.url()));
    expect(frame).toBeTruthy();
    await frame.evaluate(() => {
      document.getElementById('msg-title').textContent = 'СТЫКОВКА ВЫПОЛНЕНА';
      document.getElementById('msg-detail').textContent = 'Тестовый результат';
      document.getElementById('message-overlay').style.display = 'block';
    });
  }
  async function winResultMission(path, titleText) {
    const re = new RegExp('missions/' + path + '/?$');
    const frame = page.frames().find(f => re.test(f.url()));
    expect(frame).toBeTruthy();
    await frame.evaluate(({titleText}) => {
      document.getElementById('result-title').textContent = titleText;
      document.getElementById('result-text').textContent = 'Тестовый результат';
      document.getElementById('result-overlay').className = 'overlay active';
    }, {titleText});
  }

  await page.waitForTimeout(500);
  await winDocking();
  await expect(page.locator('#transition')).toHaveClass(/active/, { timeout: 2000 });
  await expect(page.locator('#auto-note')).toContainText('Следующая миссия через');
  await page.locator('#next-btn').tap();
  await expect(page).toHaveURL(/campaign\.html\?step=1/);
  await page.waitForTimeout(500);

  await winResultMission('landing', 'Мягкая посадка выполнена');
  await expect(page.locator('#transition')).toHaveClass(/active/, { timeout: 2000 });
  await page.locator('#next-btn').tap();
  await expect(page).toHaveURL(/campaign\.html\?step=2/);
  await page.waitForTimeout(500);

  await winResultMission('orbit', 'Орбита стабилизирована');
  await expect(page.locator('#transition')).toHaveClass(/active/, { timeout: 2000 });
  await page.locator('#next-btn').tap();
  await expect(page).toHaveURL(/campaign\.html\?step=3/);
  await page.waitForTimeout(500);

  await winResultMission('debris', 'Орбитальный сектор очищен');
  await expect(page.locator('#transition')).toHaveClass(/active/, { timeout: 2000 });
  await expect(page.locator('#auto-note')).toContainText('Финальный экран через');
  await page.locator('#next-btn').tap();
  await expect(page).toHaveURL(/\?complete=1$/);
  await expect(page.locator('#final')).toHaveClass(/active/);
  await expect(page.locator('.result')).toHaveCount(4);
  await expect(page.getByText('Все четыре миссии выполнены')).toBeVisible();
  await expect(page.locator('.stamp')).toContainText('поставит штамп в маршрутный лист');
  await expect(page.locator('#next-player')).toBeVisible();

  const finalDims = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth
  }));
  expect(finalDims.sh).toBeLessThanOrEqual(finalDims.ih + 1);
  expect(finalDims.sw).toBeLessThanOrEqual(finalDims.iw + 1);

  const storedBeforeReset = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mp_space_campaign')));
  expect(Object.keys(storedBeforeReset.results)).toHaveLength(4);
  await page.locator('#next-player').tap();
  await expect(page).toHaveURL(/campaign\.html\?step=0$/);
  await expect(page.locator('#mission-label')).toHaveText('МИССИЯ 1 ИЗ 4');
  const storedAfterReset = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mp_space_campaign')));
  expect(Object.keys(storedAfterReset.results)).toHaveLength(0);

  await context.close();
});
