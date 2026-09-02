# Guided Intake

The guide should feel like a short operational handoff, not a configuration
form. Infer anything explicit in the user's request and ask only for missing
items.

## Fixed defaults

- Audit coverage is full over the user-specified valid range.
- The workload target is not an audit cap.
- Historical results and reviewer names are preserved.
- Same-UID rows are all audited unless a confirmed historical failure closes
  that UID.
- One new result row is written per UID.
- Voice duration is ignored by default.
- The output is a new file unless the user explicitly requests online
  writeback.

## Ask only when missing

Use this order:

1. **Source**: identify the workbook path or online table.
2. **Range**: use the stated range; otherwise ask whether to use the whole
   table.
3. **Reviewer(s)**: use names already provided; otherwise ask for the name or
   names to write.
4. **Output shape**: default to one file; ask only when multiple files or an
   online table update is plausibly intended.

Do not ask whether the task is “fixed sampling” or “full sampling.” The AI
review is full-range. If the user says “至少 N 个”, record N as a minimum
workload target and continue auditing the whole range.

## Confirmation before work

Reply with one compact restatement:

```text
我将审核【范围】内全部有效记录；同一 UID 的有效评论全部检查，
最终每个 UID 本次只写一条结果；原有结果保留。
完成后我会分别汇报确认不合格和疑似数量，再问是否补合格及补多少。
抽检人：【姓名】；输出：【一个文件/多个文件】。
```

If the source, range, or reviewer is unambiguous, do not ask the user to
repeat it.

## Post-audit question

After advanced review and UID merge, report only the counts needed for the
next decision:

```text
确认不合格：X 个 UID
疑似：Y 个 UID
目前已形成结果：X+Y 个 UID
是否补充合格？需要补多少个 UID？
```

If the user gives a minimum target, calculate the shortfall, but still state
the two risk counts separately. Confirmed failures and suspicions already
above the target are never removed.
