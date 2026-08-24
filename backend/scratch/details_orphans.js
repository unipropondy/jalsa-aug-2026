const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    const query = `
      SELECT 
        ri.RestaurantBillId,
        ri.BillNumber,
        ri.TotalAmount,
        ri.InvoiceDate,
        ri.CreatedOn,
        ri.start_date
      FROM RestaurantInvoice ri
      LEFT JOIN SettlementHeader sh ON ri.RestaurantBillId = sh.SettlementID
      WHERE CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND ri.StatusCode = 5
        AND sh.SettlementID IS NULL
      ORDER BY ri.InvoiceDate, ri.BillNumber
    `;

    const res = await pool.request().query(query);
    const orphans = res.recordset || [];
    console.log(`Found ${orphans.length} orphans:`);
    
    let totalOrphanAmount = 0;
    for (const r of orphans) {
      totalOrphanAmount += Number(r.TotalAmount || 0);
      const pdRes = await pool.request().query(`
        SELECT pm.PayMode, pd.Amount 
        FROM PaymentDetail pd 
        JOIN Paymode pm ON pd.Paymode = pm.Position 
        WHERE pd.RestaurantBillId = '${r.RestaurantBillId}'
      `);
      const pmStr = pdRes.recordset.map(p => `${p.PayMode.trim()}: ${p.Amount}`).join(", ");
      console.log(`- Bill: ${r.BillNumber} | Date: ${r.InvoiceDate.toISOString().split("T")[0]} | Amount: ${r.TotalAmount} | Payments: [${pmStr}]`);
    }
    console.log("Total Orphan Amount:", totalOrphanAmount);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
