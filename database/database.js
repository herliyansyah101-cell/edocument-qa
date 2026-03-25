const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database/edocument.db", (err) => {
  if (err) {
    console.error("Database error:", err.message);
  } else {
    console.log("Database connected");
  }
});

db.serialize(() => {

  // TABLE DOCUMENTS
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_dokumen TEXT,
      kategori TEXT,
      kode_produk TEXT,
      produk TEXT,
      batch TEXT,
      tahun INTEGER,
      lemari TEXT,
      rak TEXT,
      box TEXT,
      status TEXT,
      coa INTEGER,
      chp_qa INTEGER,
      em INTEGER,
      wfi INTEGER,
      chp_qc INTEGER,
      approve_manager INTEGER,
      is_deleted INTEGER DEFAULT 0
    )
  `);

  // 🔥 TAMBAH KOLOM (SAFE)
  db.run(`ALTER TABLE documents ADD COLUMN kode_produk TEXT`, (err) => {
    if(err){
      console.log("kode_produk mungkin sudah ada");
    } else {
      console.log("kode_produk berhasil ditambahkan");
    }
  });

  db.run(`ALTER TABLE documents ADD COLUMN chp_qc INTEGER`, (err) => {
    if(err){
     console.log("chp_qc mungkin sudah ada");
   } else {
    console.log("chp_qc berhasil ditambahkan");
   }
  });

  // TABLE USERS
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  // TABLE PEMINJAMAN
  db.run(`
    CREATE TABLE IF NOT EXISTS peminjaman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dokumen_id INTEGER,
      nama TEXT,
      tanggal_pinjam TEXT,
      status TEXT
    )
  `);

  // TABLE LOG AKTIVITAS
  db.run(`
    CREATE TABLE IF NOT EXISTS log_aktivitas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dokumen_id INTEGER,
      field TEXT,
      value INTEGER,
      user TEXT,
      waktu TEXT
    )
  `);

  // INSERT USER
  db.run(`
    INSERT OR IGNORE INTO users (email, password, role)
    VALUES 
    ('admin@fimafarma.com','123','admin'),
    ('user@fimafarma.com','123','user')
  `);

});

db.run(`ALTER TABLE documents ADD COLUMN line TEXT`, (err) => {
  if(err){
    console.log("line mungkin sudah ada");
  } else {
    console.log("line berhasil ditambahkan");
  }
});

db.run(`ALTER TABLE peminjaman ADD COLUMN tanggal_kembali TEXT`, (err) => {
  if(err){
    console.log("tanggal_kembali mungkin sudah ada");
  } else {
    console.log("tanggal_kembali berhasil ditambahkan");
  }
});

module.exports = db;