const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    // 1. Get all bills
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

    // 2. Get all SettlementTotalSales
    const stsRes = await pool.request().query(`
      SELECT SettlementID, RTRIM(PayMode) as PayMode, SysAmount
      FROM SettlementTotalSales
    `);
    const stsList = stsRes.recordset || [];
    const stsMap = {};
    stsList.forEach(r => {
      if (!stsMap[r.SettlementID]) stsMap[r.SettlementID] = [];
      stsMap[r.SettlementID].push(r);
    });

    // 3. Get all PaymentDetail
    const pdRes = await pool.request().query(`
      SELECT pd.RestaurantBillId as SettlementID, RTRIM(pm.PayMode) as PayMode, pd.Amount
      FROM PaymentDetail pd
      JOIN Paymode pm ON pd.Paymode = pm.Position
    `);
    const pdList = pdRes.recordset || [];
    const pdMap = {};
    pdList.forEach(r => {
      if (!pdMap[r.SettlementID]) pdMap[r.SettlementID] = [];
      pdMap[r.SettlementID].push(r);
    });

    console.log(`Analyzing ${bills.length} bills...`);

    const diffs = [];

    bills.forEach(b => {
      const sts = stsMap[b.BillId] || [];
      const pd = pdMap[b.BillId] || [];

      const stsTotal = sts.reduce((sum, r) => sum + Number(r.SysAmount || 0), 0);
      const pdTotal = pd.reduce((sum, r) => sum + Number(r.Amount || 0), 0);

      const stsStr = sts.map(r => `${r.PayMode}:${Number(r.SysAmount).toFixed(2)}`).sort().join(", ") || "NONE";
      const pdStr = pd.map(r => `${r.PayMode}:${Number(r.Amount).toFixed(2)}`).sort().join(", ") || "NONE";

      if (Math.abs(stsTotal - pdTotal) > 0.01 || stsStr !== pdStr) {
        diffs.push({
          BillId: b.BillId,
          BillNo: b.BillNo,
          LastSettlementDate: b.LastSettlementDate,
          Source: b.Source,
          IsCancelled: b.IsCancelled,
          StsTotal: stsTotal,
          PdTotal: pdTotal,
          StsModes: stsStr,
          PdModes: pdStr
        });
      }
    });

    console.log(`\nFound ${diffs.length} differences:`);
    diffs.forEach(d => {
      console.log(`\n- BillNo: ${d.BillNo} (ID: ${d.BillId}) | Cancelled: ${d.IsCancelled} | Source: ${d.Source}`);
      console.log(`  Date: ${d.LastSettlementDate instanceof Date ? d.LastSettlementDate.toISOString().split("T")[0] : d.LastSettlementDate}`);
      console.log(`  SettlementTotalSales (stsTotal: ${d.StsTotal.toFixed(2)}): [${d.StsModes}]`);
      console.log(`  PaymentDetail        (pdTotal:  ${d.PdTotal.toFixed(2)}): [${d.PdModes}]`);
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
