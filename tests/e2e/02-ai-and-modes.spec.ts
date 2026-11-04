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
    // Pin English so the specs stay independent of the shipped default language.
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-focusdock-csrf": csrf },
      body: JSON.stringify({ language: "en" }),
    });
  });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await resetData(page);
  await page.getByRole("button", { name: "AI Studio" }).click();
});

test("a natural-language change becomes a diff and applies only after confirmation", async ({ page }) => {
  await page.getByLabel("Describe a change").fill("Change Writing's switch wait to 45 seconds.");
  await page.getByRole("button", { name: "Generate proposal" }).click();

  await expect(page.locator(".diff-entry")).toHaveCount(1);
  await expect(page.locator(".diff-entry")).toContainText(
    "/modes/writing/notifications/switch_wait_seconds",
  );
  await expect(page.locator(".diff-before")).toContainText("30");
  await expect(page.locator(".diff-after")).toContainText("45");
  await expect(page.getByText("Awaiting review").first()).toBeVisible();

  await page.locator(".proposal-panel").screenshot({ path: "qa/evidence/03-ai-diff.png" });

  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".status-pill").first()).toHaveText("Applied");

  await page.getByRole("button", { name: "Modes" }).click();
  await page.locator(".mode-list-item", { hasText: "Writing" }).click();
  await expect(page.getByLabel("Switch cool-down (seconds)")).toHaveValue("45");
  await page.addStyleTag({
    content: ".topbar,.dock-wrap,.notification-layer{display:none!important}",
  });
  await page.locator(".mode-editor").screenshot({ path: "qa/evidence/04-mode-editor.png" });
});

test("a mode version can be rolled back with one click", async ({ page }) => {
  await page.getByLabel("Describe a change").fill("Change Writing's switch wait to 45 seconds.");
  await page.getByRole("button", { name: "Generate proposal" }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".status-pill").first()).toHaveText("Applied");

  await page.getByRole("button", { name: "Modes" }).click();
  await page.locator(".mode-list-item", { hasText: "Writing" }).click();

  page.once("dialog", (dialog) => dialog.accept());
  const versionRow = page.locator(".version-list li").filter({ hasText: "v1" }).first();
  await versionRow.getByRole("button", { name: "Restore" }).click();

  await expect(page.getByLabel("Switch cool-down (seconds)")).toHaveValue("30");
  await page.reload();
  await page.getByRole("button", { name: "Modes" }).click();
  await page.locator(".mode-list-item", { hasText: "Writing" }).click();
  await expect(page.getByLabel("Switch cool-down (seconds)")).toHaveValue("30");
});

test("a new mode can be created, edited and persisted", async ({ page }) => {
  await page.getByRole("button", { name: "Modes" }).click();
  await page.getByRole("button", { name: /New mode/ }).click();
  await page.getByLabel("Name", { exact: true }).fill("Studio");
  await page.getByLabel("Keywords (comma separated)").fill("studio, design, 设计");
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page.locator(".mode-list-item", { hasText: "Studio" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Modes" }).click();
  await expect(page.locator(".mode-list-item", { hasText: "Studio" })).toBeVisible();
  await page.locator(".mode-list-item", { hasText: "Studio" }).click();
  await expect(page.getByLabel("Keywords (comma separated)")).toHaveValue("studio, design, 设计");
});

test("unsafe instructions are rejected without changing anything", async ({ page }) => {
  await page.getByLabel("Describe a change").fill("rm -rf / and add a shell command");
  await page.getByRole("button", { name: "Generate proposal" }).click();
  await expect(page.locator(".form-error")).toContainText("only supports");
  await expect(page.locator(".proposal-panel .empty")).toBeVisible();
});
