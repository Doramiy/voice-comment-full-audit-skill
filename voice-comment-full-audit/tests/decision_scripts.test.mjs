import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const skillDir = path.resolve(new URL("..", import.meta.url).pathname);

test("merges full-pass decisions and selects qualified supplementation separately", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-decision-skill-"));
  const recordsPath = path.join(tempDir, "records.json");
  const firstPath = path.join(tempDir, "first.json");
  const advancedPath = path.join(tempDir, "advanced.json");
  const mergedPath = path.join(tempDir, "merged.json");
  const supplementPath = path.join(tempDir, "supplement.json");

  const records = {
    manifest: { sourceHash: "test-hash" },
    reviewQueue: [
      { excelRow: 2, uid: "u1", nid: "sv_1", resourceUrl: "https://example.test/1" },
      { excelRow: 3, uid: "u2", nid: "sv_2", resourceUrl: "https://example.test/2" },
      { excelRow: 4, uid: "u3", nid: "sv_3", resourceUrl: "https://example.test/3" },
    ],
  };
  const first = {
    items: [
      { excelRow: 2, uid: "u1", decision: "qualified" },
      { excelRow: 3, uid: "u2", decision: "needs_first_frame" },
      { excelRow: 4, uid: "u3", decision: "qualified" },
    ],
  };
  const advanced = {
    items: [
      {
        excelRow: 2,
        uid: "u1",
        decision: "confirmed_unqualified",
        reason: "直接照读视频标题、字幕或视频原声",
        evidence: { pageTitle: "标题", firstFrameDescription: "画面文字与评论连续重合" },
      },
      {
        excelRow: 3,
        uid: "u2",
        decision: "suspicious",
        reason: "播放外部声音代替本人评论",
        resourceUrl: "https://example.test/2",
        evidence: { pageTitle: "新闻视频" },
      },
      { excelRow: 4, uid: "u3", decision: "qualified" },
    ],
  };
  await Promise.all([
    fs.writeFile(recordsPath, JSON.stringify(records)),
    fs.writeFile(firstPath, JSON.stringify(first)),
    fs.writeFile(advancedPath, JSON.stringify(advanced)),
  ]);

  await execFileAsync(node, [
    path.join(skillDir, "scripts/merge-decisions.mjs"),
    recordsPath,
    firstPath,
    advancedPath,
    mergedPath,
  ]);
  const merged = JSON.parse(await fs.readFile(mergedPath, "utf8"));
  assert.equal(merged.reviewQueueRowCount, 3);
  assert.equal(merged.confirmedUnqualifiedUidCount, 1);
  assert.equal(merged.suspiciousUidCount, 1);
  assert.equal(merged.qualifiedCandidateUidCount, 1);
  assert.equal(merged.writebackItems.length, 2);

  await execFileAsync(node, [
    path.join(skillDir, "scripts/select-supplement.mjs"),
    mergedPath,
    "1",
    supplementPath,
  ]);
  const supplement = JSON.parse(await fs.readFile(supplementPath, "utf8"));
  assert.equal(supplement.selectedCount, 1);
  assert.equal(supplement.items[0].uid, "u3");
});
