const PLACEHOLDER_PATTERNS = [
  /^无法识别$/,
  /^无法识别语音内容$/,
  /^未识别语音内容$/,
  /^语音识别失败$/,
  /^识别失败$/,
  /^未检测到语音$/,
  /^无语音内容$/,
  /^请输入文本$/,
  /^请输入$/,
  /^请说话$/,
];

const DECISION_PRIORITY = new Map([
  ["qualified", 0],
  ["suspicious", 1],
  ["confirmed_unqualified", 2],
]);

export const FIXED_REASONS = [
  "评论内容与当前视频无关",
  "评论过于简单、缺乏有效信息",
  "播放外部声音代替本人评论",
  "使用AI语音、机器配音或其他非本人真实声音",
  "直接照读视频标题、字幕或视频原声",
  "有效语音不符合要求",
  "广告导流、辱骂低俗、恶意刷量或其他违规内容",
];

export const FRAME_REQUIRED_REASONS = new Set([
  FIXED_REASONS[0],
  FIXED_REASONS[4],
]);

export function normalizeReason(reason) {
  const text = clean(reason).replace(/^不合格[：:]\s*/, "");
  if (FIXED_REASONS.includes(text)) return text;
  if (/无关|不匹配/.test(text)) return FIXED_REASONS[0];
  if (/简单|信息量|缺乏有效信息/.test(text)) return FIXED_REASONS[1];
  if (/外部声音|旁白|新闻播报|短剧对白|连续歌词/.test(text)) return FIXED_REASONS[2];
  if (/AI语音|机器配音|合成音|非本人真实声音/.test(text)) return FIXED_REASONS[3];
  if (/照读|复述标题|复述字幕|复述原声/.test(text)) return FIXED_REASONS[4];
  if (/时长|无声|听不清|有效语音/.test(text)) return FIXED_REASONS[5];
  if (/广告|导流|辱骂|低俗|刷量|乱码|测试|打卡/.test(text)) return FIXED_REASONS[6];
  return "";
}

export function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function isPlaceholderContent(content) {
  const text = clean(content);
  return !text || PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyExistingResult(result) {
  const text = clean(result);
  if (!text) return "none";
  if (/^疑似不合格/.test(text)) return "suspicious";
  if (/^不合格/.test(text)) return "confirmed_unqualified";
  if (/^(合格|通过)$/.test(text)) return "qualified";
  return "other";
}

export function buildResourceUrl(nid, existingUrl = "") {
  const url = clean(existingUrl);
  if (url) return url;
  const resourceId = clean(nid);
  return resourceId
    ? `https://mbd.baidu.com/newspage/data/videolanding?nid=${encodeURIComponent(resourceId)}`
    : "";
}

export function buildReviewPlan(records) {
  const sorted = [...records].sort((a, b) => Number(a.row) - Number(b.row));
  const stoppedUids = new Set();
  const seenQualifiedUids = new Set();
  const plan = [];

  for (const record of sorted) {
    const row = Number(record.row);
    const uid = clean(record.uid);
    const existingState = classifyExistingResult(record.existingResult);

    if (record.status && clean(record.status) !== "成功") {
      continue;
    }
    if (!uid || isPlaceholderContent(record.content)) {
      continue;
    }
    if (stoppedUids.has(uid)) {
      continue;
    }
    if (existingState === "confirmed_unqualified") {
      stoppedUids.add(uid);
      continue;
    }

    if (existingState === "qualified") {
      seenQualifiedUids.add(uid);
      plan.push({ ...record, row, uid, action: "preserve-existing-qualified" });
      continue;
    }

    plan.push({
      ...record,
      row,
      uid,
      action: existingState === "suspicious" ? "review-existing-suspicion" : "review",
    });
  }

  return plan;
}

export function mergeUidDecisions(decisions) {
  const bestByUid = new Map();

  for (const decision of decisions) {
    const uid = clean(decision.uid);
    if (!uid) continue;
    const current = bestByUid.get(uid);
    const nextPriority = DECISION_PRIORITY.get(decision.decision) ?? -1;
    const currentPriority = current
      ? DECISION_PRIORITY.get(current.decision) ?? -1
      : -1;
    if (
      !current ||
      nextPriority > currentPriority ||
      (nextPriority === currentPriority && Number(decision.row) < Number(current.row))
    ) {
      bestByUid.set(uid, { ...decision, uid, row: Number(decision.row) });
    }
  }

  return [...bestByUid.values()].sort((a, b) => a.row - b.row);
}

export function supplementToMinimum(decisions, qualifiedCandidates, targetCount) {
  const merged = mergeUidDecisions(decisions);
  const target = Number(targetCount);
  if (!Number.isFinite(target) || target <= merged.length) {
    return merged;
  }

  const existingUids = new Set(merged.map((item) => clean(item.uid)));
  const additions = [];
  for (const candidate of [...qualifiedCandidates].sort(
    (a, b) => Number(a.row) - Number(b.row),
  )) {
    const uid = clean(candidate.uid);
    if (!uid || existingUids.has(uid)) continue;
    additions.push({ ...candidate, uid, decision: "qualified" });
    existingUids.add(uid);
    if (merged.length + additions.length >= target) break;
  }
  return [...merged, ...additions].sort((a, b) => Number(a.row) - Number(b.row));
}

export function assignReviewers(items, reviewers) {
  const names = reviewers.map(clean).filter(Boolean);
  if (!names.length) throw new Error("至少需要一个抽检人");
  return items.map((item, index) => ({
    ...item,
    reviewer: names[index % names.length],
  }));
}
