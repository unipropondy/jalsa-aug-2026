const { poolPromise } = require("../config/db");
const { fetchFullReportData } = require("../utils/reportDataFetcher");

async function main() {
  const pool = await poolPromise;
  const startDateStr = '2026-06-01';
  const endDateStr = '2026-08-11';

  try {
    const data = await fetchFullReportData(startDateStr, endDateStr, pool);

    console.log("=== TOTALS COMPARISON ===");
    console.log("Total Sales (SettlementHeader / paymentBreakdown):", data.totalSales);
    
    // Sum category sales
    const categorySum = data.categories.reduce((sum, c) => sum + Number(c.Sales || 0), 0);
    console.log("Total Sales (Category-wise sum):", categorySum);

    // Sum item sales
    const itemSum = data.items.reduce((sum, item) => sum + Number(item.Sales || 0), 0);
    console.log("Total Sales (Item-wise sum):", itemSum);

    console.log(`\nDiscrepancy (Category Sum - SettlementHeader Total): ${categorySum - data.totalSales}`);
    console.log(`Discrepancy (Item Sum - SettlementHeader Total): ${itemSum - data.totalSales}`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
