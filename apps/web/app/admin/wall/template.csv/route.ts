// The Wall spreadsheet admins fill in: header row + two examples. Nothing private in it.
import { csvFile, toCsv } from "@/lib/server/admin";
import { SHEET_COLUMNS, SHEET_EXAMPLES } from "@/lib/server/wall-sheet";

export const GET = () => csvFile("wall-template", toCsv(SHEET_COLUMNS, SHEET_EXAMPLES));
