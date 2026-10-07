const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billId = 'B949C2D7-244D-41DB-93B8-1EF935225E19';
  const orderId = '1DA4478E-0D95-4DAC-9233-642BB15E81D8';
  const billNumber = '20261001-0001';

  console.log("=================================================================");
  console.log("Inspecting all 18 tables with start_date column for Bill 20261001-0001");
  console.log("=================================================================\n");

  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE LOWER(COLUMN_NAME) IN ('start_date', 'startdate')
    ORDER BY TABLE_NAME
  `);

  const results = [];

  for (const t of tablesRes.recordset) {
    const tableName = t.TABLE_NAME;
    const colName = t.COLUMN_NAME;

    // Get all columns of this table
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${tableName}'
    `);
    const cols = colsRes.recordset;

    // Build conditions to find any match for billId, orderId, billNumber
    const conds = [];
    cols.forEach(c => {
      const dt = c.DATA_TYPE.toLowerCase();
      if (dt === 'uniqueidentifier' || dt.includes('char')) {
        conds.push(`CAST([${c.COLUMN_NAME}] AS VARCHAR(100)) = '${billId}'`);
        conds.push(`CAST([${c.COLUMN_NAME}] AS VARCHAR(100)) = '${orderId}'`);
        conds.push(`CAST([${c.COLUMN_NAME}] AS VARCHAR(100)) = '${billNumber}'`);
      }
    });

    if (conds.length === 0) {
      results.push({ tableName, colName, dataType: t.DATA_TYPE, matchCount: 0, status: 'No ID columns' });
      continue;
    }

    try {
      const q = `
        SELECT COUNT(*) as cnt, MIN([${colName}]) as min_start, MAX([${colName}]) as max_start
        FROM [${tableName}] WITH (NOLOCK)
        WHERE ${conds.join(' OR ')}
      `;
      const res = await pool.request().query(q);
      const cnt = res.recordset[0].cnt;
      results.push({
        tableName,
        colName,
        dataType: t.DATA_TYPE,
        matchCount: cnt,
        min_start: cnt > 0 ? res.recordset[0].min_start : null,
        max_start: cnt > 0 ? res.recordset[0].max_start : null
      });
    } catch (err) {
      results.push({ tableName, colName, dataType: t.DATA_TYPE, matchCount: 'ERROR', status: err.message });
    }
  }

  console.table(results);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
