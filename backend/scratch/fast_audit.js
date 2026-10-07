const { poolPromise, sql } = require("../config/db");

async function fastAudit() {
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

  const billNumbers = ["20261002-0004", "20261002-0005", "20261002-0006"];

  console.log("=================================================================");
  console.log("FAST BASE TABLE AUDIT FOR ALL RELEVANT TABLES AND COLUMNS");
  console.log("=================================================================\n");

  const candidateTablesRes = await pool.request().query(`
    SELECT DISTINCT c.TABLE_NAME 
    FROM INFORMATION_SCHEMA.COLUMNS c
    JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND c.COLUMN_NAME IN ('RestaurantBillId', 'OrderId', 'OrderID', 'SettlementID', 'SettlementId', 'BillNumber', 'OrderNo', 'BillNo', 'ReferenceNo', 'ReferenceId')
  `);

  const candidateTables = candidateTablesRes.recordset.map(r => r.TABLE_NAME);
  console.log(`Found ${candidateTables.length} base tables to audit:`, candidateTables.join(", "));

  const auditReport = [];

  for (const table of candidateTables) {
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'
    `);
    const cols = colsRes.recordset;

    const textCols = cols.filter(c => c.DATA_TYPE.toLowerCase() === 'uniqueidentifier' || c.DATA_TYPE.toLowerCase().includes('char'));
    const dateCols = cols.filter(c => c.DATA_TYPE.toLowerCase().includes('date') || c.DATA_TYPE.toLowerCase().includes('time') || c.COLUMN_NAME.toLowerCase().includes('start'));

    const matchConds = [];
    for (const c of textCols) {
      const colName = c.COLUMN_NAME;
      for (const bid of billIds) matchConds.push(`CAST([${colName}] AS VARCHAR(100)) = '${bid}'`);
      for (const oid of orderIds) matchConds.push(`CAST([${colName}] AS VARCHAR(100)) = '${oid}'`);
      for (const bn of billNumbers) matchConds.push(`CAST([${colName}] AS VARCHAR(100)) = '${bn}'`);
    }

    if (matchConds.length === 0) continue;

    try {
      const q = `SELECT COUNT(*) as cnt FROM [${table}] WITH (NOLOCK) WHERE ${matchConds.join(" OR ")}`;
      const cntRes = await pool.request().query(q);
      const cnt = cntRes.recordset[0].cnt;

      if (cnt > 0) {
        const rowsRes = await pool.request().query(`SELECT * FROM [${table}] WITH (NOLOCK) WHERE ${matchConds.join(" OR ")}`);

        const dateFields = {};
        for (const dc of dateCols) {
          const colName = dc.COLUMN_NAME;
          const vals = rowsRes.recordset.map(r => r[colName]).filter(v => v !== null && v !== undefined);
          const sample = vals[0];
          let formattedSample = sample;
          if (sample instanceof Date) {
            formattedSample = sample.toISOString().substring(0, 10);
          }
          dateFields[colName] = {
            sample: formattedSample,
            allOct1: vals.every(v => {
              const str = v instanceof Date ? v.toISOString() : String(v);
              return str.includes('2026-10-01');
            })
          };
        }

        auditReport.push({
          table,
          rowCount: cnt,
          dateFields
        });
      }
    } catch (e) {
      console.error(`Error querying ${table}:`, e.message);
    }
  }

  console.log("\n=================================================================");
  console.log("FINAL AUDIT REPORT FOR ORDERS #20261002-0004, 0005, 0006");
  console.log("=================================================================\n");

  for (const item of auditReport) {
    console.log(`📌 Table: [${item.table}] (${item.rowCount} record(s))`);
    for (const [colName, details] of Object.entries(item.dateFields)) {
      if (colName.toLowerCase().includes('start')) {
        const isOk = details.sample === '2026-10-01' || details.allOct1;
        console.log(`   └─ ${colName}: ${details.sample} [${isOk ? '✅ 2026-10-01' : '⚠️ NOT OCT 1'}]`);
      } else {
        console.log(`   └─ ${colName}: ${details.sample} (Timestamp)`);
      }
    }
    console.log('');
  }

  process.exit(0);
}

fastAudit().catch(err => {
  console.error("Fast Audit Error:", err);
  process.exit(1);
});
