const { poolPromise, sql } = require("../config/db");

async function fullDatabaseAudit() {
  const pool = await poolPromise;

  const billIds = [
    'DEF80C13-0F6E-47EB-AABA-135F51506047',
    '8149A819-D785-49E6-8FCA-64FE50449F04',
    '74A992DB-706A-4055-8136-AA1B74118B21'
  ];

  const orderIds = [
    'A4F23C73-A1F9-4863-837C-D21225E8CD2C',
    '38A4929E-B52A-4A63-8C92-7A76E55CA6F4',
    '3C6EC831-61EE-4E3B-836C-38234E81D61F'
  ];

  console.log("=================================================================");
  console.log("STARTING FULL DATABASE AUDIT FOR ALL TABLES & ALL DATE COLUMNS");
  console.log("=================================================================\n");

  // Get all user tables in the database
  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);

  const allTables = tablesRes.recordset.map(r => r.TABLE_NAME);
  console.log(`Scanning ${allTables.length} total database tables...\n`);

  const tableAuditResults = [];
  let oct2CountRemaining = 0;

  for (const table of allTables) {
    // Get all columns for this table
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = '${table}'
    `);

    const cols = colsRes.recordset;
    const textCols = cols.filter(c => c.DATA_TYPE.toLowerCase() === 'uniqueidentifier' || c.DATA_TYPE.toLowerCase().includes('char'));
    const dateCols = cols.filter(c => c.DATA_TYPE.toLowerCase().includes('date') || c.DATA_TYPE.toLowerCase().includes('time'));

    if (textCols.length === 0) continue;

    // Check if table contains any of our billIds or orderIds
    const whereConditions = [];
    for (const c of textCols) {
      for (const bid of billIds) {
        whereConditions.push(`CAST([${c.COLUMN_NAME}] AS VARCHAR(100)) = '${bid}'`);
      }
      for (const oid of orderIds) {
        whereConditions.push(`CAST([${c.COLUMN_NAME}] AS VARCHAR(100)) = '${oid}'`);
      }
    }

    const whereClause = whereConditions.join(" OR ");

    try {
      const checkRes = await pool.request().query(`
        SELECT COUNT(*) as cnt FROM [${table}] WITH (NOLOCK) WHERE ${whereClause}
      `);

      const cnt = checkRes.recordset[0].cnt;
      if (cnt > 0) {
        // Inspect all columns and date values in this table for these records
        const sampleRes = await pool.request().query(`
          SELECT * FROM [${table}] WITH (NOLOCK) WHERE ${whereClause}
        `);

        const dateSummary = {};
        for (const col of cols) {
          const cName = col.COLUMN_NAME;
          const isDateCol = cName.toLowerCase().includes('date') || cName.toLowerCase().includes('time') || col.DATA_TYPE.toLowerCase().includes('date');
          if (isDateCol) {
            const vals = sampleRes.recordset.map(r => r[cName]).filter(Boolean);
            const strVals = vals.map(v => (v instanceof Date ? v.toISOString() : String(v)));
            const oct2Vals = strVals.filter(s => s.includes('2026-10-02'));
            if (oct2Vals.length > 0) {
              oct2CountRemaining += oct2Vals.length;
            }
            dateSummary[cName] = {
              sampleVal: strVals[0] || null,
              hasOct2: oct2Vals.length > 0
            };
          }
        }

        tableAuditResults.push({
          table,
          recordCount: cnt,
          dateSummary
        });
      }
    } catch (e) {
      // Table query error (ignore)
    }
  }

  console.log(`\n=================================================================`);
  console.log(`AUDIT RESULTS FOR ALL TABLES CONTAINING THESE 3 ORDERS/BILLS`);
  console.log(`=================================================================\n`);

  for (const item of tableAuditResults) {
    console.log(`📌 Table [${item.table}] (${item.recordCount} matching record(s)):`);
    for (const [col, info] of Object.entries(item.dateSummary)) {
      const flag = info.hasOct2 ? "⚠️ STILL HAS 2026-10-02" : "✅ OK";
      console.log(`   └─ ${col}: ${info.sampleVal} [${flag}]`);
    }
    console.log('');
  }

  console.log(`=================================================================`);
  console.log(`Total 2026-10-02 date references remaining across all tables: ${oct2CountRemaining}`);
  console.log(`=================================================================`);

  process.exit(0);
}

fullDatabaseAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
