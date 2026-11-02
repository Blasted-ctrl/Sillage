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
  for (const width of [390, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({
    path: 'test-results/sillage-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: 'test-results/sillage-mobile.png',
    fullPage: true,
  })
})
