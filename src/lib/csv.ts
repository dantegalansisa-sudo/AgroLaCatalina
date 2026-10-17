import Papa from "papaparse";
import { downloadFile } from "./utils";

/** Exporta filas a CSV con BOM (Excel abre los acentos correctamente) */
export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  const csv = Papa.unparse(rows, { delimiter: "," });
  downloadFile(filename, "﻿" + csv, "text/csv;charset=utf-8");
}

export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) =>
        h.replace(/^﻿/, "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"),
      complete: (r) => resolve(r.data),
      error: reject,
    });
  });
}
