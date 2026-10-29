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

test("the capability panel states the notification limit honestly", async ({ page }) => {
  await page.getByRole("button", { name: "Permissions" }).click();
  await expect(page.getByText("Unsupported by public APIs")).toBeVisible();
  await expect(page.getByText(/never reads Notification Center databases/)).toBeVisible();
  await expect(page.getByText("macOS only").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/05-permissions.png" });
});

test("the UI can switch between English and Chinese", async ({ page }) => {
  await page.locator(".tabs").getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "简体中文" }).click();
  await expect(page.getByRole("button", { name: "专注" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/06-settings-zh.png" });

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("button", { name: "Focus" })).toBeVisible();
});

test("state is not readable without the session, and evil origins are rejected", async ({ page, request }) => {
  const anonymous = await request.get("http://127.0.0.1:4317/api/state");
  expect(anonymous.status()).toBe(401);

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "fd_session")!.value;
  const csrf = cookies.find((cookie) => cookie.name === "fd_csrf")!.value;

  const evil = await request.post("http://127.0.0.1:4317/api/demo/notification", {
    headers: {
      cookie: `fd_session=${session}; fd_csrf=${csrf}`,
      origin: "https://evil.example",
      "x-focusdock-csrf": csrf,
    },
    data: { source_app: "Slack", title: "attack" },
  });
  expect(evil.status()).toBe(403);
});

test("the demo burst is capped and produces labelled events", async ({ page, request }) => {
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === "fd_session")!.value;
  const csrf = cookies.find((cookie) => cookie.name === "fd_csrf")!.value;
  const response = await request.post("http://127.0.0.1:4317/api/demo/burst", {
    headers: {
      cookie: `fd_session=${session}; fd_csrf=${csrf}`,
      origin: "http://127.0.0.1:4317",
      "x-focusdock-csrf": csrf,
    },
    data: { count: 50 },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { created: number; urgent: number; deferred: number };
  expect(body.created).toBe(50);
  expect(body.urgent).toBe(8);
  expect(body.deferred).toBe(42);

  await page.reload();
  await page.locator(".tabs").getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".timeline-item")).toHaveCount(50);
  await expect(page.getByText("SIMULATED").first()).toBeVisible();
  await page.addStyleTag({ content: ".notification-layer{display:none!important}" });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "qa/evidence/07-timeline.png" });
});
