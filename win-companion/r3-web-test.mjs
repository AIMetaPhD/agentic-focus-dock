import fs from "node:fs";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});

await page.goto("http://127.0.0.1:4317", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

const lang = await page.locator(".lang-switch").innerText();
if (lang.includes("EN")) {
  await page.locator(".lang-switch").click();
  await page.waitForTimeout(400);
}

await page.locator(".tabs").getByRole("button", { name: "Modes", exact: true }).click();
await page.waitForTimeout(500);
await page.locator(".mode-list-item").filter({ hasText: "Writing" }).click();
await page.waitForFunction(
  () => document.querySelectorAll(".native-picker-row option").length > 1,
  null,
  { timeout: 20000 },
);
await page.getByLabel("Select an installed app").selectOption({ label: "Character Map" });
await page.getByRole("button", { name: "Add app", exact: true }).click();
await page.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(800);

await page.locator(".tabs").getByRole("button", { name: "Focus", exact: true }).click();
await page.waitForTimeout(500);
const charTile = page.locator(".dock-apps button").filter({ hasText: "Character Map" }).first();
await charTile.click();
await page.waitForTimeout(900);
const launchToast = await page.locator(".toast").innerText().catch(() => "");
await page.screenshot({
  path: "qa/evidence/native/r3-web-launch.png",
  clip: { x: 0, y: 0, width: 1440, height: 240 },
});

const setup = await page.evaluate(async () => {
  const state = await (await fetch("/api/state")).json();
  const apps = await (await fetch("/api/native/apps")).json();
  const char = apps.apps.find((app) => app.name === "Character Map");
  const mode = state.modes.find((item) => item.id === "writing");
  const pinned = mode.pinned_items
    .filter((item) => item.label !== "X" && item.label !== "Character Map")
    .concat([{ id: "native-x-test", label: "X", icon: "𝕏", kind: "app", bundle_id: char.id }]);
  const body = {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: pinned,
    activity_app_allowlist: mode.activity_app_allowlist,
    keywords: mode.keywords,
    transition: mode.transition,
    notifications: { ...mode.notifications, switch_wait_seconds: 4, social_switch_enabled: true },
    sort_order: mode.sort_order,
  };
  const csrf = document.cookie.match(/fd_csrf=([^;]+)/)?.[1] ?? "";
  const response = await fetch("/api/modes/writing", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-focusdock-csrf": csrf },
    body: JSON.stringify(body),
  });
  return { status: response.status, charId: char.id };
});

await page.reload();
await page.waitForTimeout(900);
const xTile = page.locator(".dock-apps button").filter({ hasText: "X" }).first();
await xTile.click();
await page.waitForSelector(".social-gate");
const gateText = await page.locator(".social-gate-card").innerText();
await page.locator(".social-gate-card").screenshot({
  path: "qa/evidence/native/r3-social-pause.png",
});
await page.locator(".social-gate-card").getByRole("button", { name: "Cancel", exact: true }).click();
await page.waitForTimeout(300);

await xTile.click();
await page.waitForSelector(".social-gate");
await page.waitForFunction(
  () => {
    const button = document.querySelector(".social-gate-card .btn-primary");
    return button instanceof HTMLButtonElement && !button.disabled;
  },
  null,
  { timeout: 10000 },
);
await page.locator(".social-gate-card").getByRole("button", { name: "Open now" }).click();
await page.waitForTimeout(1000);
const socialToast = await page.locator(".toast").innerText().catch(() => "");
await page.screenshot({
  path: "qa/evidence/native/r3-social-open.png",
  clip: { x: 0, y: 0, width: 1440, height: 170 },
});

await page.evaluate(async () => {
  const state = await (await fetch("/api/state")).json();
  const mode = state.modes.find((item) => item.id === "writing");
  const body = {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: mode.pinned_items.filter(
      (item) => item.label !== "X" && item.label !== "Character Map",
    ),
    activity_app_allowlist: mode.activity_app_allowlist,
    keywords: mode.keywords,
    transition: mode.transition,
    notifications: { ...mode.notifications, switch_wait_seconds: 30 },
    sort_order: mode.sort_order,
  };
  const csrf = document.cookie.match(/fd_csrf=([^;]+)/)?.[1] ?? "";
  await fetch("/api/modes/writing", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-focusdock-csrf": csrf },
    body: JSON.stringify(body),
  });
});

const result = { launchToast, gateText, socialToast, setup };
fs.writeFileSync("qa/evidence/native/r3-web-test.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
