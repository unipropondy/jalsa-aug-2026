const sql = require("mssql");
require("dotenv").config({ path: "./backend/.env" });

async function testHost(host, port) {
  const cfg = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: host,
    port: port,
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
  };
  try {
    const pool = await sql.connect(cfg);
    console.log(`SUCCESS connected to ${host}:${port}`);
    await pool.close();
  } catch (err) {
    console.log(`FAILED ${host}:${port} - ${err.message}`);
  }
}

async function run() {
  await testHost("202.156.19.151", 9199);
  process.exit(0);
}

run();
