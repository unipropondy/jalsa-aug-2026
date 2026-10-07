const { poolPromise, sql } = require("../config/db");

async function run() {
  const pool = await poolPromise;

  const settlementIds = [
    'A5802249-B38F-4D2C-9F7F-EF55533ACEE1',
    '9EE0A06F-AD00-484F-A730-5B0ECF6DCEFB'
  ];

  const orderIds = [
    '26579B83-5B55-4E4A-9CC0-4A16ED2DA5C1',
    '9E3133F1-2765-40E4-B279-7D27C6A5EB69'
  ];

  const sIds = settlementIds.map(s => `'${s}'`).join(',');
  const oIds = orderIds.map(o => `'${o}'`).join(',');

  const tablesToCheck = [
    'SettlementTotalSales',
    'CustomerCreditTransactions',
    'MemberMaster',
    'CreditCustomerMaster',
    'PaymentTransactionDetails',
    'SettlementDiscountDetail',
    'SettlementTranDetail',
    'SettlementCreditSales'
  ];

  try {
    console.log("--- Checking Additional Tables Schema & Content ---");

    for (const table of tablesToCheck) {
      // 1. Check if table has start_date column
      const schemaRes = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'start_date'
      `);
      
      const hasStartDate = schemaRes.recordset.length > 0;
      console.log(`\nTable [${table}]: Has start_date? ${hasStartDate ? 'YES' : 'NO'}`);

      if (!hasStartDate) {
        continue;
      }

      // 2. Find primary/foreign key columns referencing Settlement or Order
      const columnsRes = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table}'
      `);
      
      const cols = columnsRes.recordset;
      const conditions = [];

      for (const col of cols) {
        const colName = col.COLUMN_NAME;
        const dataType = col.DATA_TYPE.toLowerCase();

        if (dataType === 'uniqueidentifier' || dataType.includes('char')) {
          for (const sid of settlementIds) {
            conditions.push(`[${colName}] = '${sid}'`);
          }
        }
        if (dataType.includes('int') || dataType.includes('char')) {
          for (const oid of orderIds) {
            conditions.push(`[${colName}] = '${oid}'`);
          }
        }
      }

      if (conditions.length > 0) {
        const q = `
          SELECT COUNT(*) AS cnt 
          FROM [${table}] WITH (NOLOCK)
          WHERE ${conditions.join(' OR ')}
        `;
        const countRes = await pool.request().query(q);
        console.log(`  Matching records found: ${countRes.recordset[0].cnt}`);
      } else {
        console.log("  No matching identifier columns found.");
      }
    }

  } catch (err) {
    console.error("Error during check:", err);
  } finally {
    process.exit(0);
  }
}

run();
