import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('real search, exclusion, comparison and persistent taste', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await page
    .getByLabel('Describe your ideal scent')
    .fill('woody vanilla without rose')
  await page.getByRole('button', { name: 'Find my scent', exact: true }).click()
  await expect(page.locator('.excluded-label')).toContainText('rose')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  const first = page.locator('.fragrance-card').first()
  const name = await first.locator('h3').innerText()
  await first.getByRole('button', { name: 'Compare', exact: true }).click()
  await expect(page.locator('#compare')).toContainText(name)
  await first.getByRole('button', { name: `Like ${name}`, exact: true }).click()
  await expect(page.locator('#shelf')).toContainText(name)
  const request = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/search') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Find my scent', exact: true }).click()
  expect((await request).postDataJSON().liked_ids).toHaveLength(1)
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await expect(
    page.locator('.fragrance-card h3').filter({ hasText: name }),
  ).toHaveCount(0)
  await page.reload()
  await expect(page.locator('#shelf')).toContainText(name)
  expect(errors).toEqual([])
})

test('fragrance lookup excludes the selected source and explains its matches', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await page.getByRole('button', { name: 'Start with a fragrance' }).click()
  await page.getByLabel('Fragrance name and brand').fill('dior sauvage')
  const suggestion = page.locator('.suggestions button').first()
  await expect(suggestion).toBeVisible()
  const name = await suggestion.locator('span').first().innerText()
  await suggestion.click()
  await page.getByRole('button', { name: 'Find my scent', exact: true }).click()
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await expect(page.locator('#results .section-heading')).toContainText(
    name.toLowerCase(),
  )
  await expect(
    page
      .locator('.fragrance-card h3')
      .filter({ hasText: new RegExp(`^${name}$`) }),
  ).toHaveCount(0)
  await page.locator('.fragrance-card').first().locator('summary').click()
  await expect(page.locator('.similarity').first()).toBeVisible()
})

test('empty and failed searches have recovery, not fabricated matches', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await page.getByLabel('Describe your ideal scent').fill('xyzzyunknown')
  await page.getByRole('button', { name: 'Find my scent', exact: true }).click()
  await expect(page.getByText('Let’s try another direction.')).toBeVisible()
  await expect(page.locator('.fragrance-card')).toHaveCount(0)
  await page.route('**/api/search', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Library temporarily unavailable' }),
    }),
  )
  await page.getByLabel('Describe your ideal scent').fill('woody')
  await page.getByRole('button', { name: 'Find my scent', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'Library temporarily unavailable',
  )
  await page.unroute('**/api/search')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
})

test('desktop and mobile remain accessible with motion reduced', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  await expect(page.locator('.bottle-canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Rotate bottle right' }).click()
  await page.getByRole('button', { name: 'Refine your search' }).click()
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await page.getByRole('button', { name: 'Refine your search' }).click()
  await page.getByLabel('Describe your ideal scent').focus()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Find my scent', exact: true }),
  ).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: '.hallmark/refined-home.png' })
  await page.evaluate(() =>
    window.scrollTo(0, document.getElementById('discover')!.offsetTop),
  )
  await page.screenshot({ path: '.hallmark/refined-discovery-desktop.png' })
  await page.screenshot({
    path: 'test-results/sillage-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() =>
    window.scrollTo(0, document.getElementById('discover')!.offsetTop),
  )
  await page.screenshot({ path: '.hallmark/refined-discovery-mobile.png' })
  await page.screenshot({
    path: 'test-results/sillage-mobile.png',
    fullPage: true,
  })
})

test('centered bottle, finite mist and scent moods are interactive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
  const canvas = page.locator('.bottle-canvas canvas')
  await expect(canvas).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => true))
  const box = await canvas.boundingBox()
  expect(Math.abs(box!.x + box!.width / 2 - 640)).toBeLessThan(4)
  const action = await page.locator('.hero-copy .primary-button').boundingBox()
  expect(action!.y + action!.height).toBeLessThan(800)
  const before = await canvas.screenshot()
  await page.getByRole('button', { name: 'Release mist' }).click()
  const during = await canvas.screenshot()
  expect(during.equals(before)).toBe(false)
  await page.waitForTimeout(5100)
  const settled = await canvas.screenshot()
  const still = await canvas.screenshot()
  expect(still.equals(settled)).toBe(true)
  const searchRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/search') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Sunlit amber', exact: true }).click()
  expect((await searchRequest).postDataJSON().query).toBe(
    'Warm vanilla sandalwood amber',
  )
  await expect(
    page.getByRole('button', { name: 'Sunlit amber', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.fragrance-card')).toHaveCount(9)
})
