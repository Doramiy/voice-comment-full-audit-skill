# Workbook Contract

## Dynamic headers

Find headers by normalized name and aliases. Common fields are:

```text
UID
NID
内容
状态
失败原因
评论ID
抽检结果
抽检人
URL / 资源链接 / 视频链接
复核链接
```

Never assume a fixed column letter. If a required identity or content field
cannot be found, stop and report the missing field.

## Eligibility

Exclude from the new review queue:

- rows whose status is `失败`;
- system placeholder transcripts such as `无法识别`, `识别失败`, `请说话`,
  or empty content;
- empty UID rows;
- rows outside the requested range;
- rows under a UID already closed by a confirmed historical failure.

Keep all source rows in the output. Exclusions stay unchanged.

## Historical results

- Preserve non-empty result and reviewer cells.
- An existing qualified row is historical context; inspect other valid rows for
  that UID.
- An existing confirmed-unqualified row closes the UID; do not add another
  result for it.
- An existing suspicious row remains eligible for re-evaluation.
- If a new result is needed for a UID with historical qualified data, select a
  blank evidence row. Never overwrite the historical cell.

## New writeback

For each newly selected UID, write exactly one new result row:

```text
confirmed_unqualified -> 不合格：<fixed reason>
suspicious             -> 疑似不合格：<reason>，需人工复核
qualified              -> 合格
```

Write the configured reviewer name. For multiple reviewers, assign new UIDs
as evenly as possible; preserve any historical names.

For suspicious rows, write the video resource URL to an existing `复核链接`
column or add that column at the end. Use the source URL or the NID fallback.
Never invent a comment-audio URL.

This is a hard UID-level invariant. Do not write the same new result to every
comment row for a UID. The only exception is a UID with a historical qualified
row: preserve that historical cell and use one different blank row for a newly
found result.

Do not fill `合格` into every untouched row. Qualified cells are written only
for explicit user-requested supplementation or an explicit all-results
writeback request.

## Workload target

All confirmed-unqualified UIDs are written regardless of the target. Suspect
UIDs may count toward the user's workload target but never toward confirmed
failure statistics. After the counts are reported, supplement qualified UIDs
only by the amount the user requests.

## Output preservation

- Export a new file, never overwrite the source.
- Preserve row order, original values, formulas, and formatting.
- Do not add filters or hidden rows.
- Keep a validation report outside the workbook.
