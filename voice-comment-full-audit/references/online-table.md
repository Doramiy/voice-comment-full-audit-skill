# Online Table Procedure

Use this procedure when the user provides a `ku.baidu-int.com` table or says
the source is an online table.

## Routing

Load `ku-doc-manage` and follow its supported table operations. Do not assume
that a table being open in Safari is an available API or a safe write channel.
For table data, use the supported export/import path:

```text
online table -> export-sheet -> local .xlsx snapshot -> audit -> new .xlsx
```

Use the browser skill only for the linked video resource pages, not as a
replacement for the table connector.

## Read and audit

1. Resolve the table URL and identify the table/document.
2. Export the complete relevant view, preserving the source snapshot.
3. Record the online URL, export timestamp, sheet/view name, and source hash
   in the task manifest.
4. Run the same full-range workbook procedure as for a local `.xlsx`.

## Write back

When the user asks for an online update:

1. Finish local writeback and validation first.
2. Show the counts and output path.
3. Confirm the destination table and intended update scope if the connector
   requires a separate write operation.
4. Import/update only the validated result file through `ku-doc-manage`.
5. Preserve the local validated `.xlsx` as the rollback/audit artifact.

If export or import is unsupported, report the exact unsupported operation.
Do not fall back to guessing UI selectors, hidden columns, or an unrelated
browser tab.
