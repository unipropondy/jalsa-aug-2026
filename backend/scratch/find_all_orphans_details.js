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
        ri.PaymentTermCode
      FROM RestaurantInvoice ri
      LEFT JOIN SettlementHeader sh ON ri.RestaurantBillId = sh.SettlementID
      WHERE CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND ri.StatusCode = 5
        AND sh.SettlementID IS NULL
      ORDER BY ri.InvoiceDate
    `;

    const res = await pool.request().query(query);
    const orphans = res.recordset || [];
    console.log(`Found ${orphans.length} orphan invoices (exist in RestaurantInvoice but NOT in SettlementHeader):`);
    
    for (const r of orphans) {
      const dateStr = r.InvoiceDate instanceof Date ? r.InvoiceDate.toISOString().split("T")[0] : r.InvoiceDate;
      
      // Get payment method details from PaymentDetailCur or PaymentDetail
      const pdc = await pool.request()
        .input('id', pool.config.driver === 'mssql' ? r.RestaurantBillId : r.RestaurantBillId) // mssql package handles guid automatically
        .query(`
          SELECT pm.PayMode, pd.Amount, pd.Remarks
          FROM PaymentDetailCur pd
          JOIN Paymode pm ON pd.Paymode = pm.Position
          WHERE pd.RestaurantBillId = '${r.RestaurantBillId}'
        `);
      
      const pd = await pool.request()
        .query(`
          SELECT pm.PayMode, pd.Amount, pd.Remarks
          FROM PaymentDetail pd
          JOIN Paymode pm ON pd.Paymode = pm.Position
          WHERE pd.RestaurantBillId = '${r.RestaurantBillId}'
        `);

      const allPm = [...(pdc.recordset || []), ...(pd.recordset || [])];
      const pmStr = allPm.map(p => `${p.PayMode.trim()}: ${p.Amount}`).join(", ");
      
      console.log(`- Date: ${dateStr} | BillNo: ${r.BillNumber} | Amount: ${r.TotalAmount} | ID: ${r.RestaurantBillId} | Payments: [${pmStr}]`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
