import { describe, expect, it } from "vitest";
import { translate } from "./i18n";

describe("translate", () => {
  it("returns English UI strings", () => {
    expect(translate("en", "nav.focus")).toBe("Focus");
  });

  it("returns Chinese UI strings", () => {
    expect(translate("zh", "nav.focus")).toBe("专注");
  });

  it("interpolates variables", () => {
    expect(translate("en", "focus.switchTo", { mode: "Building" })).toBe("Switch to Building");
    expect(translate("zh", "focus.switchTo", { mode: "Building" })).toBe("切换到 Building");
  });

  it("keeps unknown placeholders visible instead of dropping them", () => {
    expect(translate("en", "notif.waiting", {})).toBe("Switching unlocks in {seconds}s");
  });
});
