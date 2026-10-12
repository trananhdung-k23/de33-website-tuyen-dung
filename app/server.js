const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const possibleDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '..', 'public'),
  path.join(__dirname, 'views'),
  path.join(__dirname, '..', 'views'),
  __dirname
];

possibleDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
  }
});

function resolveHtmlFile(filename) {
  for (const dir of possibleDirs) {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return path.join(__dirname, 'public', filename);
}

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'job_board',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function ensureColumn(table, column, definition) {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`✅ Đã bổ sung cột '${column}' vào bảng '${table}'.`);
    }
  } catch (err) {
    console.error(`Lỗi kiểm tra cột ${column}:`, err.message);
  }
}

async function initDatabase() {
  let connected = false;
  while (!connected) {
    try {
      pool = mysql.createPool(dbConfig);
      const connection = await pool.getConnection();
      connection.release();
      console.log('✅ Đã kết nối thành công tới MySQL Database.');

      // Bảng jobs
      await pool.query(`
        CREATE TABLE IF NOT EXISTS jobs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          company VARCHAR(255) NOT NULL,
          location VARCHAR(255) NOT NULL,
          salary VARCHAR(100) NOT NULL,
          type VARCHAR(50) DEFAULT 'Full-time',
          hr_email VARCHAR(255) NOT NULL,
          hr_phone VARCHAR(50),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await ensureColumn('jobs', 'type', "VARCHAR(50) DEFAULT 'Full-time'");
      await ensureColumn('jobs', 'hr_email', "VARCHAR(255) NOT NULL DEFAULT 'hr@company.com'");
      await ensureColumn('jobs', 'hr_phone', "VARCHAR(50)");
      await ensureColumn('jobs', 'description', "TEXT");

      // Bảng applications
      await pool.query(`
        CREATE TABLE IF NOT EXISTS applications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_id INT NOT NULL,
          candidate_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          resume_link VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        )
      `);

      await ensureColumn('applications', 'phone', "VARCHAR(50)");
      await ensureColumn('applications', 'resume_link', "VARCHAR(255)");

      connected = true;
      console.log('✅ Khởi tạo Cơ sở dữ liệu hoàn tất thành công.');
    } catch (error) {
      console.log('⏳ Đang chờ MySQL kết nối... thử lại sau 3 giây.');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

initDatabase();

app.get('/api/jobs', async (req, res) => {
  try {
    const searchQuery = req.query.q ? `%${req.query.q}%` : '%';

    const sql = `
      SELECT j.*, 
             IF(COUNT(a.id) > 0, 1, 0) AS is_applied
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE j.title LIKE ? OR j.company LIKE ? OR j.location LIKE ?
      GROUP BY j.id
      ORDER BY j.created_at DESC
    `;

    const [jobs] = await pool.execute(sql, [searchQuery, searchQuery, searchQuery]);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách việc làm:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ nội bộ' });
  }
});

app.post('/api/applications', async (req, res) => {
  try {
    const { job_id, candidate_name, email, phone, resume_link } = req.body;

    if (!job_id || !candidate_name || !email) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ thông tin bắt buộc!' });
    }

    const jobIdInt = parseInt(job_id, 10);

    const sql = `
      INSERT INTO applications (job_id, candidate_name, email, phone, resume_link)
      VALUES (?, ?, ?, ?, ?)
    `;

    await pool.execute(sql, [jobIdInt, candidate_name, email, phone || '', resume_link || '']);
    res.json({ success: true, message: 'Nộp hồ sơ ứng tuyển thành công!' });
  } catch (error) {
    console.error('Lỗi khi nộp CV:', error);
    res.status(500).json({ success: false, message: 'Không thể gửi hồ sơ ứng tuyển.' });
  }
});

app.get('/api/employer/data', async (req, res) => {
  try {
    const [applications] = await pool.execute(`
      SELECT a.id, a.candidate_name, a.email, a.phone, a.resume_link, a.created_at, j.title AS job_title
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      ORDER BY a.created_at DESC
    `);

    const [jobs] = await pool.execute(`
      SELECT * FROM jobs ORDER BY created_at DESC
    `);

    res.json({ success: true, applications, jobs });
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu Nhà tuyển dụng:', error);
    res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu Nhà tuyển dụng' });
  }
});

// THÊM SỐ ĐIỆN THOẠI HR VÀO LỆNH TẠO TIN
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, company, location, salary, type, hr_email, hr_phone, description } = req.body;

    if (!title || !company || !location || !salary || !hr_email) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin tin tuyển dụng!' });
    }

    const sql = `
      INSERT INTO jobs (title, company, location, salary, type, hr_email, hr_phone, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await pool.execute(sql, [
      title,
      company,
      location,
      salary,
      type || 'Full-time',
      hr_email,
      hr_phone || '',
      description || ''
    ]);

    res.json({ success: true, message: 'Đăng tin tuyển dụng thành công!' });
  } catch (error) {
    console.error('Lỗi khi đăng tin tuyển dụng:', error);
    res.status(500).json({ success: false, message: 'Không thể tạo tin tuyển dụng.' });
  }
});

app.get('/', (req, res) => {
  const filePath = resolveHtmlFile('index.html');
  res.sendFile(filePath);
});

app.get('/employer', (req, res) => {
  const filePath = resolveHtmlFile('employer.html');
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`🚀 Job Board Portal đang chạy tại địa chỉ: http://localhost:${PORT}`);
});
