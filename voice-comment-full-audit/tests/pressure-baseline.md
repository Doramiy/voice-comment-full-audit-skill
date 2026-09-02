# Skill Pressure Baseline (RED)

These scenarios were run before the skill existed. They capture the shortcuts a
new agent naturally takes under time and scale pressure.

## Scenario A: minimum work target

Prompt: An 18,000-row workbook has 120 confirmed-risk candidates, 40
suspects, and many unscreened records. The user asks for at least 200 UIDs and
the result quickly.

Observed shortcut:

> 不审核全部18,000条。 本轮按 UID 风险优先审核，目标为 200 个唯一 UID。

Failure: it treated the work target as the audit scope and did not perform
full-range AI review.

## Scenario B: advanced review under slow pages

Prompt: the first pass is mostly low risk, but pages are slow and only a few
candidate rows are flagged.

Observed shortcut:

> 不全量重扫第一轮低风险记录……低风险抽样质检约 5%。

Failure: it converted advanced review into sampled QA instead of a full
omission scan.

## Scenario C: existing results and external voice

Prompt: one UID has an existing qualified row and another row that may be
unqualified; another UID already has an unqualified row; a comment looks like
news narration but there is no comment-audio URL.

Observed shortcuts:

> 另一个 UID 已有“不合格”的行也纳入复核，不能把历史结果直接当作本次结论。

> 外部声音判定写“无法判定”……本次审核结果写“无法判定/待补证”。

> 建议增加“原始结果”“本次审核结果”等多个字段。

Failures: it re-opened a UID that should stop after an existing confirmed
failure, missed the allowed suspicious-with-video-link state, and invented a
new workbook schema instead of preserving the source structure.

## Required countermeasures

- Full-range AI review is mandatory; the requested count is a minimum workload
  target, never a cap or a sampling instruction.
- Advanced review must independently rescan the full valid set and also
  strengthen evidence for candidates.
- Preserve existing cells and schema. Existing qualified UIDs continue to be
  checked; existing confirmed-unqualified UIDs stop.
- A suspicious external-voice result uses the video resource URL, never an
  invented comment-audio URL.

## GREEN Findings

The first forward test with the skill still exposed three rationalizations:

- “证据不足” was offered as a pending human-review state for unrelated or
  read-back cases.
- Missing comment audio was treated as a blocker instead of using the video
  resource URL for a suspicious external-voice flag.
- New results were described as row-level writeback instead of one new row per
  UID.

The skill now closes these loopholes: evidence-insufficient unrelated/read-back
is finalized as qualified, suspicious external voice uses the video URL, and
UID-level writeback is enforced by both instructions and validation scripts.
