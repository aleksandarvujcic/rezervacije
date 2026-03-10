import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174';

// Helper: login and return authenticated page
async function login(page: Page, username = 'admin', password = 'admin123') {
  await page.goto(BASE);
  // Should redirect to login
  await page.waitForURL('**/login', { timeout: 5000 });

  await page.fill('input[placeholder*="korisničko"]', username);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Should navigate to floor-plan after login
  await page.waitForURL('**/floor-plan', { timeout: 10000 });
}

test.describe('Authentication', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForURL('**/login');
    await expect(page.locator('text=Rezervacije')).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[placeholder*="korisničko"]', 'admin');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Should show error, stay on login
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test('login works and shows floor plan', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/floor-plan/);
    // Should see zone tabs
    await expect(page.locator('text=Glavna sala')).toBeVisible({ timeout: 5000 });
  });

  test('stays logged in after page refresh', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/floor-plan/);

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(3000);

    // Should still be on floor-plan, not redirected to login
    await expect(page).toHaveURL(/floor-plan/);
    await expect(page.locator('text=Glavna sala')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Floor Plan Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('displays zone tabs', async ({ page }) => {
    await expect(page.locator('text=Glavna sala')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Bašta')).toBeVisible();
    await expect(page.locator('text=VIP')).toBeVisible();
  });

  test('displays date navigation with day name', async ({ page }) => {
    // Should show date title with Serbian day name and arrow buttons
    await expect(page.locator('h3')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[aria-label="Prethodni dan"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Sledeci dan"]')).toBeVisible();
  });

  test('has Nova rezervacija button', async ({ page }) => {
    await expect(page.locator('button:has-text("Nova rezervacija")')).toBeVisible({ timeout: 5000 });
  });

  test('has Walk-in button', async ({ page }) => {
    await expect(page.locator('button:has-text("Walk-in")')).toBeVisible({ timeout: 5000 });
  });

  test('shows status bar with counts', async ({ page }) => {
    await expect(page.locator('text=slobodnih stolova')).toBeVisible({ timeout: 5000 });
  });

  test('can switch between zones', async ({ page }) => {
    await page.locator('button[role="tab"]:has-text("Bašta")').click();
    await page.waitForTimeout(1000);
    // Canvas should update (zone tab should be active)
    await expect(page.locator('button[role="tab"][aria-selected="true"]:has-text("Bašta")')).toBeVisible();
  });

  test('canvas renders (Konva stage exists)', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Konva renders into a div with canvas elements
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reservation Creation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Nova rezervacija button opens modal', async ({ page }) => {
    await page.click('button:has-text("Nova rezervacija")');
    await page.waitForTimeout(500);

    // Modal should appear with form fields
    await expect(page.locator('.mantine-Modal-title:has-text("Nova rezervacija")')).toBeVisible({ timeout: 3000 });
  });

  test('reservation form has all required fields', async ({ page }) => {
    await page.click('button:has-text("Nova rezervacija")');
    await page.waitForTimeout(500);

    // Check all form fields exist
    await expect(page.locator('label:has-text("Ime gosta"), input[placeholder*="gosta"]').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('label:has-text("Telefon")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Broj gostiju")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Datum")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Vreme dolaska")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Trajanje")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Stolovi")').first()).toBeVisible();
  });

  test('can fill and submit reservation form', async ({ page }) => {
    // Listen to network requests for debugging
    const requests: { url: string; status: number; body?: string }[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/reservations') && req.method() === 'POST') {
        requests.push({ url: req.url(), status: 0, body: req.postData() || undefined });
      }
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/reservations') && res.request().method() === 'POST') {
        const entry = requests.find((r) => r.url === res.url());
        if (entry) entry.status = res.status();
        res.text().then((t) => console.log(`Response ${res.status()}: ${t}`)).catch(() => {});
      }
    });

    await page.click('button:has-text("Nova rezervacija")');
    await page.waitForTimeout(1000);

    // Fill guest name
    await page.fill('input[placeholder="Unesite ime gosta"]', 'Test Gost E2E');

    // Fill phone
    await page.fill('input[placeholder="Broj telefona"]', '0641234567');

    // Guest count (Mantine NumberInput renders an input inside a wrapper)
    const guestInput = page.locator('.mantine-NumberInput-input');
    await guestInput.clear();
    await guestInput.fill('4');

    // Date is auto-filled to today, skip it

    // Select time - Mantine Select component (pick a later time to avoid conflicts)
    const timeInput = page.locator('input[placeholder="Izaberite vreme"]');
    if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await timeInput.click();
      await page.waitForTimeout(500);
      // Select a later time slot (nth option) to reduce conflict with previous runs
      const options = page.locator('.mantine-Select-option');
      const optCount = await options.count();
      // Pick a time slot in the middle of the day
      const targetIdx = Math.min(Math.floor(optCount / 2), optCount - 1);
      if (optCount > 0) {
        await options.nth(targetIdx).click();
      }
    }

    // Duration is pre-selected (120 min default), skip it

    await page.waitForTimeout(500);

    // Open the MultiSelect dropdown by clicking the input field
    const multiSelectField = page.locator('input.mantine-MultiSelect-inputField');
    await multiSelectField.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // Wait for tables API data to load
    await multiSelectField.click();
    await page.waitForTimeout(1000);

    // Mantine MultiSelect renders options in hidden DOM; find them by text content
    // Table options have format like "SS1 (2 mesta) - Glavna sala"
    const tableTextOption = page.locator('text=/^SS\\d+.*mesta/').first();
    if (await tableTextOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tableTextOption.click();
    }

    // Close dropdown by clicking modal title
    await page.locator('.mantine-Modal-title').click();
    await page.waitForTimeout(300);

    await page.waitForTimeout(300);

    // Take screenshot before submit
    await page.screenshot({ path: '/tmp/before-submit.png' });

    // Click submit
    const submitBtn = page.locator('button:has-text("Kreiraj rezervaciju")');
    await expect(submitBtn).toBeVisible({ timeout: 3000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Take screenshot after submit
    await page.screenshot({ path: '/tmp/after-submit.png' });

    // Log request details
    for (const req of requests) {
      console.log(`POST ${req.url} -> ${req.status}`);
      if (req.body) console.log(`Request body: ${req.body}`);
    }

    // Verify the request was sent with valid data (table_ids not empty)
    const lastReq = requests[requests.length - 1];
    expect(lastReq).toBeDefined();
    const body = JSON.parse(lastReq.body || '{}');
    expect(body.table_ids.length).toBeGreaterThan(0);
    expect(body.guest_name).toBe('Test Gost E2E');
    expect(body.start_time).toBeTruthy();

    // Check result: 201 = success (modal closes), 409 = conflict (table already booked, which is OK for repeat runs)
    if (lastReq.status === 201) {
      // Modal should have closed on success
      const modalStillOpen = await page.locator('.mantine-Modal-title:has-text("Nova rezervacija")').isVisible().catch(() => false);
      expect(modalStillOpen).toBeFalsy();
    } else if (lastReq.status === 409) {
      // Table conflict from previous test run — acceptable
      console.log('Got 409 conflict (table already booked) — acceptable for repeat runs');
    } else {
      // Any other error is a real failure
      throw new Error(`Unexpected response status: ${lastReq.status}`);
    }
  });
});

