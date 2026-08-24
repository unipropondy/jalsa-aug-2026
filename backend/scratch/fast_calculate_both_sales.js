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
    `);
    
    // ----------------------------------------------------
    // Method 2: RestaurantInvoice / PaymentDetail (Cur + Master)
    // ----------------------------------------------------
    const m2Res = await pool.request().query(`
      SELECT RTRIM(pm.PayMode) as PayMode, SUM(pd.Amount) as SumAmount
      FROM (
        SELECT RestaurantBillId, Paymode, Amount FROM PaymentDetailCur
        UNION ALL
        SELECT RestaurantBillId, Paymode, Amount FROM PaymentDetail
      ) pd
      JOIN Paymode pm ON pd.Paymode = pm.Position
      WHERE pd.RestaurantBillId IN (
        SELECT RestaurantBillId 
        FROM RestaurantInvoice 
        WHERE CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
          AND CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
          AND StatusCode = 5
      )
      GROUP BY pm.PayMode
    `);

    console.log("=== FAST COMPARISON RESULTS ===");
    console.log("Method 1 (SettlementHeader / SettlementTotalSales):");
    console.table(m1Res.recordset);

    console.log("\nMethod 2 (RestaurantInvoice / PaymentDetail):");
    console.table(m2Res.recordset);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
