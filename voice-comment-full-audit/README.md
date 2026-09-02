# voice-comment-full-audit

This skill gives Codex a repeatable, full-range workflow for Chinese voice
comment activity audits. It is designed for local `.xlsx` files and for
tables exported from the company's online knowledge platform.

## Install

Copy the directory `voice-comment-full-audit` into the active Codex skills
directory:

```text
$CODEX_HOME/skills/voice-comment-full-audit
```

When `CODEX_HOME` is unset, use `~/.codex/skills`.

The skill does not ship real workbooks, user IDs, comments, internal URLs, or
captured frames. It relies on Codex's bundled spreadsheet and browser skills.

## Use

Ask Codex naturally, for example:

```text
用 voice-comment-full-audit 审核 /path/to/comments.xlsx，审核 4350 行以后，
抽检人写王霞、卢静、赵佰川，保留原有结果。
```

The skill will:

1. confirm only missing task details;
2. audit every valid row in the requested range;
3. collect titles, enrich evidence, and run the advanced omission scan;
4. preserve historical results and write one new result per UID;
5. report confirmed and suspicious counts separately;
6. ask whether qualified UIDs should be added and how many;
7. export and validate a new workbook.

## Script setup

Before running a script, call `load_workspace_dependencies`. In a writable
task directory, create a `node_modules` symlink to the returned bundled
dependency directory and use its bundled Node executable. The scripts fail
with a clear message when the spreadsheet runtime is not available.

```text
node scripts/preflight.mjs <input.xlsx> <task-dir> [start-row] [end-row]
node scripts/merge-decisions.mjs <records.json> <first-pass.json> <advanced-pass.json> <merged.json>
node scripts/select-supplement.mjs <merged.json> <count> <supplement.json>
node scripts/merge-writeback.mjs <input.xlsx> <decisions.json> <output.xlsx> [reviewers]
node scripts/validate-output.mjs <input.xlsx> <output.xlsx> [report.json]
```

The AI review itself remains in Codex's agent workflow. The scripts handle
deterministic normalization, UID merging, workbook writing, and validation.
For `ku.baidu-int.com` tables, follow `references/online-table.md` and the
`ku-doc-manage` skill for export/import instead of assuming Safari UI state.
