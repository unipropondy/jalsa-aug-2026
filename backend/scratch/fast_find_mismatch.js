const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    const query = `
      SELECT 
        sh.SettlementID, 
        sh.BillNo, 
        sh.SysAmount as HeaderAmount,
        sh.LastSettlementDate,
        sh.IsCancelled,
        sts.StsTotal,
        pd.PdTotal
      FROM SettlementHeader sh
      LEFT JOIN (
        SELECT 
          SettlementID, 
          SUM(SysAmount) as StsTotal
        FROM SettlementTotalSales
        GROUP BY SettlementID
      ) sts ON sh.SettlementID = sts.SettlementID
      LEFT JOIN (
        SELECT 
          pd.RestaurantBillId, 
          SUM(pd.Amount) as PdTotal
        FROM PaymentDetailCur pd
        GROUP BY pd.RestaurantBillId
      ) pd ON sh.SettlementID = pd.RestaurantBillId
      WHERE CAST(COALESCE(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND (
          ABS(ISNULL(sts.StsTotal, 0) - ISNULL(pd.PdTotal, 0)) > 0.01 
          OR ABS(sh.SysAmount - ISNULL(sts.StsTotal, 0)) > 0.01
        )
    `;

    const res = await pool.request().query(query);
    const discrepancies = res.recordset || [];
    console.log(`Found ${discrepancies.length} bills with differences:`);

    for (const d of discrepancies) {
      console.log(`\n- BillNo: ${d.BillNo} (SettlementID: ${d.SettlementID}) | Cancelled: ${d.IsCancelled}`);
      console.log(`  Date: ${d.LastSettlementDate}`);
      console.log(`  HeaderAmount: ${d.HeaderAmount} | stsTotal: ${d.StsTotal} | pdTotal: ${d.PdTotal}`);
      
      // Get detailed payments for this bill
      const stsDetails = await pool.request()
        .input('id', sql.UniqueIdentifier, d.SettlementID)
        .query('SELECT PayMode, SysAmount FROM SettlementTotalSales WHERE SettlementID = @id');
      const pdDetails = await pool.request()
        .input('id', sql.UniqueIdentifier, d.SettlementID)
        .query('SELECT pd.Paymode, pm.PayMode as ModeName, pd.Amount FROM PaymentDetailCur pd JOIN Paymode pm ON pd.Paymode = pm.Position WHERE pd.RestaurantBillId = @id');
      
      console.log("  SettlementTotalSales details:", stsDetails.recordset);
      console.log("  PaymentDetailCur details:", pdDetails.recordset);
    }
  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    process.exit(0);
  }
}

main();
