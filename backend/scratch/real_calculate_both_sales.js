const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    // ----------------------------------------------------
    // Method 1: SettlementHeader / SettlementTotalSales
    // ----------------------------------------------------
    const m1Res = await pool.request().query(`
      SELECT PayMode, SUM(SysAmount) as SumAmount
      FROM SettlementTotalSales
      WHERE SettlementID IN (
        SELECT SettlementID FROM SettlementHeader
        WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
          AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
      )
      GROUP BY PayMode
      ORDER BY PayMode
    `);
    
    // ----------------------------------------------------
    // Method 2: RestaurantInvoice / PaymentDetail (Master table only!)
    // ----------------------------------------------------
    const m2Res = await pool.request().query(`
      SELECT RTRIM(pm.PayMode) as PayMode, SUM(pd.Amount) as SumAmount
      FROM PaymentDetail pd
      JOIN Paymode pm ON pd.Paymode = pm.Position
      WHERE pd.RestaurantBillId IN (
        SELECT RestaurantBillId 
        FROM RestaurantInvoice 
        WHERE CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
          AND CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
          AND StatusCode = 5
      )
      GROUP BY pm.PayMode
      ORDER BY pm.PayMode
    `);

    // Let's also count Cash Box entries in SettlementTotalSales to be fair
    const cashboxRes = await pool.request().query(`
      SELECT SUM(SysAmount) as sumVal 
      FROM SettlementTotalSales 
      WHERE PayMode = 'Cash Box Entry'
        AND SettlementID IN (
          SELECT SettlementID FROM SettlementHeader 
          WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
            AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
        )
    `);
    const cashboxSum = Number(cashboxRes.recordset[0]?.sumVal || 0);

    console.log("=== REAL COMPARISON RESULTS ===");
    console.log("Method 1 (SettlementHeader / SettlementTotalSales):");
    console.table(m1Res.recordset);

    console.log("\nMethod 2 (RestaurantInvoice / PaymentDetail):");
    console.table(m2Res.recordset);

    console.log("\nCash Box Entry Sum (Method 1):", cashboxSum);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
