const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  const billId = 'B949C2D7-244D-41DB-93B8-1EF935225E19';
  const orderId = '1DA4478E-0D95-4DAC-9233-642BB15E81D8';
  const billNumber = '20261001-0001';

  console.log("=========================================================================");
  console.log(`Checking ALL tables in UCSJALSA database for Bill: ${billNumber}`);
  console.log(`BillId / SettlementId: ${billId}`);
  console.log(`OrderId: ${orderId}`);
  console.log("=========================================================================\n");

  // Get all tables and their string/guid columns
  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'dbo'
  `);

  const tableMap = {};
  tablesRes.recordset.forEach(row => {
    if (!tableMap[row.TABLE_NAME]) {
      tableMap[row.TABLE_NAME] = { cols: [], stringCols: [], dateCols: [], startDateCol: null };
    }
    tableMap[row.TABLE_NAME].cols.push(row.COLUMN_NAME);

    const dt = row.DATA_TYPE.toLowerCase();
    if (['uniqueidentifier', 'varchar', 'nvarchar', 'char', 'nchar', 'text'].includes(dt)) {
      tableMap[row.TABLE_NAME].stringCols.push(row.COLUMN_NAME);
    }
    if (dt.includes('date') || dt.includes('time')) {
      tableMap[row.TABLE_NAME].dateCols.push(row.COLUMN_NAME);
    }
    if (row.COLUMN_NAME.toLowerCase() === 'start_date' || row.COLUMN_NAME.toLowerCase() === 'startdate') {
      tableMap[row.TABLE_NAME].startDateCol = row.COLUMN_NAME;
    }
  });

  const matchingTables = [];

  // Parallelize batches of table queries for speed
  const tableNames = Object.keys(tableMap);
  
  for (let i = 0; i < tableNames.length; i += 10) {
    const batch = tableNames.slice(i, i + 10);
    await Promise.all(batch.map(async (tableName) => {
      const info = tableMap[tableName];
      if (info.stringCols.length === 0) return;

      const conds = info.stringCols.map(c => 
        `CAST([${c}] AS VARCHAR(100)) = '${billId}' OR CAST([${c}] AS VARCHAR(100)) = '${orderId}' OR CAST([${c}] AS VARCHAR(100)) = '${billNumber}'`
      ).join(" OR ");

      try {
        const query = `SELECT COUNT(*) as cnt FROM [${tableName}] WITH (NOLOCK) WHERE ${conds}`;
        const res = await pool.request().query(query);
        const count = res.recordset[0].cnt;
        if (count > 0) {
          // Check what values currently exist for start_date and other date columns
          let startDateValues = [];
          if (info.startDateCol) {
            const sdRes = await pool.request().query(`
              SELECT DISTINCT [${info.startDateCol}] as sd 
              FROM [${tableName}] WITH (NOLOCK) 
              WHERE ${conds}
            `);
            startDateValues = sdRes.recordset.map(r => r.sd);
          }

          matchingTables.push({
            tableName,
            count,
            hasStartDateCol: info.startDateCol ? info.startDateCol : 'NO',
            currentStartDate: startDateValues.map(v => v ? new Date(v).toISOString().substring(0, 10) : 'NULL').join(', '),
            allDateCols: info.dateCols.join(', ')
          });
        }
      } catch (err) {
        // console.error(`Error querying ${tableName}:`, err.message);
      }
    }));
  }

  console.log(`\nFound ${matchingTables.length} tables containing records for Bill ${billNumber}:`);
  console.table(matchingTables);

  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
