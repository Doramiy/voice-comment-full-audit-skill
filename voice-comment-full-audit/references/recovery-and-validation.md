# Recovery and Validation

## Checkpoint files

Keep these task-local artifacts:

```text
manifest.json
normalized/records.json
titles/*.json
first-frame/*.json
first-pass/*.json
advanced-pass/*.json
decisions/merged.json
decisions/supplement.json
validation/report.json
```

Each batch result must include the source hash, task ID, phase, batch number,
row IDs, and timestamp. A result from a different source hash, range, reviewer
set, or task ID is not reusable.

## Resume behavior

1. Read the manifest before resuming.
2. Verify the source hash and requested range.
3. Reuse only complete batch files that match the manifest.
4. Re-run incomplete or corrupt batches.
5. Never append duplicate decisions after a reconnect.

## Memory and browser safety

- Keep one workbook import/export process active at a time.
- Batch JSON records by context size, not by a hard-coded row count.
- Use small agent batches and bounded browser concurrency.
- Release page handles and large image buffers after each batch.
- Prefer compact evidence descriptions over embedding full videos in prompts.
- Write checkpoints atomically.

## Final validation

The output is deliverable only when all applicable checks pass:

- source and output row counts match;
- original source fields are unchanged;
- historical result and reviewer cells are unchanged;
- every new result row maps to a source row and UID;
- each new UID has at most one new result;
- evidence-insufficient unrelated/read-back rows are finalized as qualified,
  not pending;
- all confirmed failures are present;
- suspicious rows have a video resource URL;
- suspicious rows are not counted as confirmed failures;
- fixed reason strings are valid;
- reviewer names are valid and balanced when multiple names were configured;
- no formula errors were introduced;
- no extra hidden rows or filters were introduced;
- output is a new file and the source remains untouched.

Report at least:

```text
审核范围有效记录数
第一轮覆盖数
高级复核覆盖数
确认不合格 UID 数
疑似 UID 数
补充合格 UID 数
重复 UID 数
历史结果改动数
隐藏行/筛选异常数
```

## GitHub safety

The skill repository may contain rules, scripts, schemas, and synthetic
fixtures. It must not contain real workbooks, raw UID/comment exports,
internal resource URLs, screenshots, downloaded videos, cookies, tokens, or
task checkpoints from a live audit.
