/**
 * The builder's words for editorial layouts: placed grids (things on a magazine-style grid),
 * shared styles, the site's design variables and moving around the canvas. Part of
 * `builderStrings`, kept in their own file so each list stays easy to read.
 */
export const builderLayoutStrings = {
  "pageBuilder.grid.placeThings": "Place things",
  "pageBuilder.grid.inOrder": "In order",
  "pageBuilder.grid.onGrid": "On a grid",
  "pageBuilder.grid.anywhere": "Anywhere",
  "pageBuilder.grid.summary": "On a grid, {count} columns",
  "pageBuilder.grid.hint":
    "Drag things onto the columns. They can overlap; the corner handle makes them wider or taller.",
  "pageBuilder.grid.columns": "Columns",
  "pageBuilder.grid.stackOnPhone": "One under another on phones",
  "pageBuilder.grid.columnsOne": "Column {from}",
  "pageBuilder.grid.columnsRange": "Columns {from} to {to}",
  "pageBuilder.grid.rowsOne": "Row {from}",
  "pageBuilder.grid.rowsRange": "Rows {from} to {to}",
  "pageBuilder.grid.notPlaced": "The whole width",
  "pageBuilder.grid.from": "From",
  "pageBuilder.grid.to": "to",
  "pageBuilder.grid.columnsFrom": "First column",
  "pageBuilder.grid.columnsTo": "Last column",
  "pageBuilder.grid.rowsFrom": "First row",
  "pageBuilder.grid.rowsTo": "Last row",
  "pageBuilder.grid.rows": "Rows",
  "pageBuilder.grid.stackedOnPhone": "On phones it sits under the one before.",
  "pageBuilder.grid.placeOnPhone": "Place it on phones too",
  "pageBuilder.grid.stackAgain": "Back to one under another",
  "pageBuilder.grid.exact": "Exact values",
  "pageBuilder.grid.columnValue": "Grid column",
  "pageBuilder.grid.rowValue": "Grid row",
  "pageBuilder.grid.keysHint":
    "Arrow keys move it a column or a row; with Shift they make it wider or taller.",
  "pageBuilder.grid.notOnGrid": "This element isn’t on a grid",
  "pageBuilder.grid.history.on": "Put things on a grid",
  "pageBuilder.grid.history.off": "Took things off the grid",
  "pageBuilder.grid.history.order": "Put things back in order",
} as const;
