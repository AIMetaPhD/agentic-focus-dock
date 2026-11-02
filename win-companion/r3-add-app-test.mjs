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

await page.locator(".app-add").click();
await page.waitForSelector(".native-modal");
await page.getByLabel("Search installed apps").fill("Character Map");
await page.waitForTimeout(300);
await page.locator(".native-modal-card").screenshot({
  path: "qa/evidence/native/r3-add-app-modal.png",
});
await page.locator(".native-app-row").getByRole("button", { name: "Pin", exact: true }).click();
await page.waitForTimeout(900);
const pinnedToast = await page.locator(".toast").innerText().catch(() => "");
const tileCount = await page.locator(".dock-apps button").count();
await page.locator(".dock-wrap").screenshot({
  path: "qa/evidence/native/r3-dock-pinned.png",
});

const cleanup = await page.evaluate(async () => {
  const state = await (await fetch("/api/state")).json();
  const mode = state.modes.find((item) => item.id === "writing");
  const body = {
    name: mode.name,
    color: mode.color,
    icon: mode.icon,
    pinned_items: mode.pinned_items.filter(
      (item) => item.label !== "Character Map" && item.label !== "X",
    ),
    activity_app_allowlist: mode.activity_app_allowlist,
    keywords: mode.keywords,
    transition: mode.transition,
    notifications: mode.notifications,
    sort_order: mode.sort_order,
  };
  const csrf = document.cookie.match(/fd_csrf=([^;]+)/)?.[1] ?? "";
  const response = await fetch("/api/modes/writing", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-focusdock-csrf": csrf },
    body: JSON.stringify(body),
  });
  return response.status;
});

const result = { pinnedToast, tileCount, cleanupStatus: cleanup };
fs.writeFileSync("qa/evidence/native/r3-add-app-test.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
