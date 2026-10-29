import { afterEach, describe, expect, it } from "vitest";
import { openStore, type Store } from "../src/store";
import {
  ProposalError,
  applyOps,
  computeDiff,
  rulesProposal,
  validatePatch,
} from "../src/domain/proposals";

let store: Store | null = null;

function freshStore(): Store {
  store = openStore(":memory:");
  return store;
}

afterEach(() => {
  store?.close();
  store = null;
});

describe("validatePatch", () => {
  it("accepts a constrained mode creation", () => {
    const s = freshStore();
    const modes = s.listModes();
    const result = rulesProposal("Create a Reading mode with papers pinned, defer social messages.", modes);
    const ops = validatePatch(result.patch, modes);
    expect(ops).toHaveLength(1);
    expect(ops[0]!.path).toBe("/modes/reading");
  });

  it("rejects path traversal and unknown fields", () => {
    const s = freshStore();
    const modes = s.listModes();
    expect(() =>
      validatePatch([{ op: "replace", path: "/modes/writing/../../etc/passwd", value: "x" }], modes),
    ).toThrow(ProposalError);
    expect(() =>
      validatePatch([{ op: "replace", path: "/modes/writing/id", value: "hacked" }], modes),
    ).toThrow(ProposalError);
    expect(() =>
      validatePatch([{ op: "replace", path: "/modes/writing/name", value: "x" }, { op: "remove", path: "/modes/writing/name" }], modes),
    ).toThrow(ProposalError);
  });

  it("rejects adding an existing mode", () => {
    const s = freshStore();
    const modes = s.listModes();
    const writing = modes.find((m) => m.id === "writing")!;
    expect(() =>
      validatePatch([{ op: "add", path: "/modes/writing", value: writing }], modes),
    ).toThrow(/already exists/);
  });

  it("rejects out-of-range values", () => {
    const s = freshStore();
    const modes = s.listModes();
    expect(() =>
      validatePatch(
        [{ op: "replace", path: "/modes/writing/notifications/switch_wait_seconds", value: 9999 }],
        modes,
      ),
    ).toThrow(ProposalError);
  });
});

describe("rulesProposal", () => {
  it("creates a mode from Chinese natural language", () => {
    const s = freshStore();
    const result = rulesProposal("新增一个 Reading 模式，将论文阅读和文献工具设为默认，并把社交通知延后", s.listModes());
    expect(result.patch[0]!.op).toBe("add");
    expect(result.patch[0]!.path).toBe("/modes/reading");
    const value = result.patch[0]!.value as { name: string; notifications: { default: string } };
    expect(value.name).toBe("Reading");
    expect(value.notifications.default).toBe("defer");
  });

  it("edits a possessive switch wait", () => {
    const s = freshStore();
    const result = rulesProposal("Change Writing's switch wait to 45 seconds.", s.listModes());
    expect(result.patch[0]).toEqual({
      op: "replace",
      path: "/modes/writing/notifications/switch_wait_seconds",
      value: 45,
    });
  });

  it("changes a colour without the word 'colour'", () => {
    const s = freshStore();
    const result = rulesProposal("Make Building blue.", s.listModes());
    expect(result.patch[0]!.path).toBe("/modes/building/color");
    expect(result.patch[0]!.value).toBe("blue");
  });

  it("renames a mode", () => {
    const s = freshStore();
    const result = rulesProposal("Rename Break to Recharge.", s.listModes());
    expect(result.patch[0]!.path).toBe("/modes/break/name");
    expect(result.patch[0]!.value).toBe("Recharge");
  });

  it("refuses commands that are not mode edits", () => {
    const s = freshStore();
    expect(() => rulesProposal("rm -rf / and add a shell command", s.listModes())).toThrow(ProposalError);
  });
});

describe("apply and rollback", () => {
  it("applies a new mode and can roll back an edit", () => {
    const s = freshStore();
    const modes = s.listModes();
    const created = rulesProposal("Create a Reading mode with papers pinned.", modes);
    const ids = applyOps(s, created.patch, "rules");
    expect(ids).toEqual(["reading"]);
    expect(s.getMode("reading")!.version).toBe(1);

    const edit = rulesProposal("Change Reading's switch wait to 45 seconds.", s.listModes());
    applyOps(s, edit.patch, "rules");
    const afterEdit = s.getMode("reading")!;
    expect(afterEdit.notifications.switch_wait_seconds).toBe(45);
    expect(afterEdit.version).toBe(2);

    s.rollbackMode("reading", 1);
    const rolled = s.getMode("reading")!;
    expect(rolled.notifications.switch_wait_seconds).toBe(30);
    expect(rolled.version).toBe(3);
    expect(s.listVersions("reading").length).toBe(3);
  });

  it("computes a readable diff", () => {
    const s = freshStore();
    const ops = rulesProposal("Change Writing's switch wait to 45 seconds.", s.listModes()).patch;
    const { diff } = computeDiff(ops, s.listModes());
    expect(diff).toHaveLength(1);
    expect(diff[0]!.before).toBe(30);
    expect(diff[0]!.after).toBe(45);
  });

  it("rejects the whole batch before writing anything", () => {
    const s = freshStore();
    const before = s.listModes().map((m) => m.id);
    expect(() =>
      applyOps(
        s,
        [
          { op: "add", path: "/modes/reading", value: { name: "Reading" } },
          { op: "remove", path: "/modes/writing" },
          { op: "replace", path: "/modes/reading/id", value: "x" },
        ],
        "rules",
      ),
    ).toThrow();
    expect(s.listModes().map((m) => m.id)).toEqual(before);
  });
});
