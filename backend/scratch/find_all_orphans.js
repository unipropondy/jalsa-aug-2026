const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    const query = `
      SELECT 
        CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) as DateKey,
        COUNT(ri.RestaurantBillId) as InvoiceCount,
        SUM(ri.TotalAmount) as InvoiceSum,
        COUNT(sh.SettlementID) as SettlementCount,
        SUM(sh.SysAmount) as SettlementSum
      FROM RestaurantInvoice ri
      LEFT JOIN SettlementHeader sh ON ri.RestaurantBillId = sh.SettlementID
      WHERE CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND ri.StatusCode = 5
      GROUP BY CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE)
      ORDER BY DateKey
    `;

    const res = await pool.request().query(query);
    console.log("Date-wise comparison of RestaurantInvoice (completed) vs SettlementHeader:");
    console.table(res.recordset.map(r => ({
      Date: r.DateKey instanceof Date ? r.DateKey.toISOString().split("T")[0] : r.DateKey,
      InvoiceCount: r.InvoiceCount,
      InvoiceSum: r.InvoiceSum,
      SettlementCount: r.SettlementCount,
      SettlementSum: r.SettlementSum,
      DiffCount: r.InvoiceCount - r.SettlementCount,
      DiffSum: Number(r.InvoiceSum || 0) - Number(r.SettlementSum || 0)
    })));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
