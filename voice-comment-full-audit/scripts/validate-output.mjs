import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  FIXED_REASONS,
  clean,
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

// Validate source/output without rewriting either workbook.
const [sourceArg, outputArg, reportArg = ""] = process.argv.slice(2);
if (!sourceArg || !outputArg) {
  throw new Error(
    "用法：node validate-output.mjs <input.xlsx> <output.xlsx> [report.json]",
  );
}

const sourcePath = path.resolve(sourceArg);
const outputPath = path.resolve(outputArg);
const reportPath = path.resolve(
  reportArg || `${outputPath}.validation.json`,
);
if (sourcePath === outputPath) {
  throw new Error("输出文件不能覆盖源文件");
}

function normalizeHeader(value) {
  return clean(value).toLowerCase().replace(/[\s_\-:：]/g, "");
}

function findHeader(headers, aliases) {
  const wanted = new Set(aliases.map(normalizeHeader));
  const index = headers.findIndex((header) => wanted.has(normalizeHeader(header)));
  return index < 0 ? null : index;
}

function matrixFrom(sheet) {
  const used = sheet.getUsedRange();
  return sheet
    .getRangeByIndexes(0, 0, used.rowCount, used.columnCount)
    .values;
}

function zipStructure(filePath) {
  try {
    const entries = execFileSync("unzip", ["-Z1", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split(/\r?\n/)
      .filter(Boolean);
    const worksheetEntries = entries.filter((entry) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(entry),
    );
    let hiddenRows = 0;
    let autoFilters = 0;
    for (const entry of worksheetEntries) {
      const xml = execFileSync("unzip", ["-p", filePath, entry], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      hiddenRows += (xml.match(/<row\b[^>]*\bhidden\s*=\s*["']1["']/g) || []).length;
      autoFilters += (xml.match(/<autoFilter\b/g) || []).length;
    }
    return { available: true, hiddenRows, autoFilters };
  } catch (error) {
    return {
      available: false,
      hiddenRows: null,
      autoFilters: null,
      error: String(error.message || error),
    };
  }
}

const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const outputWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const sourceValues = matrixFrom(sourceWorkbook.worksheets.getItemAt(0));
const outputValues = matrixFrom(outputWorkbook.worksheets.getItemAt(0));
const sourceHeaders = (sourceValues[0] || []).map(clean);
const outputHeaders = (outputValues[0] || []).map(clean);

const resultAliases = ["抽检结果", "审核结果", "本次审核结果", "判定结果"];
const reviewerAliases = ["抽检人", "审核人", "复核人"];
const uidAliases = ["UID", "uid", "用户UID", "用户ID"];
const outputResultColumn = findHeader(outputHeaders, resultAliases);
const outputReviewerColumn = findHeader(outputHeaders, reviewerAliases);
const outputUidColumn = findHeader(outputHeaders, uidAliases);
const outputReviewUrlColumn = findHeader(outputHeaders, ["复核链接", "视频复核链接"]);
const sourceResultColumn = findHeader(sourceHeaders, resultAliases);
const sourceReviewerColumn = findHeader(sourceHeaders, reviewerAliases);
const sourceReviewUrlColumn = findHeader(sourceHeaders, ["复核链接", "视频复核链接"]);
const sourceUidColumn = findHeader(sourceHeaders, uidAliases);

if (outputResultColumn === null || outputReviewerColumn === null || outputUidColumn === null) {
  throw new Error("输出文件缺少 UID、抽检结果或抽检人列");
}
if (sourceUidColumn === null) throw new Error("源文件缺少 UID 列");
if (outputValues.length !== sourceValues.length) {
  throw new Error(`源文件和输出文件行数不一致：${sourceValues.length} / ${outputValues.length}`);
}

const headerOrderPreserved =
  sourceHeaders.every((header, index) => outputHeaders[index] === header);
const newWriteRows = [];
const historicalChanges = [];
const untouchedChanges = [];
const allSourceColumnCount = sourceHeaders.length;

for (let rowIndex = 1; rowIndex < sourceValues.length; rowIndex += 1) {
  const sourceRow = sourceValues[rowIndex] || [];
  const outputRow = outputValues[rowIndex] || [];
  for (let column = 0; column < allSourceColumnCount; column += 1) {
    const before = clean(sourceRow[column]);
    const after = clean(outputRow[column]);
    const isResult = column === sourceResultColumn;
    const isReviewer = column === sourceReviewerColumn;
    const isReviewUrl = column === sourceReviewUrlColumn;
    if (before === after) continue;
    if (isResult || isReviewer || isReviewUrl) {
      if (before) {
        historicalChanges.push({ row: rowIndex + 1, column, before, after });
      } else if (!isReviewUrl) {
        // A blank result/reviewer cell is an expected new write.
      }
    } else {
      untouchedChanges.push({ row: rowIndex + 1, column, before, after });
    }
  }

  const sourceResult = sourceResultColumn === null ? "" : clean(sourceRow[sourceResultColumn]);
  const sourceReviewer = sourceReviewerColumn === null ? "" : clean(sourceRow[sourceReviewerColumn]);
  const outputResult = clean(outputRow[outputResultColumn]);
  const outputReviewer = clean(outputRow[outputReviewerColumn]);
  if (!sourceResult && !sourceReviewer && (outputResult || outputReviewer)) {
    newWriteRows.push({
      row: rowIndex + 1,
      uid: clean(outputRow[outputUidColumn]),
      result: outputResult,
      reviewer: outputReviewer,
      reviewUrl:
        outputReviewUrlColumn === null ? "" : clean(outputRow[outputReviewUrlColumn]),
    });
  }
}

const newUidCounts = new Map();
for (const item of newWriteRows) {
  newUidCounts.set(item.uid, (newUidCounts.get(item.uid) || 0) + 1);
}
const duplicateUids = [...newUidCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([uid]) => uid);
const invalidRows = [];
for (const item of newWriteRows) {
  const result = item.result;
  if (!item.uid || !item.reviewer) {
    invalidRows.push({ ...item, reason: "missing-uid-or-reviewer" });
    continue;
  }
  if (result === "合格") continue;
  if (!result.startsWith("不合格：") && !result.startsWith("疑似不合格：")) {
    invalidRows.push({ ...item, reason: "invalid-result-format" });
    continue;
  }
  const reasonText = result
    .replace(/^不合格：/, "")
    .replace(/^疑似不合格：/, "")
    .replace(/，需人工复核$/, "")
    .trim();
  if (!FIXED_REASONS.includes(normalizeReason(reasonText))) {
    invalidRows.push({ ...item, reason: "invalid-fixed-reason" });
  }
  if (result.startsWith("疑似不合格：") && !item.reviewUrl) {
    invalidRows.push({ ...item, reason: "suspicious-missing-resource-url" });
  }
}

const structureSource = zipStructure(sourcePath);
const structureOutput = zipStructure(outputPath);
const structureChecks = {
  hiddenRowsAdded:
    structureSource.available && structureOutput.available
      ? structureOutput.hiddenRows > structureSource.hiddenRows
      : null,
  filtersAdded:
    structureSource.available && structureOutput.available
      ? structureOutput.autoFilters > structureSource.autoFilters
      : null,
  source: structureSource,
  output: structureOutput,
};

const formulaErrors = [];
for (let rowIndex = 0; rowIndex < outputValues.length; rowIndex += 1) {
  for (let column = 0; column < (outputValues[rowIndex] || []).length; column += 1) {
    const value = clean(outputValues[rowIndex][column]);
    if (/#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/.test(value)) {
      formulaErrors.push({ row: rowIndex + 1, column, value });
    }
  }
}

const report = {
  sourcePath,
  outputPath,
  sourceRowCount: sourceValues.length,
  outputRowCount: outputValues.length,
  sourceColumnCount: sourceHeaders.length,
  outputColumnCount: outputHeaders.length,
  headerOrderPreserved,
  newWriteCount: newWriteRows.length,
  newUidCount: newUidCounts.size,
  confirmedUnqualifiedCount: newWriteRows.filter((item) =>
    item.result.startsWith("不合格："),
  ).length,
  suspiciousCount: newWriteRows.filter((item) =>
    item.result.startsWith("疑似不合格："),
  ).length,
  qualifiedCount: newWriteRows.filter((item) => item.result === "合格").length,
  duplicateUids,
  historicalChanges,
  untouchedChanges,
  invalidRows,
  formulaErrors,
  structureChecks,
};
report.passed =
  report.sourceRowCount === report.outputRowCount &&
  report.headerOrderPreserved &&
  report.duplicateUids.length === 0 &&
  report.historicalChanges.length === 0 &&
  report.untouchedChanges.length === 0 &&
  report.invalidRows.length === 0 &&
  report.formulaErrors.length === 0 &&
  structureChecks.hiddenRowsAdded !== true &&
  structureChecks.filtersAdded !== true;

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) {
  throw new Error(`输出验收失败，详见 ${reportPath}`);
}
