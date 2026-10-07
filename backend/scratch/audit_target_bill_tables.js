const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billId = 'B949C2D7-244D-41DB-93B8-1EF935225E19';
  const orderId = '1DA4478E-0D95-4DAC-9233-642BB15E81D8';
  const billNumber = '20261001-0001';

  console.log("=================================================");
  console.log(`Auditing ALL tables in DB for Bill: ${billNumber}`);
  console.log(`RestaurantBillId / SettlementId: ${billId}`);
  console.log(`OrderId: ${orderId}`);
  console.log("=================================================\n");

  // 1. Find ALL tables in the database that have a column named start_date (case-insensitive)
  const startDateTablesRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE LOWER(COLUMN_NAME) IN ('start_date', 'startdate')
    ORDER BY TABLE_NAME
  `);

  console.log(`Found ${startDateTablesRes.recordset.length} tables with start_date column:`);
  console.table(startDateTablesRes.recordset);

  // 2. Search ALL tables in the database for references to billId, orderId, or billNumber
  const allTablesRes = await pool.request().query(`
    SELECT DISTINCT TABLE_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
    ORDER BY TABLE_NAME
  `);

  const matchingTables = [];

  for (const row of allTablesRes.recordset) {
    const tableName = row.TABLE_NAME;

    // Get columns for this table
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
    `);

    const cols = colsRes.recordset;
    const conds = [];

    for (const c of cols) {
      const colName = c.COLUMN_NAME;
      const dataType = c.DATA_TYPE.toLowerCase();

      if (dataType === 'uniqueidentifier' || dataType.includes('char') || dataType.includes('text')) {
        conds.push(`CAST([${colName}] AS VARCHAR(100)) = '${billId}'`);
        conds.push(`CAST([${colName}] AS VARCHAR(100)) = '${orderId}'`);
        conds.push(`CAST([${colName}] AS VARCHAR(100)) = '${billNumber}'`);
      }
    }

    if (conds.length > 0) {
      try {
        const checkQuery = `
          SELECT COUNT(*) as cnt 
          FROM [${tableName}] WITH (NOLOCK) 
          WHERE ${conds.join(" OR ")}
        `;
        const res = await pool.request().query(checkQuery);
        const cnt = res.recordset[0].cnt;
        if (cnt > 0) {
          // Find which columns matched
          const matchedCols = [];
          for (const c of cols) {
            const colName = c.COLUMN_NAME;
            const dataType = c.DATA_TYPE.toLowerCase();
            if (dataType === 'uniqueidentifier' || dataType.includes('char') || dataType.includes('text')) {
              const colCheck = await pool.request().query(`
                SELECT COUNT(*) as c 
                FROM [${tableName}] WITH (NOLOCK) 
                WHERE CAST([${colName}] AS VARCHAR(100)) IN ('${billId}', '${orderId}', '${billNumber}')
              `);
              if (colCheck.recordset[0].c > 0) {
                matchedCols.push(`${colName} (${colCheck.recordset[0].c})`);
              }
            }
          }

          // Check if start_date or other date columns exist
          const dateCols = cols.filter(c => 
            c.COLUMN_NAME.toLowerCase().includes('date') || 
            c.COLUMN_NAME.toLowerCase().includes('time') || 
            c.COLUMN_NAME.toLowerCase().includes('created') ||
            c.COLUMN_NAME.toLowerCase().includes('modified') ||
            c.COLUMN_NAME.toLowerCase().includes('start')
          ).map(c => c.COLUMN_NAME);

          matchingTables.push({
            tableName,
            matchingRecordCount: cnt,
            matchedColumns: matchedCols.join(", "),
            dateColumns: dateCols.join(", ")
          });
        }
      } catch (err) {
        // console.error(`Error querying ${tableName}:`, err.message);
      }
    }
  }

  console.log("\n=================================================");
  console.log(`FOUND ${matchingTables.length} TABLES CONTAINING THIS BILL/ORDER DATA:`);
  console.log("=================================================");
  console.table(matchingTables);

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
