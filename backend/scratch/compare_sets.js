const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    // 1. Get all SettlementIDs in SettlementHeader for this range
    const shQuery = `
      SELECT SettlementID, BillNo, IsCancelled, SysAmount, LastSettlementDate, start_date
      FROM SettlementHeader
      WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
    `;
    const shRes = await pool.request().query(shQuery);
    const shList = shRes.recordset || [];
    const shMap = new Map(shList.map(h => [h.SettlementID, h]));

    // 2. Get all distinct RestaurantBillId in PaymentDetailCur for this range
    const pdQuery = `
      SELECT DISTINCT RestaurantBillId
      FROM PaymentDetailCur
      WHERE CAST(COALESCE(start_date, CAST(PaymentCollectedOn AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(start_date, CAST(PaymentCollectedOn AS DATE)) AS DATE) <= '${endDateStr}'
    `;
    const pdRes = await pool.request().query(pdQuery);
    const pdList = pdRes.recordset || [];

    console.log(`SettlementHeader records: ${shList.length}`);
    console.log(`PaymentDetailCur unique RestaurantBillId records: ${pdList.length}`);

    // Find RestaurantBillId in pdList that are not in shMap
    const notInSh = [];
    for (const pd of pdList) {
      if (!shMap.has(pd.RestaurantBillId)) {
        notInSh.push(pd.RestaurantBillId);
      }
    }

    console.log(`\nRestaurantBillId in PaymentDetailCur but NOT in SettlementHeader (within date range): ${notInSh.length}`);
    if (notInSh.length > 0) {
      // Look them up in database
      for (const id of notInSh.slice(0, 10)) {
        const hRes = await pool.request()
          .input('id', sql.UniqueIdentifier, id)
          .query('SELECT BillNo, IsCancelled, SysAmount, LastSettlementDate, start_date FROM SettlementHeader WHERE SettlementID = @id');
        const pdSums = await pool.request()
          .input('id', sql.UniqueIdentifier, id)
          .query('SELECT pm.PayMode, pd.Amount, pd.PaymentCollectedOn, pd.start_date FROM PaymentDetailCur pd JOIN Paymode pm ON pd.Paymode = pm.Position WHERE pd.RestaurantBillId = @id');
        
        console.log(`- ID: ${id}`);
        console.log(`  SettlementHeader lookup:`, hRes.recordset[0] || "NOT FOUND AT ALL");
        console.log(`  PaymentDetailCur sums:`, pdSums.recordset);
      }
    }

    // Find SettlementIDs in shList that are not in PaymentDetailCur (within date range)
    const notInPd = [];
    for (const sh of shList) {
      const pdCheck = await pool.request()
        .input('id', sql.UniqueIdentifier, sh.SettlementID)
        .query(`
          SELECT COUNT(*) as Count 
          FROM PaymentDetailCur 
          WHERE RestaurantBillId = @id 
            AND CAST(COALESCE(start_date, CAST(PaymentCollectedOn AS DATE)) AS DATE) >= '${startDateStr}'
            AND CAST(COALESCE(start_date, CAST(PaymentCollectedOn AS DATE)) AS DATE) <= '${endDateStr}'
        `);
      if (pdCheck.recordset[0].Count === 0) {
        notInPd.push(sh);
      }
    }
    console.log(`\nSettlementHeader records that have NO PaymentDetailCur in range: ${notInPd.length}`);
    if (notInPd.length > 0) {
      notInPd.slice(0, 10).forEach(sh => {
        console.log(`- BillNo: ${sh.BillNo} (ID: ${sh.SettlementID}) | Cancelled: ${sh.IsCancelled} | Amount: ${sh.SysAmount} | Date: ${sh.LastSettlementDate} | start_date: ${sh.start_date}`);
      });
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
