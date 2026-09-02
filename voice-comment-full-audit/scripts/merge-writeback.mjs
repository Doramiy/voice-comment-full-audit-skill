import fs from "node:fs/promises";
import path from "node:path";

import {
  FIXED_REASONS,
  buildResourceUrl,
  clean,
  mergeUidDecisions,
  normalizeReason,
} from "./audit-logic.mjs";

let FileBlob;
let SpreadsheetFile;
try {
  ({ FileBlob, SpreadsheetFile } = await import("@oai/artifact-tool"));
} catch (error) {
  throw new Error(
    "未找到 @oai/artifact-tool。请先调用 load_workspace_dependencies，" +
      "并将返回的 bundled node_modules 链接到任务目录。",
    { cause: error },
  );
}

const [inputArg, decisionsArg, outputArg, reviewerArg = ""] = process.argv.slice(2);
if (!inputArg || !decisionsArg || !outputArg) {
  throw new Error(
    "用法：node merge-writeback.mjs <input.xlsx> <decisions.json> <output.xlsx> [reviewers]",
  );
}

const inputPath = path.resolve(inputArg);
const decisionsPath = path.resolve(decisionsArg);
const outputPath = path.resolve(outputArg);
const rawDecisions = JSON.parse(await fs.readFile(decisionsPath, "utf8"));
const inputDecisions = Array.isArray(rawDecisions)
  ? rawDecisions
  : rawDecisions.items || rawDecisions.decisions || [];
if (!Array.isArray(inputDecisions)) throw new Error("decisions.json 必须包含数组");

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[\s_\-:：]/g, "");
}

function columnLetter(index) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function findHeader(headers, aliases) {
  const wanted = new Set(aliases.map(normalizeHeader));
  const index = headers.findIndex((header) => wanted.has(normalizeHeader(header)));
  return index < 0 ? null : index;
}

function decisionKind(item) {
  const raw = clean(item.decision || item.status || item.result);
  if (["confirmed_unqualified", "不合格", "unqualified"].includes(raw)) {
    return "confirmed_unqualified";
  }
  if (["suspicious", "疑似不合格", "疑似"].includes(raw)) return "suspicious";
  if (["qualified", "合格", "pass"].includes(raw)) return "qualified";
  throw new Error(`无法识别决策状态：${raw}`);
}

const decisions = inputDecisions.map((item) => {
  const decision = decisionKind(item);
  const reason = decision === "qualified" ? "" : normalizeReason(item.reason);
  if (decision !== "qualified" && !reason) {
    throw new Error(`第 ${item.row ?? item.excelRow} 行的不合格原因不在固定范围内`);
  }
  return {
    ...item,
    row: Number(item.row ?? item.excelRow),
    uid: clean(item.uid),
    decision,
    reason,
  };
});
const merged = mergeUidDecisions(decisions);
const reviewerNames = reviewerArg
  .split(/[,，、\s]+/)
  .map(clean)
  .filter(Boolean);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange();
const values = sheet
  .getRangeByIndexes(0, 0, used.rowCount, used.columnCount)
  .values;
const headers = (values[0] || []).map(clean);

let resultColumn = findHeader(headers, ["抽检结果", "审核结果", "本次审核结果", "判定结果"]);
let reviewerColumn = findHeader(headers, ["抽检人", "审核人", "复核人"]);
let reviewUrlColumn = findHeader(headers, ["复核链接", "视频复核链接"]);
let nextColumn = Math.max(headers.length, used.columnCount);

async function appendHeader(label) {
  const column = nextColumn;
  nextColumn += 1;
  sheet.getRangeByIndexes(0, column, 1, 1).values = [[label]];
  headers[column] = label;
  return column;
}

if (resultColumn === null) resultColumn = await appendHeader("抽检结果");
if (reviewerColumn === null) reviewerColumn = await appendHeader("抽检人");
if (
  reviewUrlColumn === null &&
  merged.some((item) => item.decision === "suspicious")
) {
  reviewUrlColumn = await appendHeader("复核链接");
}

const uidColumn = findHeader(headers, ["UID", "uid", "用户UID", "用户ID"]);
if (uidColumn === null) throw new Error("工作表缺少 UID 列");

const rowsByUid = new Map();
for (let index = 1; index < values.length; index += 1) {
  const uid = clean(values[index][uidColumn]);
  if (!uid) continue;
  if (!rowsByUid.has(uid)) rowsByUid.set(uid, []);
  rowsByUid.get(uid).push(index + 1);
}

function cellValue(row, column) {
  return clean(values[row - 1]?.[column]);
}

function findWritableRow(item) {
  const requestedRow = Number(item.row);
  const requestedUid = clean(item.uid);
  const rows = rowsByUid.get(requestedUid) || [];
  const ordered = [requestedRow, ...rows.filter((row) => row !== requestedRow)];
  for (const row of ordered) {
    if (row < 2 || row > values.length) continue;
    const sourceUid = cellValue(row, uidColumn);
    if (sourceUid !== requestedUid) continue;
    const existingResult = cellValue(row, resultColumn);
    const existingReviewer = cellValue(row, reviewerColumn);
    if (!existingResult && !existingReviewer) return row;
  }
  return null;
}

const writes = [];
const skipped = [];
const assigned = new Set();
let reviewerIndex = 0;
for (const item of merged) {
  if (!item.uid) {
    skipped.push({ ...item, skipReason: "empty-uid" });
    continue;
  }
  if (assigned.has(item.uid)) continue;
  const row = findWritableRow(item);
  if (row === null) {
    skipped.push({ ...item, skipReason: "no-blank-row-preserve-history" });
    continue;
  }
  const reviewer = clean(item.reviewer) ||
    reviewerNames[reviewerIndex++ % Math.max(reviewerNames.length, 1)];
  if (!reviewer) throw new Error(`UID ${item.uid} 缺少抽检人`);

  let resultText;
  if (item.decision === "confirmed_unqualified") {
    resultText = `不合格：${item.reason}`;
  } else if (item.decision === "suspicious") {
    resultText = `疑似不合格：${item.reason}，需人工复核`;
  } else {
    resultText = "合格";
  }

  const resourceUrl = buildResourceUrl(
    clean(item.nid),
    clean(item.resourceUrl || item.url),
  );
  if (item.decision === "suspicious" && !resourceUrl) {
    throw new Error(`疑似 UID ${item.uid} 缺少视频资源链接`);
  }

  sheet.getRange(`${columnLetter(resultColumn)}${row}`).values = [[resultText]];
  sheet.getRange(`${columnLetter(reviewerColumn)}${row}`).values = [[reviewer]];
  if (item.decision === "suspicious" && reviewUrlColumn !== null) {
    sheet.getRange(`${columnLetter(reviewUrlColumn)}${row}`).values = [[resourceUrl]];
  }
  writes.push({
    uid: item.uid,
    row,
    decision: item.decision,
    reason: item.reason,
    reviewer,
    resourceUrl: item.decision === "suspicious" ? resourceUrl : "",
  });
  assigned.add(item.uid);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const summary = {
  inputPath,
  decisionsPath,
  outputPath,
  inputDecisionCount: inputDecisions.length,
  mergedUidCount: merged.length,
  writtenUidCount: writes.length,
  skippedCount: skipped.length,
  fixedReasons: FIXED_REASONS,
  writes,
  skipped,
};
await fs.writeFile(`${outputPath}.summary.json`, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
