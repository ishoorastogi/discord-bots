const path = require("node:path");
const { parse } = require("csv-parse/sync");
const ExcelJS = require("exceljs");

const SUPPORTED_EXTENSIONS = new Set([".csv", ".xlsx", ".xslx"]);

function isSupportedFile(fileName) {
    return SUPPORTED_EXTENSIONS.has(path.extname(fileName || "").toLowerCase());
}

function isEmpty(value) {
    return value === null || value === undefined ||
        (typeof value === "string" && value.trim() === "");
}

function normalizeHeader(value) {
    return String(value).trim().toLowerCase().replace(/[_\W]+/g, " ").trim();
}

function validateTable(records, sheet, errors, schema) {
    const nonempty = records.filter(({ values }) => !values.every(isEmpty));
    if (!nonempty.length) {
        return null;
    }

    const [header, ...data] = nonempty;
    const aliases = new Map(schema.flatMap(column =>
        [column.name, ...(column.aliases || [])].map(name => [normalizeHeader(name), column.name])
    ));
    const headers = header.values.map(value => {
        const name = String(value ?? "").trim();
        return aliases.get(normalizeHeader(name)) || name;
    });
    const seen = new Set();
    headers.forEach((name, index) => {
        if (!name || seen.has(name)) {
            errors.push({
                sheet,
                line: header.line,
                endLine: header.endLine,
                column: index + 1,
                message: !name ? "Column header is empty." : `Duplicate column header: ${name}.`,
            });
        }
        seen.add(name);
    });

    for (const column of schema) {
        if (column.required !== false && !headers.includes(column.name)) {
            errors.push({
                sheet, line: header.line, endLine: header.endLine,
                message: `Missing required column: ${column.name}.`,
            });
        }
    }

    const rows = [];
    for (const record of data) {
        if (record.values.length !== headers.length) {
            errors.push({
                sheet,
                line: record.line,
                endLine: record.endLine,
                message: `Expected ${headers.length} columns, found ${record.values.length}.`,
            });
            continue;
        }
        const data = Object.fromEntries(headers.map((name, index) => [name, record.values[index]]));
        for (const column of schema) {
            const index = headers.indexOf(column.name);
            if (index === -1) {
                if (column.defaultValue) {
                    data[column.name] = column.defaultValue();
                }
                continue;
            }
            const message = column.validate?.(data[column.name]);
            if (message) {
                errors.push({
                    sheet, line: record.line, endLine: record.endLine,
                    column: index + 1, message,
                });
            } else if (column.normalize) {
                data[column.name] = column.normalize(data[column.name]);
            }
        }
        rows.push({
            line: record.line,
            endLine: record.endLine,
            data,
        });
    }

    if (!data.length) {
        errors.push({ sheet, line: header.line, message: "Header has no data rows." });
    }

    return { name: sheet, headers, rows };
}

function parseCsv(buffer, errors, schema) {
    let text;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
        errors.push({ message: "CSV is not valid UTF-8 text. Save the file as UTF-8 CSV." });
        return [];
    }

    const records = [];
    let previousEndLine = 0;
    try {
        parse(text, {
            bom: true,
            raw: true,
            relax_column_count: true,
            on_record({ record, raw }) {
                const body = raw.replace(/(?:\r\n|\r|\n)$/, "");
                const internalNewlines = (body.match(/\r\n|\r|\n/g) || []).length;
                const line = previousEndLine + 1;
                const endLine = line + internalNewlines;
                records.push({
                    values: record,
                    line,
                    endLine,
                });
                previousEndLine = endLine;
                return null;
            },
        });
    } catch (error) {
        const messages = {
            CSV_QUOTE_NOT_CLOSED: "Quoted field is not closed; subsequent rows cannot be parsed reliably.",
            CSV_INVALID_CLOSING_QUOTE: "Invalid closing quote. Parsing stopped at this record.",
            INVALID_OPENING_QUOTE: "Unexpected quote in an unquoted field. Parsing stopped at this record.",
        };
        errors.push({
            line: previousEndLine + 1,
            endLine: previousEndLine + 1 + ((error.raw || "").match(/\r\n|\r|\n/g) || []).length,
            column: typeof error.column === "number" ? error.column + 1 : undefined,
            message: messages[error.code] || `Invalid CSV (${error.code || "parse error"}). Parsing stopped at this record.`,
        });
    }

    const table = validateTable(records, null, errors, schema);
    return table ? [table] : [];
}

function cellValue(cell, sheet, errors) {
    let value = cell.value;
    if (value && typeof value === "object" &&
        ("formula" in value || "sharedFormula" in value)) {
        if (value.result === undefined) {
            errors.push({
                sheet, line: cell.row, column: cell.col,
                message: `Cell ${cell.address} has a formula without a saved result. Recalculate and save the workbook.`,
            });
        }
        value = value.result;
    }
    if (value && typeof value === "object") {
        if (value.error) {
            errors.push({
                sheet, line: cell.row, column: cell.col,
                message: `Cell ${cell.address} contains Excel error ${value.error}.`,
            });
            return null;
        }
        if (value.richText) {
            return value.richText.map(part => part.text).join("");
        }
        if (value.hyperlink) {
            return value.text ?? value.hyperlink;
        }
    }
    return value ?? null;
}

async function parseXlsx(buffer, errors, schema) {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    } catch {
        errors.push({ message: "Cannot read this XLSX workbook. It may be corrupt, encrypted, or not an XLSX file; no row number is available." });
        return [];
    }

    const tables = [];
    workbook.eachSheet(worksheet => {
        const records = [];
        let width;
        worksheet.eachRow(row => {
            const populated = [];
            row.eachCell(cell => {
                const value = cellValue(cell, worksheet.name, errors);
                if (!isEmpty(value) || cell.type === ExcelJS.ValueType.Error || cell.type === ExcelJS.ValueType.Formula) {
                    populated.push({ column: cell.col, value });
                }
            });
            if (!populated.length) {
                return;
            }
            const lastColumn = Math.max(...populated.map(cell => cell.column));
            width ??= lastColumn;
            // Missing trailing cells are normal in XLSX; extra cells beyond the header are not.
            const values = Array(Math.max(width, lastColumn)).fill(null);
            for (const cell of populated) {
                values[cell.column - 1] = cell.value;
            }
            records.push({ line: row.number, endLine: row.number, values });
        });
        const table = validateTable(records, worksheet.name, errors, schema);
        if (table) {
            tables.push(table);
        }
    });
    return tables;
}

/**
 * Parse a UTF-8 CSV or XLSX buffer. The first nonempty row contains headers.
 * Errors retain physical CSV line ranges or worksheet names and row numbers.
 * An optional schema declares expected headers, aliases, and value validators.
 * Without a schema this checks file structure only.
 */
async function parseFile(buffer, fileName, { schema = [] } = {}) {
    const errors = [];
    let sheets = [];
    if (!isSupportedFile(fileName)) {
        errors.push({ message: "Unsupported file type. Upload a .csv or .xlsx file." });
    } else if (!buffer.length) {
        errors.push({ message: "File is empty." });
    } else {
        sheets = path.extname(fileName).toLowerCase() === ".csv" ?
            parseCsv(buffer, errors, schema) : await parseXlsx(buffer, errors, schema);
        if (!sheets.length && !errors.length) {
            errors.push({ message: "File contains no header or data rows." });
        }
    }
    return {
        ok: errors.length === 0,
        sheets,
        rowCount: sheets.reduce((count, sheet) => count + sheet.rows.length, 0),
        errors,
    };
}

module.exports = { parseFile, isSupportedFile };
