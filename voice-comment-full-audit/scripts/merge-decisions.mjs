import fs from "node:fs/promises";
import path from "node:path";

import {
  FIXED_REASONS,
  FRAME_REQUIRED_REASONS,
  buildResourceUrl,
  clean,
  mergeUidDecisions,
  normalizeReason,
} from "./audit-logic.mjs";

const [normalizedArg, firstPassArg, advancedArg, outputArg] = process.argv.slice(2);
if (!normalizedArg || !firstPassArg || !advancedArg || !outputArg) {
  throw new Error(
    "用法：node merge-decisions.mjs <records.json> <first-pass.json> <advanced-pass.json> <merged.json>",
  );
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new Error("复核 JSON 必须是数组或包含 items 数组");
}

function normalizeDecision(raw) {
  const value = clean(raw);
  if (["qualified", "合格", "pass"].includes(value)) return "qualified";
  if (["confirmed_unqualified", "不合格", "unqualified"].includes(value)) {
    return "confirmed_unqualified";
  }
  if (["suspicious", "疑似", "疑似不合格"].includes(value)) return "suspicious";
  if (["needs_first_frame", "待首帧复核", "evidence_insufficient"].includes(value)) {
    return "needs_evidence";
  }
  throw new Error(`无法识别复核状态：${value}`);
}

const normalized = JSON.parse(await fs.readFile(path.resolve(normalizedArg), "utf8"));
const firstPass = itemsFrom(
  JSON.parse(await fs.readFile(path.resolve(firstPassArg), "utf8")),
);
const advancedPass = itemsFrom(
  JSON.parse(await fs.readFile(path.resolve(advancedArg), "utf8")),
);
const reviewQueue = normalized.reviewQueue || [];
const recordByRow = new Map(reviewQueue.map((item) => [Number(item.excelRow), item]));

function indexByRow(items, label) {
  const index = new Map();
  for (const item of items) {
    const row = Number(item.excelRow ?? item.row);
    if (!Number.isInteger(row) || !recordByRow.has(row)) {
      throw new Error(`${label} 中存在不属于 reviewQueue 的行：${row}`);
    }
    if (index.has(row)) throw new Error(`${label} 中行号重复：${row}`);
    index.set(row, item);
  }
  return index;
}

const firstByRow = indexByRow(firstPass, "first-pass");
const advancedByRow = indexByRow(advancedPass, "advanced-pass");
const expectedRows = new Set(reviewQueue.map((item) => Number(item.excelRow)));
for (const [label, index] of [["first-pass", firstByRow], ["advanced-pass", advancedByRow]]) {
  const missing = [...expectedRows].filter((row) => !index.has(row));
  const extra = [...index.keys()].filter((row) => !expectedRows.has(row));
  if (missing.length || extra.length) {
    throw new Error(
      `${label} 覆盖不完整：missing=${missing.join(",")} extra=${extra.join(",")}`,
    );
  }
}

const finalRows = [];
for (const row of [...expectedRows].sort((a, b) => a - b)) {
  const source = recordByRow.get(row);
  const advanced = advancedByRow.get(row);
  let decision = normalizeDecision(advanced.decision ?? advanced.status);
  const rawReason = normalizeReason(advanced.reason);
  if (decision === "needs_evidence") {
    // Unrelated/read-back evidence gaps are explicit passes. External voice
    // may remain a suspicion because the video URL is the human check path.
    decision = rawReason === FIXED_REASONS[2] ? "suspicious" : "qualified";
  }
  const normalizedReason = decision === "qualified" ? "" : rawReason;
  if (decision !== "qualified" && !normalizedReason) {
    throw new Error(`第 ${row} 行原因不在固定范围内`);
  }
  const resourceUrl = buildResourceUrl(
    source.nid,
    advanced.resourceUrl || advanced.url || source.resourceUrl,
  );
  const evidence = advanced.evidence || {};
  if (
    decision === "confirmed_unqualified" &&
    (
    FRAME_REQUIRED_REASONS.has(normalizedReason)
    ) &&
    !(
      clean(evidence.pageTitle) ||
      clean(evidence.firstFrameText) ||
      clean(evidence.firstFrameDescription) ||
      clean(evidence.earlyPlayback) ||
      clean(advanced.firstFrameDescription) ||
      clean(advanced.explanation)
    )
  ) {
    throw new Error(`第 ${row} 行的无关/照读结论缺少首帧或前几秒证据`);
  }
  if (decision === "suspicious" && !resourceUrl) {
    throw new Error(`第 ${row} 行疑似结果缺少视频资源链接`);
  }
  finalRows.push({
    ...source,
    ...advanced,
    row,
    excelRow: row,
    uid: clean(source.uid),
    decision,
    reason: normalizedReason,
    resourceUrl,
    firstPassDecision: normalizeDecision(firstByRow.get(row).decision ?? firstByRow.get(row).status),
    evidence,
  });
}

const uidDecisions = mergeUidDecisions(finalRows);
const writebackItems = uidDecisions.filter((item) =>
  item.decision === "confirmed_unqualified" || item.decision === "suspicious"
);
const qualifiedCandidates = uidDecisions.filter((item) => item.decision === "qualified");
const result = {
  sourceManifest: normalized.manifest || null,
  reviewQueueRowCount: reviewQueue.length,
  firstPassRowCount: firstPass.length,
  advancedPassRowCount: advancedPass.length,
  finalRowCount: finalRows.length,
  uidDecisionCount: uidDecisions.length,
  confirmedUnqualifiedUidCount: uidDecisions.filter(
    (item) => item.decision === "confirmed_unqualified",
  ).length,
  suspiciousUidCount: uidDecisions.filter((item) => item.decision === "suspicious").length,
  qualifiedCandidateUidCount: qualifiedCandidates.length,
  rowDecisions: finalRows,
  uidDecisions,
  writebackItems,
  qualifiedCandidates,
  generatedAt: new Date().toISOString(),
};

await fs.mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
await fs.writeFile(
  path.resolve(outputArg),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify({
  output: path.resolve(outputArg),
  reviewQueueRowCount: result.reviewQueueRowCount,
  uidDecisionCount: result.uidDecisionCount,
  confirmedUnqualifiedUidCount: result.confirmedUnqualifiedUidCount,
  suspiciousUidCount: result.suspiciousUidCount,
  qualifiedCandidateUidCount: result.qualifiedCandidateUidCount,
}, null, 2));
