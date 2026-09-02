---
name: voice-comment-full-audit
description: Use when auditing Chinese voice-comment activity data in Excel workbooks or online tables, especially when the task requires full-range AI review, video-title lookup, first-frame verification, advanced omission scanning, suspicious external-voice tagging, UID-level writeback, or qualified supplementation.
---

# Voice Comment Full Audit

## Core Contract

Run a full-range AI audit over every valid record in the user-specified range.
The requested count, such as `至少 200 个 UID`, is a minimum workload target,
never a sampling scope or a cap on confirmed failures.

This skill must:

- inspect every valid voice-comment row, including every row for a UID;
- collect video titles and resource-page evidence before final decisions;
- use first-frame or early-play evidence for suspected unrelated/read-back cases;
- run an independent advanced pass that strengthens evidence and scans for
  omissions from the first pass;
- write one new result per UID while preserving historical cells;
- report confirmed failures and suspicions separately, then supplement with
  qualified UIDs only when the user asks for more workload;
- leave a reproducible evidence trail and validate the exported workbook.

Use batching and bounded concurrency for stability, never to reduce coverage.

## Guided Start

Do not ask the user to choose “sample” versus “full”: full AI coverage is the
default. Ask only for information that is genuinely missing:

1. source workbook or online table;
2. row range, if the request does not already identify it;
3. reviewer name(s) and whether the output is one file or several;
4. explicit output naming or destination, if needed.

Preserve existing results by default. After the audit, report:

```text
确认不合格：X 个 UID
疑似：Y 个 UID
```

Then ask whether to supplement qualified UIDs and how many. Use
`references/guided-intake.md` for the exact interaction.

## Required Run

1. Freeze the source snapshot and create a unique task directory.
2. Preflight the workbook with dynamic header detection. Never assume URL is
   column L or results are columns J/K.
3. Exclude failed rows, system placeholder transcripts, empty UIDs, and rows
   already covered by a confirmed historical failure. Keep a count of every
   exclusion.
4. Review every remaining valid row in the first AI pass.
5. Deduplicate NIDs only for title/page collection; do not deduplicate away
   comment rows during auditing.
6. Send every first-pass result through the advanced full-range omission scan.
   Candidates receive deeper evidence collection; low-risk rows are still
   independently rescanned.
7. For suspected unrelated/read-back cases, open the resource page and
   inspect the first frame. Continue into the first few seconds only when the
   frame is blurry or the evidence depends on later content.
8. Reconcile disagreements. Evidence-insufficient unrelated/read-back cases
   are final `qualified` results, never a pending state; an external-voice
   case may be marked suspicious with its video resource URL.
9. Merge new decisions at UID level: confirmed unqualified > suspicious >
   qualified. Select the clearest row and one primary reason.
10. Mark every confirmed-unqualified UID regardless of the workload target.
    Supplement qualified UIDs only after the user approves the amount.
11. Write back to a new workbook, preserving source order, formatting,
    historical results, and source fields.
12. Reopen and validate the output before claiming completion.

## Decision States

| State | Meaning | Final treatment |
|---|---|---|
| `qualified` | Valid expression or no supported violation | Write `合格` only for requested supplementation or explicit all-results output |
| `confirmed_unqualified` | Fixed reason has direct, sufficient evidence | Always write `不合格：原因` |
| `suspicious` | Worth human checking but not enough to confirm | Write `疑似不合格：原因，需人工复核` and a video resource URL; never count as confirmed failure |

Short, colloquial, repeated, emotional, praising, or question-form speech is
not automatically bad. Specific praise, useful questions, independent
judgment, tribute, explanation, criticism, and empathy remain valid even when
the comment repeats part or all of a title.

## Non-Negotiable Evidence Rules

- `评论内容与当前视频无关` and `直接照读视频标题、字幕或视频原声`
  require first-frame or early-play evidence.
- A title mismatch, low text similarity, missing tag keyword, or transcript
  style alone cannot prove either category.
- An inaccessible page, unusable frame, or unresolved evidence cannot produce
  a confirmed unrelated/read-back result.
- Text that resembles news, narration, lyrics, or dialogue may be
  suspicious external voice, but without direct audio evidence it is not a
  confirmed external-voice failure.
- Do not invent a comment-audio URL. Use the original video resource URL or
  construct it from NID.
- Do not use duration alone; the default skill ignores the voice-duration
  rule unless a new conversation explicitly enables it.

## Historical Results

Keep existing result and reviewer cells unless the new conversation explicitly
orders a change. An existing qualified row does not close the UID: review its
other valid rows. An existing confirmed-unqualified row closes that UID:
preserve it and do not inspect its remaining rows. An existing suspicious row
continues through review. If a historical qualified row and a new
unqualified row coexist, preserve the historical row and write the new result
on the clearest blank evidence row.

## Red Flags

These shortcuts violate the contract:

| Shortcut | Required correction |
|---|---|
| “只看风险候选，低风险抽 5%” | Advanced review independently scans every valid first-pass row |
| “标题不匹配，所以无关” | Open the resource page and use frame/early-play evidence |
| “证据不足，先待人工复核” for unrelated/read-back | Finalize as `合格`; only allowed suspicion is the external-voice state |
| “没有评论音频链接，不能标疑似” | Use `疑似不合格` plus the video resource URL; never invent an audio URL |
| “按每条记录写回更清楚” | New decisions are one row per UID; only the historical-qualified exception may add another row |
| “K 到了就停止” | Mark every confirmed-unqualified UID; K only controls later qualified supplementation |

## Resources

- `references/guided-intake.md`: minimal user guide and state transitions.
- `references/execution-procedure.md`: newcomer runbook and checkpoints.
- `references/judgment-rules.md`: fixed reasons, exceptions, and examples.
- `references/agent-prompts.md`: prompts and JSON contracts for each pass.
- `references/browser-first-frame.md`: page, frame, and playback handling.
- `references/workbook-contract.md`: headers, UID merge, writeback rules.
- `references/recovery-and-validation.md`: resume, memory, and export checks.
- `references/online-table.md`: online-table export, audit, and import path.

Use the bundled scripts for deterministic workbook operations:

```text
scripts/audit-logic.mjs
scripts/preflight.mjs
scripts/merge-decisions.mjs
scripts/select-supplement.mjs
scripts/merge-writeback.mjs
scripts/validate-output.mjs
```

Call `load_workspace_dependencies` first, link its bundled `node_modules`
directory into the task directory, and use the returned bundled Node runtime.
For online tables use `ku-doc-manage`; for resource pages use the browser
skill; for `.xlsx` import/export use the spreadsheet skill.
