const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    const billsRes = await pool.request().query(`
      SELECT DISTINCT SettlementID as BillId, BillNo, LastSettlementDate, 'SH' as Source, IsCancelled
      FROM SettlementHeader
      WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
      
      UNION
      
      SELECT DISTINCT RestaurantBillId as BillId, BillNumber as BillNo, InvoiceDate as LastSettlementDate, 'RI' as Source, 0 as IsCancelled
      FROM RestaurantInvoice
      WHERE CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(start_date, CAST(InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND StatusCode = 5
    `);
    const bills = billsRes.recordset || [];

    const stsRes = await pool.request().query(`
      SELECT SettlementID, RTRIM(PayMode) as PayMode, SysAmount
      FROM SettlementTotalSales
    `);
    const stsMap = {};
    stsRes.recordset.forEach(r => {
      if (!stsMap[r.SettlementID]) stsMap[r.SettlementID] = [];
      stsMap[r.SettlementID].push(r);
    });

    const pdRes = await pool.request().query(`
      SELECT pd.RestaurantBillId as SettlementID, RTRIM(pm.PayMode) as PayMode, pd.Amount
      FROM PaymentDetail pd
      JOIN Paymode pm ON pd.Paymode = pm.Position
    `);
    const pdMap = {};
    pdRes.recordset.forEach(r => {
      if (!pdMap[r.SettlementID]) pdMap[r.SettlementID] = [];
      pdMap[r.SettlementID].push(r);
    });

    const m1Totals = { CASH: 0, NETS: 0, CREDIT: 0, PAYNOW: 0, QR: 0, VOID: 0, OTHER: 0 };
    const m2Totals = { CASH: 0, NETS: 0, CREDIT: 0, PAYNOW: 0, QR: 0, VOID: 0, OTHER: 0 };

    bills.forEach(b => {
      const sts = stsMap[b.BillId] || [];
      const pd = pdMap[b.BillId] || [];

      sts.forEach(r => {
        const mode = r.PayMode.toUpperCase().trim();
        const dest = m1Totals[mode] !== undefined ? mode : 'OTHER';
        m1Totals[dest] += Number(r.SysAmount || 0);
      });

      pd.forEach(r => {
        const mode = r.PayMode.toUpperCase().trim();
        const dest = m2Totals[mode] !== undefined ? mode : 'OTHER';
        m2Totals[dest] += Number(r.Amount || 0);
      });
    });

    console.log("=== EXACT PAYMENT TOTALS COMPARED ===");
    console.log("PayMode | Method 1 (SettlementTotalSales) | Method 2 (PaymentDetail) | Difference (M2 - M1)");
    console.log("-----------------------------------------------------------------------------------------");
    Object.keys(m1Totals).forEach(mode => {
      const v1 = m1Totals[mode];
      const v2 = m2Totals[mode];
      const diff = v2 - v1;
      console.log(`${mode.padEnd(7)} | $${v1.toFixed(2).padEnd(30)} | $${v2.toFixed(2).padEnd(24)} | $${diff.toFixed(2)}`);
    });

    const m1Sum = Object.values(m1Totals).reduce((a, b) => a + b, 0);
    const m2Sum = Object.values(m2Totals).reduce((a, b) => a + b, 0);
    console.log("-----------------------------------------------------------------------------------------");
    console.log(`TOTAL   | $${m1Sum.toFixed(2).padEnd(30)} | $${m2Sum.toFixed(2).padEnd(24)} | $${(m2Sum - m1Sum).toFixed(2)}`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
