import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  buildResourceUrl,
  classifyExistingResult,
  clean,
  isPlaceholderContent,
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

const [inputArg, taskArg, startArg, endArg] = process.argv.slice(2);
if (!inputArg || !taskArg) {
  throw new Error(
    "用法：node preflight.mjs <input.xlsx> <task-dir> [start-row] [end-row]",
  );
}

const inputPath = path.resolve(inputArg);
const taskDir = path.resolve(taskArg);
const startRow = startArg ? Number(startArg) : 2;
const inputBytes = await fs.readFile(inputPath);
const sourceHash = crypto.createHash("sha256").update(inputBytes).digest("hex");

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = workbook.worksheets.getItemAt(0);
const used = sheet.getUsedRange();
const values = sheet
  .getRangeByIndexes(0, 0, used.rowCount, used.columnCount)
  .values;
const headers = (values[0] || []).map(clean);
const endRow = endArg ? Number(endArg) : values.length;

if (!Number.isInteger(startRow) || startRow < 2) {
  throw new Error(`start-row 必须是大于等于 2 的整数：${startArg}`);
}
if (!Number.isInteger(endRow) || endRow < startRow || endRow > values.length) {
  throw new Error(`end-row 必须位于 ${startRow} 至 ${values.length}：${endArg}`);
}

const aliases = {
  uid: ["UID", "uid", "用户UID", "用户ID"],
  nid: ["NID", "nid", "资源NID", "视频NID"],
  content: ["内容", "评论内容", "语音内容", "转写内容"],
  status: ["状态", "审核状态"],
  failureReason: ["失败原因", "失败原因说明"],
  commentId: ["评论ID", "评论id", "评论编号"],
  result: ["抽检结果", "审核结果", "本次审核结果", "判定结果"],
  reviewer: ["抽检人", "审核人", "复核人"],
  url: ["URL", "url", "资源链接", "视频链接", "视频资源链接"],
  reviewUrl: ["复核链接", "视频复核链接"],
};

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[\s_\-:：]/g, "");
}

function findColumn(names) {
  const wanted = new Set(names.map(normalizeHeader));
  const index = headers.findIndex((header) => wanted.has(normalizeHeader(header)));
  return index < 0 ? null : index;
}

const columns = Object.fromEntries(
  Object.entries(aliases).map(([key, names]) => [key, findColumn(names)]),
);
const missing = ["uid", "content", "status"].filter((key) => columns[key] === null);
if (columns.nid === null && columns.url === null) {
  missing.push("nid 或 URL");
}
if (missing.length) {
  throw new Error(`工作表缺少必要字段：${missing.join("、")}`);
}

function cell(row, key) {
  const index = columns[key];
  return index === null ? "" : row[index];
}

function rowRecord(row, excelRow) {
  const uid = clean(cell(row, "uid"));
  const nid = clean(cell(row, "nid"));
  const sourceUrl = clean(cell(row, "url"));
  const content = clean(cell(row, "content"));
  const result = clean(cell(row, "result"));
  return {
    excelRow,
    uid,
    nid,
    content,
    status: clean(cell(row, "status")),
    failureReason: clean(cell(row, "failureReason")),
    commentId: clean(cell(row, "commentId")),
    existingResult: result,
    existingReviewer: clean(cell(row, "reviewer")),
    url: sourceUrl,
    resourceUrl: buildResourceUrl(nid, sourceUrl),
    existingState: classifyExistingResult(result),
  };
}

const allRecords = values
  .slice(1)
  .map((row, index) => rowRecord(row, index + 2));
const inRangeRecords = allRecords.filter(
  (record) => record.excelRow >= startRow && record.excelRow <= endRow,
);

const historicalStateByUid = new Map();
for (const record of allRecords) {
  if (!record.uid) continue;
  const state = record.existingState;
  const current = historicalStateByUid.get(record.uid);
  if (!current || state === "confirmed_unqualified") {
    historicalStateByUid.set(record.uid, state);
  }
}

const reviewQueue = [];
const preserved = [];
const excluded = [];
const closedUids = new Set(
  [...historicalStateByUid.entries()]
    .filter(([, state]) => state === "confirmed_unqualified")
    .map(([uid]) => uid),
);

for (const record of inRangeRecords) {
  if (record.status !== "成功") {
    excluded.push({ ...record, excludeReason: "status-not-success" });
    continue;
  }
  if (!record.uid) {
    excluded.push({ ...record, excludeReason: "empty-uid" });
    continue;
  }
  if (isPlaceholderContent(record.content)) {
    excluded.push({ ...record, excludeReason: "placeholder-or-empty-content" });
    continue;
  }
  if (closedUids.has(record.uid)) {
    preserved.push({ ...record, preserveReason: "historical-confirmed-unqualified" });
    continue;
  }
  if (record.existingState === "qualified") {
    preserved.push({ ...record, preserveReason: "historical-qualified-context" });
    continue;
  }
  if (record.existingState === "other") {
    preserved.push({ ...record, preserveReason: "nonstandard-existing-result" });
    continue;
  }
  reviewQueue.push({
    ...record,
    reviewAction:
      record.existingState === "suspicious"
        ? "review-existing-suspicion"
        : "review",
  });
}

const titleByNid = new Map();
for (const record of reviewQueue) {
  if (!record.nid) continue;
  if (!titleByNid.has(record.nid)) {
    titleByNid.set(record.nid, {
      nid: record.nid,
      resourceUrl: record.resourceUrl,
      rows: [],
    });
  }
  titleByNid.get(record.nid).rows.push(record.excelRow);
}

const manifest = {
  taskId: path.basename(taskDir),
  inputPath,
  sourceHash,
  sheetName: sheet.name || "",
  headers,
  columns: Object.fromEntries(
    Object.entries(columns).map(([key, index]) => [key, index === null ? null : index + 1]),
  ),
  range: { startRow, endRow },
  totalRowsIncludingHeader: values.length,
  counts: {
    sourceRows: Math.max(0, values.length - 1),
    inRangeRows: inRangeRecords.length,
    reviewQueueRows: reviewQueue.length,
    preservedRows: preserved.length,
    excludedRows: excluded.length,
    historicalClosedUidCount: closedUids.size,
    uniqueReviewUids: new Set(reviewQueue.map((record) => record.uid)).size,
    uniqueNids: titleByNid.size,
  },
  generatedAt: new Date().toISOString(),
};

await fs.mkdir(path.join(taskDir, "normalized"), { recursive: true });
await fs.mkdir(path.join(taskDir, "titles"), { recursive: true });
await fs.writeFile(
  path.join(taskDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
await fs.writeFile(
  path.join(taskDir, "normalized", "records.json"),
  JSON.stringify(
    {
      manifest,
      records: inRangeRecords,
      reviewQueue,
      preserved,
      excluded,
    },
    null,
    2,
  ) + "\n",
);
await fs.writeFile(
  path.join(taskDir, "titles", "queue.json"),
  JSON.stringify([...titleByNid.values()], null, 2) + "\n",
);

console.log(JSON.stringify(manifest, null, 2));
