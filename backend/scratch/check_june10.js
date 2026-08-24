const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const dateStr = '2026-06-10';

  try {
    // 1. Count of SettlementHeader for June 10
    const shRes = await pool.request()
      .query(`
        SELECT COUNT(*) as Count, SUM(SysAmount) as SumAmount 
        FROM SettlementHeader 
        WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) = '${dateStr}'
      `);
    console.log("SettlementHeader for June 10:", shRes.recordset[0]);

    // 2. Count of RestaurantInvoice for June 10
    const riRes = await pool.request()
      .query(`
        SELECT COUNT(*) as Count, SUM(TotalAmount) as SumAmount 
        FROM RestaurantInvoice 
        WHERE CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) = '${dateStr}'
          AND StatusCode = 5
      `);
    console.log("RestaurantInvoice (StatusCode=5) for June 10:", riRes.recordset[0]);

    // 3. Let's list all RestaurantInvoice for June 10 that are NOT in SettlementHeader
    const listRes = await pool.request()
      .query(`
        SELECT ri.RestaurantBillId, ri.BillNumber, ri.TotalAmount, ri.OrderDateTime, ri.PaymentTermCode
        FROM RestaurantInvoice ri
        WHERE CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) = '${dateStr}'
          AND ri.StatusCode = 5
          AND NOT EXISTS (
            SELECT 1 FROM SettlementHeader sh WHERE sh.SettlementID = ri.RestaurantBillId
          )
      `);
    console.log("\nInvoices in RestaurantInvoice but NOT in SettlementHeader on June 10:");
    console.table(listRes.recordset);

    // 4. Let's check if there are corresponding details in SettlementItemDetail for these orphans
    for (const r of listRes.recordset) {
      const itemsRes = await pool.request()
        .input('id', sql.UniqueIdentifier, r.RestaurantBillId)
        .query("SELECT COUNT(*) as Count FROM SettlementItemDetail WHERE SettlementID = @id");
      
      const pdRes = await pool.request()
        .input('id', sql.UniqueIdentifier, r.RestaurantBillId)
        .query("SELECT pm.PayMode, pd.Amount FROM PaymentDetailCur pd JOIN Paymode pm ON pd.Paymode = pm.Position WHERE pd.RestaurantBillId = @id");
      
      console.log(`\nBillNo: ${r.BillNumber} (ID: ${r.RestaurantBillId})`);
      console.log(`- SettlementItemDetail count: ${itemsRes.recordset[0].Count}`);
      console.log(`- PaymentDetailCur:`, pdRes.recordset);
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
