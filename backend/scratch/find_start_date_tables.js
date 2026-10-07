const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const billNumbers = ["20261002-0004", "20261002-0005", "20261002-0006"];
  const placeholders = billNumbers.map(b => `'${b}'`).join(",");

  console.log("=========================================");
  console.log("Analyzing 3 Bills:", billNumbers.join(", "));
  console.log("=========================================\n");

  // 1. Fetch Invoices / Bills
  const invRes = await pool.request().query(`
    SELECT RestaurantBillId, OrderId, BillNumber, start_date, TotalAmount, CreatedOn
    FROM RestaurantInvoice
    WHERE BillNumber IN (${placeholders})
    UNION ALL
    SELECT RestaurantBillId, OrderId, BillNumber, start_date, TotalAmount, CreatedOn
    FROM RestaurantInvoiceCur
    WHERE BillNumber IN (${placeholders})
  `);

  console.log("Invoices / Bills found:");
  console.table(invRes.recordset);

  const billIds = [...new Set(invRes.recordset.map(r => r.RestaurantBillId).filter(Boolean))];
  const orderIds = [...new Set(invRes.recordset.map(r => r.OrderId).filter(Boolean))];

  console.log(`Bill IDs (${billIds.length}):`, billIds);
  console.log(`Order IDs (${orderIds.length}):`, orderIds);

  // 2. Find ALL tables in the database that have a column named start_date or StartDate
  const startDateTablesRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE COLUMN_NAME IN ('start_date', 'StartDate', 'startdate')
  `);

  const tablesWithStartDate = startDateTablesRes.recordset;
  console.log(`\nFound ${tablesWithStartDate.length} tables with start_date column.`);

  // 3. For each table with start_date, check if it contains records for these billIds or orderIds
  const billIdPlaceholders = billIds.map(id => `'${id}'`).join(",");
  const orderIdPlaceholders = orderIds.map(id => `'${id}'`).join(",");

  const matches = [];

  for (const t of tablesWithStartDate) {
    const tableName = t.TABLE_NAME;
    const colName = t.COLUMN_NAME;

    // Get all columns for this table to see which ones are IDs or strings
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
    `);

    const cols = colsRes.recordset;
    const conds = [];

    for (const c of cols) {
      const cName = c.COLUMN_NAME;
      const dataType = c.DATA_TYPE.toLowerCase();

      if (dataType === 'uniqueidentifier' || dataType.includes('char')) {
        for (const bid of billIds) {
          conds.push(`CAST([${cName}] AS VARCHAR(100)) = '${bid}'`);
        }
        for (const oid of orderIds) {
          conds.push(`CAST([${cName}] AS VARCHAR(100)) = '${oid}'`);
        }
      }
    }

    if (conds.length > 0) {
      try {
        const query = `
          SELECT COUNT(*) as cnt, MIN([${colName}]) as min_date, MAX([${colName}]) as max_date 
          FROM [${tableName}] WITH (NOLOCK) 
          WHERE ${conds.join(" OR ")}
        `;
        const res = await pool.request().query(query);
        const count = res.recordset[0].cnt;
        if (count > 0) {
          matches.push({
            tableName,
            colName,
            matchCount: count,
            min_date: res.recordset[0].min_date,
            max_date: res.recordset[0].max_date
          });
        }
      } catch (err) {
        // Skip tables that throw error
      }
    }
  }

  console.log("\n--- Tables with start_date containing matching records ---");
  console.table(matches);

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
