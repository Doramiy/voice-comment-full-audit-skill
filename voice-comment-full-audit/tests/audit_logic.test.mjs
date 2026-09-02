import test from "node:test";
import assert from "node:assert/strict";

import {
  assignReviewers,
  buildResourceUrl,
  buildReviewPlan,
  mergeUidDecisions,
  supplementToMinimum,
} from "../scripts/audit-logic.mjs";

const RISK_REASONS = {
  unrelated: "评论内容与当前视频无关",
  readback: "直接照读视频标题、字幕或视频原声",
};

test("reviews every valid row but stops after an existing confirmed failure for that UID", () => {
  const records = [
    { row: 2, uid: "u1", status: "成功", content: "第一条", existingResult: "合格" },
    { row: 3, uid: "u1", status: "成功", content: "第二条", existingResult: "" },
    { row: 4, uid: "u2", status: "成功", content: "已有问题", existingResult: "不合格：旧原因" },
    { row: 5, uid: "u2", status: "成功", content: "不再处理", existingResult: "" },
    { row: 6, uid: "u3", status: "失败", content: "有效文本", existingResult: "" },
    { row: 7, uid: "", status: "成功", content: "没有 UID", existingResult: "" },
  ];

  assert.deepEqual(
    buildReviewPlan(records).map((item) => item.row),
    [2, 3],
  );
});

test("uses an existing URL and falls back to the NID resource URL", () => {
  assert.equal(
    buildResourceUrl("sv_123", "https://example.test/video"),
    "https://example.test/video",
  );
  assert.equal(
    buildResourceUrl("sv_123", ""),
    "https://mbd.baidu.com/newspage/data/videolanding?nid=sv_123",
  );
});

test("keeps one strongest new decision per UID", () => {
  const decisions = [
    { row: 10, uid: "u1", decision: "qualified" },
    { row: 11, uid: "u1", decision: "suspicious", reason: "疑似外部声音" },
    { row: 12, uid: "u1", decision: "confirmed_unqualified", reason: RISK_REASONS.readback },
    { row: 13, uid: "u2", decision: "suspicious", reason: "疑似外部声音" },
    { row: 14, uid: "u2", decision: "qualified" },
  ];

  assert.deepEqual(
    mergeUidDecisions(decisions).map(({ row, uid, decision }) => ({ row, uid, decision })),
    [
      { row: 12, uid: "u1", decision: "confirmed_unqualified" },
      { row: 13, uid: "u2", decision: "suspicious" },
    ],
  );
});

test("treats the requested count as a minimum and never drops risks", () => {
  const decisions = [
    { row: 1, uid: "bad-1", decision: "confirmed_unqualified", reason: RISK_REASONS.unrelated },
    { row: 2, uid: "bad-2", decision: "confirmed_unqualified", reason: RISK_REASONS.readback },
    { row: 3, uid: "sus-1", decision: "suspicious", reason: "疑似外部声音", resourceUrl: "https://example.test/1" },
  ];
  const qualified = [
    { row: 4, uid: "ok-1", decision: "qualified" },
    { row: 5, uid: "ok-2", decision: "qualified" },
  ];

  assert.deepEqual(
    supplementToMinimum(decisions, qualified, 4).map((item) => item.uid),
    ["bad-1", "bad-2", "sus-1", "ok-1"],
  );
  assert.equal(supplementToMinimum(decisions, qualified, 2).length, 3);
});

test("assigns multiple reviewers with a spread of at most one", () => {
  const assigned = assignReviewers(
    Array.from({ length: 10 }, (_, index) => ({ uid: `u${index}` })),
    ["王霞", "卢静", "赵佰川"],
  );
  const counts = Object.values(
    Object.groupBy(assigned, (item) => item.reviewer),
  ).map((items) => items.length);
  assert.equal(Math.max(...counts) - Math.min(...counts), 1);
});
