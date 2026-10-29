import { expect, test, type Page } from "@playwright/test";

async function resetData(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    const csrf = document.cookie.match(/fd_csrf=([^;]+)/)?.[1] ?? "";
    await fetch("/api/data/reset", {
      method: "POST",
      headers: { "content-type": "application/json", "x-focusdock-csrf": csrf },
      body: JSON.stringify({ confirm: "RESET" }),
    });
  });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await resetData(page);
});

test("the dock renders all six modes with Writing active", async ({ page }) => {
  await expect(page.locator(".hero-title")).toContainText("Writing");
  await expect(page.locator(".dock .mode-pill")).toHaveCount(6);
  await expect(page.locator('.dock .mode-pill[aria-pressed="true"]')).toContainText("Writing");
  await expect(page.getByText("SIMULATED").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/00-focus-writing.png" });
});

test("a simulated social message is deferred, labelled and can be kept for later", async ({ page }) => {
  await page.getByRole("button", { name: /Simulate Slack message/ }).click();

  const card = page.locator(".notif-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Maya Chen in #launch");
  await expect(card).toContainText("SIMULATED");
  await expect(card).toContainText("Held for social");
  await expect(card.getByRole("button", { name: /Go to Social/ })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/01-notification.png" });

  await card.getByRole("button", { name: "Stay" }).click();
  await expect(page.locator(".notif-card")).toHaveCount(0);
  await expect(page.locator(".hero-title")).toContainText("Writing");
  await expect(page.getByText("Nothing is waiting")).toBeVisible();
});

test("a time-sensitive event is surfaced immediately", async ({ page }) => {
  await page.getByRole("button", { name: /Time-sensitive ping/ }).click();
  const card = page.locator(".notif-card.is-urgent");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Time-sensitive");
  await expect(card.getByRole("button", { name: "Dismiss" })).toBeEnabled();
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.locator(".notif-card")).toHaveCount(0);
});

test("a stable VS Code session suggests Building, switches, and survives reload", async ({ page }) => {
  await page.getByRole("button", { name: /Simulate VS Code focus/ }).click();
  const suggestion = page.locator(".suggestion");
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText("Fits Building");
  await expect(suggestion).toContainText("15s of stable focus");

  await suggestion.getByRole("button", { name: /Switch to Building/ }).click();
  await expect(page.locator(".hero-title")).toContainText("Building");
  await expect(page.locator('.dock .mode-pill[aria-pressed="true"]')).toContainText("Building");

  await page.reload();
  await expect(page.locator(".hero-title")).toContainText("Building");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/02-focus-building.png" });
});

test("manual lock is visible and reversible", async ({ page }) => {
  const chip = page.locator(".status-chip");
  await expect(chip).toContainText("Auto suggestions on");
  await chip.click();
  await expect(chip).toContainText("Manual lock on");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await chip.click();
  await expect(chip).toContainText("Auto suggestions on");
});
