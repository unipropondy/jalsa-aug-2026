const { poolPromise } = require("../config/db");

async function main() {
  const pool = await poolPromise;

  try {
    const res = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE COLUMN_NAME = 'start_date'
    `);
    const tables = res.recordset.map(r => r.TABLE_NAME);

    console.log("--- NULL start_date counts per table ---");
    for (const table of tables) {
      try {
        const countRes = await pool.request().query(`
          SELECT COUNT(*) as NullCount, COUNT(1) as TotalCount
          FROM [${table}]
          WHERE start_date IS NULL
        `);
        const { NullCount, TotalCount } = countRes.recordset[0];
        console.log(`- Table: ${table.padEnd(28)} | NULL start_date count: ${NullCount} / ${TotalCount}`);
      } catch (err) {
        console.log(`- Table: ${table.padEnd(28)} | Error reading table: ${err.message}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

main();
