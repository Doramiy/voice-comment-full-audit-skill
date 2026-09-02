import fs from "node:fs/promises";
import path from "node:path";

const [mergedArg, countArg, outputArg] = process.argv.slice(2);
if (!mergedArg || !countArg || !outputArg) {
  throw new Error(
    "用法：node select-supplement.mjs <merged.json> <count> <supplement.json>",
  );
}
const count = Number(countArg);
if (!Number.isInteger(count) || count < 0) {
  throw new Error(`补合格数量必须是非负整数：${countArg}`);
}
const merged = JSON.parse(await fs.readFile(path.resolve(mergedArg), "utf8"));
const candidates = Array.isArray(merged.qualifiedCandidates)
  ? merged.qualifiedCandidates
  : [];
if (candidates.length < count) {
  throw new Error(`可补合格 UID 只有 ${candidates.length} 个，少于要求的 ${count} 个`);
}
const selected = candidates
  .slice()
  .sort((a, b) => Number(a.row ?? a.excelRow) - Number(b.row ?? b.excelRow))
  .slice(0, count)
  .map((item) => ({
    ...item,
    decision: "qualified",
    reason: "",
    row: Number(item.row ?? item.excelRow),
    excelRow: Number(item.excelRow ?? item.row),
  }));
const output = {
  sourceMergedFile: path.resolve(mergedArg),
  requestedCount: count,
  selectedCount: selected.length,
  items: selected,
  generatedAt: new Date().toISOString(),
};
await fs.mkdir(path.dirname(path.resolve(outputArg)), { recursive: true });
await fs.writeFile(path.resolve(outputArg), JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  output: path.resolve(outputArg),
  requestedCount: count,
  selectedCount: selected.length,
}, null, 2));
