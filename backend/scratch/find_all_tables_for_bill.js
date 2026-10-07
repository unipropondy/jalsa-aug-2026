const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const billId = '8149A819-D785-49E6-8FCA-64FE50449F04';
  const orderId = '38A4929E-B52A-4A63-8C92-7A76E55CA6F4';

  console.log("Searching all tables for BillID / OrderID...");

  // Search all tables with VARCHAR/NVARCHAR/UNIQUEIDENTIFIER columns
  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE DATA_TYPE IN ('uniqueidentifier', 'varchar', 'nvarchar', 'char', 'nchar')
  `);

  const colsByTable = {};
  for (const row of tablesRes.recordset) {
    if (!colsByTable[row.TABLE_NAME]) colsByTable[row.TABLE_NAME] = [];
    colsByTable[row.TABLE_NAME].push(row.COLUMN_NAME);
  }

  const matches = [];

  for (const [table, cols] of Object.entries(colsByTable)) {
    // skip views if any
    if (table.startsWith('v_') || table.startsWith('V_')) continue;

    const whereClauses = cols.map(c => `CAST([${c}] AS VARCHAR(100)) = '${billId}' OR CAST([${c}] AS VARCHAR(100)) = '${orderId}'`).join(" OR ");
    try {
      const q = `SELECT COUNT(*) as cnt FROM [${table}] WHERE ${whereClauses}`;
      const res = await pool.request().query(q);
      if (res.recordset[0].cnt > 0) {
        matches.push({ table, count: res.recordset[0].cnt });
      }
    } catch (e) {
      // ignore table query errors
    }
  }

  console.log("Tables containing BillID or OrderID:");
  console.table(matches);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
