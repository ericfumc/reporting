/**
 * Pathology Report Templates — sync bridge
 * Deploy: Deploy > New deployment > Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * Then set window.TEMPLATE_SYNC_URL in the formatter to the web app URL.
 */
var SPREADSHEET_ID = '1312knnJayUkaTBgVsTXa5Wi8hcKOzP9amgOFLn2ssP0';
var SHEET_NAME = 'Sheet1';

function doGet(e) {
  return jsonOut({ ok: true, service: 'report-template-sync', spreadsheetId: SPREADSHEET_ID });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'Missing body' }, 400);
    }
    var payload = JSON.parse(e.postData.contents);
    if (payload.spreadsheetId && payload.spreadsheetId !== SPREADSHEET_ID) {
      return jsonOut({ ok: false, error: 'spreadsheetId mismatch' }, 400);
    }
    if (!payload.rows || !payload.rows.length) {
      return jsonOut({ ok: false, error: 'rows required' }, 400);
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(payload.sheet || SHEET_NAME) || ss.getSheets()[0];
    var rows = payload.rows;
    var width = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i].length > width) width = rows[i].length;
    }
    if (width < 4) width = 4;

    // Normalize rows to equal width
    var normalized = rows.map(function (r) {
      var out = [];
      for (var c = 0; c < width; c++) {
        var v = (r && r[c] != null) ? String(r[c]) : '';
        out.push(v);
      }
      return out;
    });

    var lastRow = Math.max(sheet.getLastRow(), 1);
    var lastCol = Math.max(sheet.getLastColumn(), width);
    sheet.clearContents();
    sheet.getRange(1, 1, normalized.length, width).setValues(normalized);

    return jsonOut({
      ok: true,
      updatedRows: normalized.length,
      updatedColumns: width,
      sheet: sheet.getName()
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function jsonOut(obj, _status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
