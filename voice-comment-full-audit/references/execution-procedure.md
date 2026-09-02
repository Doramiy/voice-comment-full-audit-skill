# Execution Procedure

This is the newcomer runbook. Keep the phase names and checkpoint files so a
paused task can resume without guessing.

## 1. Freeze and prepare

1. Copy or export the source into a task-specific snapshot. Never edit the
   source in place.
2. Create a directory such as:

```text
work/<task-id>/
  source/
  normalized/
  titles/
  first-frame/
  first-pass/
  advanced-pass/
  decisions/
  validation/
```

3. Store a manifest containing the absolute source path, file hash, sheet
   name, row range, reviewer names, and creation time.
4. Call `load_workspace_dependencies`. Link the returned bundled
   `node_modules` into the task directory and use the returned Node runtime.

## 2. Preflight the workbook

Run:

```text
node <skill>/scripts/preflight.mjs <source.xlsx> <task-dir> [start-row] [end-row]
```

The preflight must:

- detect headers by name and aliases;
- count total, in-range, failed, placeholder, empty-UID, and historical rows;
- construct a resource URL from NID only when the source URL is empty;
- keep every row's original Excel row number;
- identify existing qualified, suspicious, and confirmed-unqualified UIDs;
- produce normalized records and a review queue.

Stop for a user decision when required fields are missing or the requested
range cannot be resolved. Do not silently use a neighboring column.

## 3. Full title and page collection

For every review-queue record, collect the resource title or page state.
Deduplicate NIDs only while fetching the same page. Fan the result back to
every comment row that references that NID.

Record `success`, `empty`, `unavailable`, and `error` separately. A failed
title lookup is not a pass and not a failure. Keep it in the evidence queue.

## 4. First AI pass

Send all review-queue rows to semantic review in bounded batches. Every input
row must receive an output object. The first pass identifies:

- valid expression;
- obvious fixed-rule risk;
- suspected unrelated/read-back;
- suspected external voice;
- evidence-needed state.

Use the prompt in `references/agent-prompts.md`. Store one JSON result file
per batch and a coverage index.

## 5. Evidence collection

Every suspected unrelated/read-back item goes through the browser first-frame
procedure in `references/browser-first-frame.md`. Use the page URL from the
normalized record. Do not skip because title similarity is low or because the
tag lacks the expected keyword.

Only the evidence record, not a giant image or video payload, moves to the
next agent. Keep screenshots/contact sheets as task-local artifacts.

## 6. Advanced full-range pass

The advanced pass has two jobs:

1. **Evidence strengthening**: verify candidate reasons against title, frame,
   visible text, and early playback.
2. **Omission scanning**: independently rescan every first-pass valid row,
   including rows first labeled low risk.

A low-risk row is not exempt. The agent may upgrade it to a confirmed failure
or suspicion when new evidence supports that change. It may also correct an
unsupported first-pass label, but it must not preserve a failure solely to
increase the count.

Split work into disjoint batches. If agents disagree, send only the
disagreement records to a final adjudicator with both evidence packets.

## 7. UID merge

Merge decisions after the advanced pass:

```text
confirmed_unqualified > suspicious > qualified
```

For each UID choose one blank row with the clearest evidence and one primary
reason. If a historical qualified row must remain, use a different blank row
for a newly found failure. If a historical confirmed failure exists, do not
add another result for that UID.

## 8. Workload supplementation

Report confirmed and suspicious UID counts first. Only after the user says to
supplement, select already-reviewed qualified UIDs. Add exactly the requested
number unless fewer qualified UIDs remain; report a shortage instead of
inventing passes.

## 9. Write and validate

Run:

```text
node <skill>/scripts/merge-writeback.mjs <source.xlsx> <decisions.json> <output.xlsx> [reviewers]
node <skill>/scripts/validate-output.mjs <source.xlsx> <output.xlsx> <report.json>
```

Deliver the new workbook only after validation passes. Report row count,
confirmed failures, suspicions, qualified additions, duplicate UIDs,
historical-preservation status, and hidden-row/filter checks.
