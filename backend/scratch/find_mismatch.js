const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    // Let's find all bills in this date range
    const shQuery = `
      SELECT 
        sh.SettlementID, 
        sh.BillNo, 
        sh.SysAmount as HeaderAmount,
        sh.LastSettlementDate,
        sh.IsCancelled
      FROM SettlementHeader sh
      WHERE CAST(COALESCE(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(sh.start_date, CAST(sh.LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
    `;
    const shRes = await pool.request().query(shQuery);
    const headers = shRes.recordset || [];

    console.log(`Analyzing ${headers.length} bills...`);

    const discrepancies = [];

    for (const h of headers) {
      const { SettlementID, BillNo, HeaderAmount, IsCancelled } = h;

      // Get from SettlementTotalSales
      const stsRes = await pool.request()
        .input('SettlementID', sql.UniqueIdentifier, SettlementID)
        .query('SELECT PayMode, SysAmount FROM SettlementTotalSales WHERE SettlementID = @SettlementID');
      
      // Get from PaymentDetailCur
      const pdRes = await pool.request()
        .input('SettlementID', sql.UniqueIdentifier, SettlementID)
        .query(`
          SELECT pm.PayMode, pd.Amount 
          FROM PaymentDetailCur pd
          JOIN Paymode pm ON pd.Paymode = pm.Position
          WHERE pd.RestaurantBillId = @SettlementID
        `);

      const stsList = stsRes.recordset || [];
      const pdList = pdRes.recordset || [];

      const stsTotal = stsList.reduce((sum, item) => sum + Number(item.SysAmount || 0), 0);
      const pdTotal = pdList.reduce((sum, item) => sum + Number(item.Amount || 0), 0);

      // Check if there is any mismatch in totals or individual paymodes
      const stsModes = stsList.map(item => `${item.PayMode.trim()}:${Number(item.SysAmount || 0).toFixed(2)}`).sort().join(', ');
      const pdModes = pdList.map(item => `${item.PayMode.trim()}:${Number(item.Amount || 0).toFixed(2)}`).sort().join(', ');

      const totalMismatch = Math.abs(stsTotal - pdTotal) > 0.01;
      const modesMismatch = stsModes !== pdModes;

      if (totalMismatch || modesMismatch || Math.abs(HeaderAmount - stsTotal) > 0.01) {
        discrepancies.push({
          SettlementID,
          BillNo,
          HeaderAmount,
          IsCancelled,
          stsTotal,
          pdTotal,
          stsModes,
          pdModes,
          LastSettlementDate: h.LastSettlementDate
        });
      }
    }

    console.log(`\nFound ${discrepancies.length} bills with differences:`);
    discrepancies.forEach(d => {
      console.log(`- BillNo: ${d.BillNo} (SettlementID: ${d.SettlementID}) | Cancelled: ${d.IsCancelled}`);
      console.log(`  Date: ${d.LastSettlementDate}`);
      console.log(`  HeaderAmount: ${d.HeaderAmount}`);
      console.log(`  SettlementTotalSales (stsTotal: ${d.stsTotal}): [${d.stsModes}]`);
      console.log(`  PaymentDetailCur     (pdTotal: ${d.pdTotal}): [${d.pdModes}]`);
    });

  } catch (err) {
    console.error("Error running script:", err);
  } finally {
    process.exit(0);
  }
}

main();
