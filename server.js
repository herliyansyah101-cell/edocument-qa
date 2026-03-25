const express = require("express");
const path = require("path");
const db = require("./database/database");

const app = express();
const port = 3000;

// ================= MIDDLEWARE =================
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// ================= MIDDLEWARE AUTH =================
function auth(req, res, next) {

  const role = req.headers.role;

  if (!role) {
    return res.status(401).json({ error: "Belum login" });
  }

  req.role = role;

  next();
}

// ================= ADMIN ONLY =================
function adminOnly(req, res, next) {

  if (req.role !== "admin") {
    return res.status(403).json({ error: "Akses ditolak" });
  }

  next();
}

// ================= ROOT =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================= LOGIN =================
app.post("/api/login", (req, res) => {

  const { username, password } = req.body;

  db.get(`
    SELECT * FROM users 
    WHERE email = ? AND password = ?
  `, [username, password], (err, row) => {

    if (err || !row) {
      return res.json({ success: false });
    }

    res.json({
      success: true,
      user: row
    });
  });
});

// ================= REGISTER =================
app.post("/api/register", (req, res) => {

  const { email, password } = req.body;

  db.run(`
    INSERT INTO users (email, password, role)
    VALUES (?, ?, 'user')
  `, [email, password], function (err) {

    if (err) return res.send("Email sudah terdaftar");

    res.send("Register berhasil");
  });
});

// ================= DOKUMEN =================

