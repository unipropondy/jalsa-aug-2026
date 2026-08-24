const { poolPromise, sql } = require("../config/db");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    // ----------------------------------------------------
    // METHOD 1: Current Frontend (based on SettlementHeader / SettlementTotalSales)
    // ----------------------------------------------------
    const { fetchFullReportData } = require("../utils/reportDataFetcher");
    const m1 = await fetchFullReportData(startDateStr, endDateStr, pool);

    // ----------------------------------------------------
    // METHOD 2: Including Orphan Invoices (using RestaurantInvoice & PaymentDetailCur / PaymentDetail)
    // ----------------------------------------------------
    // Let's get ALL completed invoices (StatusCode = 5) from RestaurantInvoice in the range
    const riQuery = `
      SELECT 
        ri.RestaurantBillId,
        ri.TotalAmount,
        ri.InvoiceDate,
        ri.PaymentTermCode
      FROM RestaurantInvoice ri
      WHERE CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) >= '${startDateStr}'
        AND CAST(COALESCE(ri.start_date, CAST(ri.InvoiceDate AS DATE)) AS DATE) <= '${endDateStr}'
        AND ri.StatusCode = 5
    `;
    const riRes = await pool.request().query(riQuery);
    const invoices = riRes.recordset || [];

    // Let's get payments for these invoices
    const paymodesRes = await pool.request().query("SELECT Position, PayMode, Description FROM [dbo].[Paymode]");
    const allPaymodes = paymodesRes.recordset || [];

    const normalizePayMode = (paymentMethod = "CASH") => {
      const raw = String(paymentMethod || "CASH").toUpperCase().trim();
      if (raw === "Q-R" || raw === "Q.R.") return "QR";
      if (raw === "PAY_NOW") return "PAYNOW";
      if (raw === "U-P-I") return "UPI";
      if (raw === "G-PAY") return "GPAY";
      if (raw === "P-H-O-N-E") return "PHONE";
      if (raw === "P-A-Y-T-M") return "PAYTM";
      if (raw === "CASHBOX" || raw === "CASH BOX" || raw === "CASH BOX ENTRY") return "CASH BOX ENTRY";
      if (raw === "CASH" || raw === "CAS" || raw === "1") return "CASH";
      if (raw.includes("CARD") || raw.includes("VISA") || raw.includes("MASTER") || raw.includes("AMEX") || raw.includes("DINERS")) return "CARD";
      if (raw.includes("PAYNOW") || raw.includes("GRAB") || raw.includes("FOODPANDA") || raw === "3" || raw.includes("PAY NOW")) return "PAYNOW";
      if (raw.includes("UPI") || raw === "4" || raw.includes("GPAY") || raw.includes("PHONE") || raw.includes("PAYTM")) return "UPI";
      if (raw.includes("NETS") || raw === "2") return "NETS";
      if (raw.includes("MEMBER") || raw === "5") return "MEMBER";
      if (raw.includes("CREDIT") || raw === "6") return "CREDIT";
      return raw;
    };

    const m2Breakdown = {};
    allPaymodes.forEach(pm => {
      m2Breakdown[pm.PayMode.toUpperCase().trim()] = 0;
    });
    m2Breakdown['CASH BOX ENTRY'] = 0;

    let m2TotalSales = 0;

    for (const inv of invoices) {
      m2TotalSales += Number(inv.TotalAmount || 0);

      // Get payments for this invoice from PaymentDetailCur or PaymentDetail
      const pdRes = await pool.request().query(`
        SELECT pd.Paymode, pd.Amount, pd.Remarks
        FROM (
          SELECT Paymode, Amount, Remarks FROM PaymentDetailCur WHERE RestaurantBillId = '${inv.RestaurantBillId}'
          UNION ALL
          SELECT Paymode, Amount, Remarks FROM PaymentDetail WHERE RestaurantBillId = '${inv.RestaurantBillId}'
        ) pd
      `);

      const payments = pdRes.recordset || [];
      if (payments.length > 0) {
        payments.forEach(p => {
          const pmInfo = allPaymodes.find(x => x.Position === p.Paymode);
          const rawName = pmInfo ? pmInfo.PayMode : p.Remarks || "CASH";
          const normName = normalizePayMode(rawName);
          m2Breakdown[normName] = (m2Breakdown[normName] || 0) + Number(p.Amount || 0);
        });
      } else {
        // Fallback to PaymentTermCode mapping if no payment detail records found
        const termMapping = { 1: "CASH", 2: "CARD", 3: "NETS", 4: "CREDIT", 5: "MEMBER", 6: "QR" };
        const fallbackMode = termMapping[inv.PaymentTermCode] || "CASH";
        m2Breakdown[fallbackMode] = (m2Breakdown[fallbackMode] || 0) + Number(inv.TotalAmount || 0);
      }
    }

    // CASHBOX entries: they might not be linked to RestaurantInvoice (some entries are Cash Box Entry only).
    // Let's count Cash Box entries from SettlementHeader or SettlementTotalSales
    const cashboxRes = await pool.request().query(`
      SELECT SUM(SysAmount) as sumVal 
      FROM SettlementTotalSales 
      WHERE PayMode = 'Cash Box Entry'
        AND SettlementID IN (
          SELECT SettlementID FROM SettlementHeader 
          WHERE CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) >= '${startDateStr}'
            AND CAST(COALESCE(start_date, CAST(LastSettlementDate AS DATE)) AS DATE) <= '${endDateStr}'
        )
    `);
    const cashboxSum = Number(cashboxRes.recordset[0]?.sumVal || 0);
    m2Breakdown['CASH BOX ENTRY'] = cashboxSum;
    m2TotalSales += cashboxSum;

    // Deduct CASHBOX from CASH in Method 2 just like report data fetcher does
    m2Breakdown['CASH'] = m2Breakdown['CASH'] - cashboxSum;

    console.log("=== COMPARISON RESULTS ===");
    console.log(`Date Range: ${startDateStr} to ${endDateStr}\n`);

    console.log("------------------------------------------------------------------");
    console.log("Metric                       | Method 1 (Frontend) | Method 2 (RI + PD)");
    console.log("------------------------------------------------------------------");
    console.log(`Total Sales Volume           | $${m1.totalSales.toFixed(2).padEnd(18)} | $${m2TotalSales.toFixed(2)}`);
    console.log(`CASH Sales                   | $${m1.paymentBreakdown.CASH.toFixed(2).padEnd(18)} | $${m2Breakdown.CASH.toFixed(2)}`);
    console.log(`NETS Sales                   | $${m1.paymentBreakdown.NETS.toFixed(2).padEnd(18)} | $${m2Breakdown.NETS.toFixed(2)}`);
    console.log(`CREDIT Sales                 | $${m1.paymentBreakdown.CREDIT.toFixed(2).padEnd(18)} | $${m2Breakdown.CREDIT.toFixed(2)}`);
    console.log(`MEMBER Sales                 | $${m1.paymentBreakdown.MEMBER.toFixed(2).padEnd(18)} | $${m2Breakdown.MEMBER.toFixed(2)}`);
    console.log(`QR Sales                     | $${m1.paymentBreakdown.QR.toFixed(2).padEnd(18)} | $${m2Breakdown.QR.toFixed(2)}`);
    console.log(`PAYNOW Sales                 | $${m1.paymentBreakdown.PAYNOW.toFixed(2).padEnd(18)} | $${m2Breakdown.PAYNOW.toFixed(2)}`);
    console.log(`CASH BOX ENTRY               | $${m1.paymentBreakdown['CASH BOX ENTRY'].toFixed(2).padEnd(18)} | $${m2Breakdown['CASH BOX ENTRY'].toFixed(2)}`);
    console.log("------------------------------------------------------------------");

    console.log("\nMethod 2 payment breakdown detail:", m2Breakdown);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