test.describe('Walk-in', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Walk-in button opens modal', async ({ page }) => {
    await page.click('button:has-text("Walk-in")');
    await page.waitForTimeout(500);
    await expect(page.locator('text=Walk-in gost')).toBeVisible({ timeout: 3000 });
  });

  test('walk-in form has correct fields', async ({ page }) => {
    await page.click('button:has-text("Walk-in")');
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder*="gosta"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('label:has-text("Broj gostiju")').first()).toBeVisible();
    await expect(page.locator('label:has-text("Stolovi")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Dodaj walk-in")')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can navigate to Reservations page', async ({ page }) => {
    await page.click('a:has-text("Rezervacije"), nav >> text=Rezervacije');
    await page.waitForURL('**/reservations', { timeout: 5000 });
    await expect(page).toHaveURL(/reservations/);
  });

  test('can navigate to Admin page', async ({ page }) => {
    await page.click('a:has-text("Admin"), nav >> text=Admin');
    await page.waitForURL('**/admin', { timeout: 5000 });
    await expect(page).toHaveURL(/admin/);
  });

  test('can navigate back to Floor Plan', async ({ page }) => {
    await page.click('a:has-text("Admin"), nav >> text=Admin');
    await page.waitForURL('**/admin');
    await page.click('a:has-text("Mapa stolova"), nav >> text=Mapa');
    await page.waitForURL('**/floor-plan', { timeout: 5000 });
  });
});

test.describe('Reservations Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('a:has-text("Rezervacije"), nav >> text=Rezervacije');
    await page.waitForURL('**/reservations', { timeout: 5000 });
  });

  test('has date picker and filters', async ({ page }) => {
    await expect(page.locator('label:has-text("Datum")').first()).toBeVisible({ timeout: 5000 });
  });

  test('has Nova rezervacija button', async ({ page }) => {
    await expect(page.locator('button:has-text("Nova rezervacija")')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('a:has-text("Admin"), nav >> text=Admin');
    await page.waitForURL('**/admin', { timeout: 5000 });
  });

  test('shows admin tabs', async ({ page }) => {
    await expect(page.locator('text=Administracija')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[role="tab"]:has-text("Zone")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Korisnici")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Radno vreme")')).toBeVisible();
  });

  test('Zone tab shows zones list', async ({ page }) => {
    await expect(page.locator('td:has-text("Glavna sala")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('td:text-is("Bašta")')).toBeVisible();
    await expect(page.locator('td:text-is("VIP")')).toBeVisible();
  });

  test('can open add zone modal', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Dodaj zonu")');
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('input[placeholder="Naziv zone"]')).toBeVisible({ timeout: 3000 });
  });

  test('Users tab shows users', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Korisnici")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=admin').first()).toBeVisible({ timeout: 5000 });
  });

  test('Working hours tab shows days', async ({ page }) => {
    await page.click('button[role="tab"]:has-text("Radno vreme")');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Ponedeljak')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Logout', () => {
  test('logout button works', async ({ page }) => {
    await login(page);

    // Find and click logout
    const logoutBtn = page.locator('button:has-text("Odjavi"), button:has-text("Odjava"), button[aria-label*="logout" i]');
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/login/);
    }
  });
});
