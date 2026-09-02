import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const execFileAsync = promisify(execFile);
const node = process.execPath;
const skillDir = path.resolve(new URL("..", import.meta.url).pathname);

async function writeFixture(filePath) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("评论数据");
  sheet.getRange("A1:K8").values = [
    ["ID", "内容", "状态", "评论ID", "URL", "UID", "NID", "抽检人", "抽检结果", "其他", "复核链接"],
    [1, "历史合格", "成功", "c1", "", "u1", "sv_1", "旧人", "合格", "keep", ""],
    [2, "待审核风险", "成功", "c2", "", "u1", "sv_2", "", "", "keep", ""],
    [3, "历史不合格", "成功", "c3", "", "u2", "sv_3", "旧人", "不合格：旧原因", "keep", ""],
    [4, "不应再看", "成功", "c4", "", "u2", "sv_4", "", "", "keep", ""],
    [5, "失败记录", "失败", "c5", "", "u3", "sv_5", "", "", "keep", ""],
    [6, "无法识别", "成功", "c6", "", "u4", "sv_6", "", "", "keep", ""],
    [7, "疑似外部声音", "成功", "c7", "", "u5", "sv_7", "", "", "keep", ""],
  ];
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(filePath);
}

test("preflight, writeback, and validation preserve a scrambled source schema", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "voice-audit-skill-"));
  const source = path.join(tempDir, "source.xlsx");
  const taskDir = path.join(tempDir, "task");
  const decisions = path.join(tempDir, "decisions.json");
  const output = path.join(tempDir, "output.xlsx");
  const report = path.join(tempDir, "report.json");
  await writeFixture(source);

  await execFileAsync(node, [
    path.join(skillDir, "scripts/preflight.mjs"),
    source,
    taskDir,
  ]);
  const normalized = JSON.parse(
    await fs.readFile(path.join(taskDir, "normalized", "records.json"), "utf8"),
  );
  assert.deepEqual(
    normalized.reviewQueue.map((item) => item.excelRow),
    [3, 8],
  );
  assert.equal(normalized.preserved.length, 3);
  assert.equal(normalized.excluded.length, 2);

  await fs.writeFile(
    decisions,
    JSON.stringify({
      items: [
        {
          row: 3,
          uid: "u1",
          decision: "confirmed_unqualified",
          reason: "直接照读视频标题、字幕或视频原声",
        },
        {
          row: 8,
          uid: "u5",
          decision: "suspicious",
          reason: "播放外部声音代替本人评论",
          resourceUrl: "https://mbd.baidu.com/newspage/data/videolanding?nid=sv_7",
        },
      ],
    }),
  );
  await execFileAsync(node, [
    path.join(skillDir, "scripts/merge-writeback.mjs"),
    source,
    decisions,
    output,
    "王霞,卢静,赵佰川",
  ]);

  await execFileAsync(node, [
    path.join(skillDir, "scripts/validate-output.mjs"),
    source,
    output,
    report,
  ]);
  const validation = JSON.parse(await fs.readFile(report, "utf8"));
  assert.equal(validation.passed, true);
  assert.equal(validation.newWriteCount, 2);
  assert.equal(validation.suspiciousCount, 1);

  const workbook = await SpreadsheetFile.importXlsx(await (await import("@oai/artifact-tool")).FileBlob.load(output));
  const values = workbook.worksheets.getItemAt(0).getRange("A1:K8").values;
  assert.equal(values[1][8], "合格");
  assert.equal(values[2][8], "不合格：直接照读视频标题、字幕或视频原声");
  assert.equal(values[2][7], "王霞");
  assert.equal(values[7][8], "疑似不合格：播放外部声音代替本人评论，需人工复核");
  assert.equal(values[7][10], "https://mbd.baidu.com/newspage/data/videolanding?nid=sv_7");
});