// CREATE
app.post("/api/dokumen", (req, res) => {

  const d = req.body;

  const sql = `
    INSERT INTO documents 
    (nomor_dokumen, kategori, kode_produk, produk, batch, tahun, line,
     lemari, rak, box, status,
     coa, chp_qa, em, wfi, chp_qc, approve_manager)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(sql, [
    d.nomor,
    d.kategori,
    d.kode_produk,
    d.produk,
    d.batch,
    d.tahun,
    d.line,
    d.lemari,
    d.rak,
    d.box,
    "draft",
    d.coa,
    d.chp_qa,
    d.em,
    d.wfi,
    d.chp_qc,
    d.approve_manager
  ], function (err) {

    if (err) return res.send("Gagal simpan");

    res.send("Berhasil simpan");
  });
});

// READ
app.get("/api/dokumen", (req, res) => {

  db.all("SELECT * FROM documents WHERE is_deleted = 0", [], (err, rows) => {
    if (err) return res.json([]);
    res.json(rows);
  });
});

// EDIT
app.post("/api/edit-dokumen", (req, res) => {

  const { id, kode_produk, produk, batch, tahun, line } = req.body;

  db.run(`
    UPDATE documents 
    SET kode_produk=?, produk=?, batch=?, tahun=?, line=?
    WHERE id=?
  `, [kode_produk, produk, batch, tahun, line, id], function (err) {

    if (err) return res.send("Gagal edit");

    res.send("Berhasil diupdate");
  });
});

// DELETE (soft delete)
app.post("/api/hapus-dokumen", (req, res) => {

  const { id } = req.body;

  db.run("UPDATE documents SET is_deleted = 1 WHERE id = ?", [id], function (err) {

    if (err) return res.send("Gagal hapus");

    res.send("Dokumen berhasil dihapus");
  });
});

// ================= CHECKLIST =================
app.post("/api/update-checklist", (req, res) => {

  const { id, field, value } = req.body;

  const allowed = ["coa", "chp_qa", "em", "chp_qc", "approve_manager"];

  if (!allowed.includes(field)) {
    return res.send("Field tidak valid");
  }

  db.run(`UPDATE documents SET ${field}=? WHERE id=?`, [value, id], function (err) {

    if (err) return res.send("Gagal update");

    res.send("Berhasil update");
  });
});

// ================= LOKASI =================
app.post("/api/set-lokasi", (req, res) => {

  const { id, lemari, rak, box } = req.body;

  db.run(`
    UPDATE documents 
    SET lemari=?, rak=?, box=?, status='tersedia'
    WHERE id=?
  `, [lemari, rak, box, id], function (err) {

    if (err) return res.send("Gagal set lokasi");

    res.send("Lokasi berhasil disimpan");
  });
});

// ================= MONITORING =================
app.get("/api/monitoring-full", (req, res) => {

  db.all(`
    SELECT * FROM documents WHERE is_deleted=0
  `, (err, rows) => {

    if (err) return res.json([]);

    res.json(rows);
  });
});

app.get("/api/dokumen-detail", (req, res) => {

  const { lemari, rak, box } = req.query;

  db.all(`
    SELECT * FROM documents
    WHERE lemari=? AND rak=? AND box=? AND is_deleted=0
  `, [lemari, rak, box], (err, rows) => {

    if (err) return res.json([]);

    res.json(rows);
  });
});

// ================= PEMINJAMAN =================

// REQUEST PINJAM
app.post("/api/pinjam", (req, res) => {

  const { dokumen_id, nama } = req.body;

  db.run(`
    INSERT INTO peminjaman 
    (dokumen_id, nama, tanggal_pinjam, status)
    VALUES (?, ?, date('now'), 'menunggu')
  `, [dokumen_id, nama], function (err) {

    if (err) return res.json({ error: true });

    res.json({ success: true });
  });
});

// LIST
app.get("/api/peminjaman", (req, res) => {

  db.all(`
    SELECT p.*, d.kategori, d.kode_produk, d.batch, d.lemari, d.rak, d.box
    FROM peminjaman p
    LEFT JOIN documents d ON p.dokumen_id = d.id
    ORDER BY p.id DESC
  `, [], (err, rows) => {

    if (err) return res.json([]);

    res.json(rows);
  });
});

// APPROVE
app.post("/api/approve", (req, res) => {

  const { id } = req.body;

  db.get(`SELECT dokumen_id FROM peminjaman WHERE id=?`, [id], (err, row) => {

    if (!row) return res.json({ error: true });

    const dokId = row.dokumen_id;

    db.run(`UPDATE peminjaman SET status='dipinjam' WHERE id=?`, [id]);
    db.run(`UPDATE documents SET status='dipinjam' WHERE id=?`, [dokId]);

    res.json({ success: true });
  });
});

// KEMBALIKAN
app.post("/api/kembalikan", (req, res) => {

  const { id } = req.body;

  db.get(`SELECT dokumen_id FROM peminjaman WHERE id=?`, [id], (err, row) => {

    if (!row) return res.json({ error: true });

    const dokId = row.dokumen_id;

    db.run(`
      UPDATE peminjaman 
      SET status='selesai', tanggal_kembali=date('now')
      WHERE id=?
    `, [id]);

    db.run(`UPDATE documents SET status='tersedia' WHERE id=?`, [dokId]);

    res.json({ success: true });
  });
});

// ================= DASHBOARD =================
app.get("/api/dashboard", (req, res) => {

  db.serialize(() => {

    let result = {};

    db.get("SELECT COUNT(*) as total FROM documents WHERE is_deleted = 0", (err, r1) => {
      result.total = r1.total;

      db.get(`SELECT COUNT(*) as dipinjam FROM peminjaman p LEFT JOIN documents d ON p.dokumen_id = d.id WHERE p.status='dipinjam' AND d.is_deleted = 0`, (err, r2) => {
        result.dipinjam = r2.dipinjam;

        db.get(`SELECT COUNT(*) as request FROM peminjaman p LEFT JOIN documents d ON p.dokumen_id = d.id WHERE p.status='menunggu' AND d.is_deleted = 0`, (err, r3) => {
          result.request = r3.request;

          res.json(result);
        });
      });
    });

  });
});

// ================= START =================
app.listen(port, () => {
  console.log(`Server jalan di http://localhost:${port}`);
});

// ================= USER MANAGEMENT =================

// GET USERS
app.get("/api/users", auth, adminOnly, (req, res) => {
  db.all("SELECT id, email, role FROM users", [], (err, rows) => {
    if(err) return res.json([]);
    res.json(rows);
  });
});

// ADD USER
app.post("/api/add-user", auth, adminOnly, (req, res) => {

  const { email, password, role } = req.body;

  db.run(`
    INSERT INTO users (email, password, role)
    VALUES (?, ?, ?)
  `, [email, password, role], function(err){

    if(err) return res.send("Email sudah ada");

    res.send("User berhasil ditambahkan");
  });

});

// DELETE USER
app.post("/api/delete-user", auth, adminOnly, (req, res) => {

  const { id } = req.body;

  db.run("DELETE FROM users WHERE id = ?", [id], function(err){

    if(err) return res.send("Gagal hapus");

    res.send("User dihapus");
  });

});

// UPDATE ROLE
app.post("/api/update-role", auth, adminOnly, (req, res) => {

  const { id, role } = req.body;

  db.run("UPDATE users SET role = ? WHERE id = ?", [role, id], function(err){

    if(err) return res.send("Gagal update");

    res.send("Role diubah");
  });

});