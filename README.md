# Voice Comment Full Audit Skill

Reusable Codex skill for auditing Chinese voice-comment activity data in local
Excel workbooks or exported online tables.

## Contents

- `voice-comment-full-audit/`: the installable skill package

The package contains the guided intake, full-range review workflow, judgment
rules, first-frame evidence requirements, online-table instructions, workbook
writeback scripts, and validation tests. It does not contain real workbooks,
internal URLs, user IDs, or captured media.

## Install

Copy `voice-comment-full-audit` into the active Codex skills directory:

```text
$CODEX_HOME/skills/voice-comment-full-audit
```

If `CODEX_HOME` is not set, use `~/.codex/skills/voice-comment-full-audit`.

## Use

Ask Codex to use `voice-comment-full-audit` with the source workbook or online
table and any range, reviewer, or output requirements. The skill first asks
only for missing task details, then audits every valid record in the requested
range, collects page and first-frame evidence where required, runs the
advanced omission scan, preserves historical results, and validates a new
output workbook.

The requested number is a minimum workload target, not an audit cap. Confirmed
unqualified UIDs are always retained; suspicious UIDs are tracked separately
and never counted as confirmed failures.

## Verify

```bash
cd voice-comment-full-audit
npm test
```
