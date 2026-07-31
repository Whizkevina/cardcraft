export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const escape = (val: unknown) => {
    const s = val == null ? "" : String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  return [headers.join(",")]
    .concat(rows.map(row => headers.map(h => escape(row[h])).join(",")))
    .join("\n");
}

export function sendCsv(res: { setHeader: (k: string, v: string) => void; send: (body: string) => void }, filenamePrefix: string, csv: string) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filenamePrefix}-${Date.now()}.csv"`);
  res.send(csv);
}
