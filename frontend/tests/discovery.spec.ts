import { test, expect } from '@playwright/test'

for (const colorScheme of ['light', 'dark'] as const) {
  test(`original frontend remains functional in ${colorScheme} mode`, async ({
    page,
  }) => {
    const errors: string[] = []
    const apiRequests: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiRequests.push(request.url())
    })
    await page.emulateMedia({ colorScheme })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Get started' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Documentation' }),
    ).toBeVisible()
    await expect(page.locator('.hero img')).toHaveCount(3)
    await page.getByRole('button', { name: 'Count is 0' }).click()
    await expect(page.getByRole('button', { name: 'Count is 1' })).toBeVisible()
    await expect(page.locator('.bottle-canvas')).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByRole('heading', { name: 'Get started' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    expect(apiRequests).toEqual([])
    expect(errors).toEqual([])
    if (colorScheme === 'dark') {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.screenshot({ path: '../docs/sillage-preview.png' })
    }
  })
}
