const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: "202.156.19.151",
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 15000 }
};

async function updateSchemaAndData() {
  const pool = await sql.connect(dbConfig);
  try {
    console.log("=== 1. Check if start_date column exists in CustomerCreditTransactions ===");
    const colCheck = await pool.request().query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'CustomerCreditTransactions' AND COLUMN_NAME = 'start_date'
    `);

    if (colCheck.recordset.length === 0) {
      console.log("Adding start_date column to CustomerCreditTransactions...");
      await pool.request().query(`
        ALTER TABLE CustomerCreditTransactions ADD start_date DATE NULL;
      `);
      console.log("✅ Column start_date added successfully!");
    } else {
      console.log("Column start_date already exists in CustomerCreditTransactions.");
    }

    console.log("\n=== 2. Get active business StartDate from DateEntry ===");
    const activeDayRes = await pool.request().query("SELECT TOP 1 StartDate FROM DateEntry ORDER BY CreatedDate DESC");
    const activeStartDate = activeDayRes.recordset[0].StartDate;
    console.log("Active StartDate:", activeStartDate);

    console.log("\n=== 3. Update start_date for Anand's Oct 7 payment to match active business date ===");
    const updateRes = await pool.request()
      .input("TxId", 'CB27B0B0-0801-4F5D-B48D-548F98D5F22D')
      .input("StartDate", activeStartDate)
      .query(`
        UPDATE CustomerCreditTransactions
        SET start_date = @StartDate
        WHERE TransactionId = @TxId
      `);
    console.log(`Updated ${updateRes.rowsAffected[0]} row(s) for Anand's payment.`);

    console.log("\n=== 4. Backfill start_date for any other null rows in CustomerCreditTransactions ===");
    const backfillRes = await pool.request().query(`
      UPDATE CustomerCreditTransactions
      SET start_date = CAST(CreatedDate AS DATE)
      WHERE start_date IS NULL
    `);
    console.log(`Backfilled ${backfillRes.rowsAffected[0]} row(s).`);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error("Error in updateSchemaAndData:", err);
    await pool.close();
    process.exit(1);
  }
}

updateSchemaAndData();
