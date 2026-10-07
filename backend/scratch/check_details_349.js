const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: "202.156.19.151",
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 15000,
    requestTimeout: 30000
  }
};

async function checkDetails() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log("=== Checking PaymentTransactionDetails for Member E32129D2-B468-4C20-A37B-145B2BA2E7B3 ===");
    const ptd = await pool.request().query(`
      SELECT * FROM PaymentTransactionDetails 
      WHERE ReferenceId = 'E32129D2-B468-4C20-A37B-145B2BA2E7B3' OR ReferenceNo LIKE '%50e907e5%'
    `);
    console.log(ptd.recordset);

    console.log("\n=== Checking CashInEntry ===");
    const cie = await pool.request().query(`
      SELECT * FROM CashInEntry 
      WHERE ReferenceNo = 'E32129D2-B468-4C20-A37B-145B2BA2E7B3' OR Amount = 349 OR Amount = 200
    `);
    console.log(cie.recordset);

    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDetails();
