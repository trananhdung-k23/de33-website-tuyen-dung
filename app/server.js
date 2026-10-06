const express = require('express');
const mysql = require('mysql2');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpassword',
  database: process.env.DB_NAME || 'job_board_db',
  waitForConnections: true,
  connectionLimit: 10
});

// Header HTML chung (Bootstrap 5)
const getHeader = (activeTab) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portal Tuyển Dụng Job Board</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css">
</head>
<body class="bg-light">
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm mb-4">
    <div class="container">
      <a class="navbar-brand fw-bold fs-4" href="/">💼 JOB BOARD PORTAL</a>
      <div class="collapse navbar-collapse">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item me-2">
            <a class="nav-link btn btn-outline-light text-white ${activeTab === 'candidate' ? 'active fw-bold' : ''}" href="/">
              👨‍🎓 Dành Cho Ứng Viên
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link btn btn-warning text-dark fw-bold ${activeTab === 'employer' ? 'active' : ''}" href="/employer">
              🏢 Dành Cho Nhà Tuyển Dụng
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  <div class="container">
`;

const footer = `
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
`;

// ==========================================
// 1. TÁC NHÂN 1: ỨNG VIÊN (Cổng /)
// ==========================================
app.get('/', (req, res) => {
  const search = req.query.search || '';
  let sql = 'SELECT * FROM jobs';
  let params = [];

  if (search) {
    sql += ' WHERE title LIKE ? OR company LIKE ? OR description LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  sql += ' ORDER BY id DESC';

  db.query(sql, params, (err, jobs) => {
    if (err) return res.status(500).send('Lỗi kết nối CSDL');

    let jobList = jobs.map(job => `
      <div class="col-md-6 mb-4">
        <div class="card h-100 shadow-sm border-0">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <h5 class="card-title text-primary fw-bold mb-0">${job.title}</h5>
              <span class="badge bg-info text-dark">${job.job_type}</span>
            </div>
            <h6 class="card-subtitle text-muted mb-3"><i class="bi bi-building"></i> ${job.company}</h6>
            <div class="mb-3">
              <span class="badge bg-light text-dark border me-1">📍 ${job.location}</span>
              <span class="badge bg-light text-success border">💰 ${job.salary}</span>
            </div>
            <p class="card-text text-secondary">${job.description}</p>
          </div>
          <div class="card-footer bg-white border-0 pb-3">
            <button class="btn btn-success w-100 fw-bold" data-bs-toggle="modal" data-bs-target="#applyModal${job.id}">
              📝 Đăng Ký Nộp CV Ứng Tuyển
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Nộp CV -->
      <div class="modal fade" id="applyModal${job.id}" tabindex="-1">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header bg-success text-white">
              <h5 class="modal-title">Nộp Hồ Sơ: ${job.title}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <form action="/candidate/apply" method="POST">
              <div class="modal-body">
                <input type="hidden" name="job_id" value="${job.id}">
                <div class="mb-3">
                  <label class="form-label fw-bold">Họ và Tên Ứng Viên</label>
                  <input type="text" name="candidate_name" class="form-control" placeholder="Nguyễn Văn A" required>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Email Liên Hệ</label>
                  <input type="email" name="email" class="form-control" placeholder="ungvien@gmail.com" required>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Số Điện Thoại</label>
                  <input type="tel" name="phone" class="form-control" placeholder="0987654321" required>
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Link Đống Đính Kèm CV (Drive/LinkedIn/PDF)</label>
                  <input type="url" name="cv_link" class="form-control" placeholder="https://drive.google.com/my-cv.pdf" required>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
                <button type="submit" class="btn btn-success fw-bold">Gửi Hồ Sơ Ứng Tuyển</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `).join('');

    let html = getHeader('candidate') + `
      <div class="p-4 bg-white rounded-3 shadow-sm mb-4">
        <h2 class="fw-bold text-dark mb-2">🔍 Cổng Tìm Kiếm Việc Làm Cho Ứng Viên</h2>
        <p class="text-muted">Tìm kiếm công việc mơ ước và gửi CV ứng tuyển trực tiếp tới Nhà tuyển dụng.</p>
        <form action="/" method="GET" class="row g-2 mt-2">
          <div class="col-md-9">
            <input type="text" name="search" class="form-control form-control-lg" placeholder="Nhập tên công việc, công ty..." value="${search}">
          </div>
          <div class="col-md-3">
            <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold">Tìm Việc Nhanh</button>
          </div>
        </form>
      </div>

      <h4 class="fw-bold mb-3">Danh Sách Việc Làm Đang Tuyển (${jobs.length})</h4>
      <div class="row">
        ${jobList.length > 0 ? jobList : '<div class="alert alert-warning text-center">Chưa có tin tuyển dụng nào.</div>'}
      </div>
    ` + footer;

    res.send(html);
  });
});

// Xử lý nộp CV của Ứng viên
app.post('/candidate/apply', (req, res) => {
  const { job_id, candidate_name, email, phone, cv_link } = req.body;
  db.query(
    'INSERT INTO applications (job_id, candidate_name, email, phone, cv_link) VALUES (?, ?, ?, ?, ?)',
    [job_id, candidate_name, email, phone, cv_link],
    (err) => {
      if (err) return res.status(500).send('Lỗi khi đăng ký nộp CV');
      res.redirect('/?status=success');
    }
  );
});

// ==========================================
// 2. TÁC NHÂN 2: NHÀ TUYỂN DỤNG (Cổng /employer)
// ==========================================
app.get('/employer', (req, res) => {
  const sqlJobs = 'SELECT * FROM jobs ORDER BY id DESC';
  const sqlApps = `
    SELECT applications.*, jobs.title as job_title, jobs.company 
    FROM applications 
    JOIN jobs ON applications.job_id = jobs.id 
    ORDER BY applications.id DESC
  `;

  db.query(sqlJobs, (err, jobs) => {
    if (err) return res.status(500).send('Lỗi CSDL');

    db.query(sqlApps, (err2, apps) => {
      if (err2) return res.status(500).send('Lỗi CSDL');

      let postedJobsRows = jobs.map(j => `
        <tr>
          <td><strong>${j.title}</strong></td>
          <td>${j.company}</td>
          <td>${j.location} | ${j.salary}</td>
          <td><small>${j.employer_email}</small></td>
          <td><small>${new Date(j.created_at).toLocaleDateString('vi-VN')}</small></td>
        </tr>
      `).join('');

      let appRows = apps.map((a, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong class="text-primary">${a.candidate_name}</strong></td>
          <td>${a.email}<br><small class="text-muted">${a.phone}</small></td>
          <td><span class="badge bg-secondary">${a.job_title}</span></td>
          <td><a href="${a.cv_link}" target="_blank" class="btn btn-sm btn-outline-primary">📄 Xem CV Ứng Viên</a></td>
          <td><small>${new Date(a.applied_at).toLocaleString('vi-VN')}</small></td>
        </tr>
      `).join('');

      let html = getHeader('employer') + `
        <div class="row mb-4">
          <div class="col-md-12 d-flex justify-content-between align-items-center bg-white p-3 rounded-3 shadow-sm">
            <div>
              <h3 class="fw-bold mb-0">🏢 Cổng Quản Lý Cho Nhà Tuyển Dụng</h3>
              <p class="text-muted mb-0">Đăng bài tuyển dụng mới và xem danh sách hồ sơ Ứng viên nộp CV</p>
            </div>
            <button class="btn btn-warning btn-lg fw-bold" data-bs-toggle="modal" data-bs-target="#postJobModal">
              + Đăng Tin Tuyển Dụng Mới
            </button>
          </div>
        </div>

        <!-- Bảng 1: Quản lý Hồ sơ CV Ứng viên gửi về -->
        <div class="card border-0 shadow-sm mb-4">
          <div class="card-header bg-dark text-white fw-bold py-3">
            📋 Danh Sách CV Ứng Viên Đã Nộp Tuyển Dụng (${apps.length})
          </div>
          <div class="card-body p-0">
            <table class="table table-hover align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>#</th>
                  <th>Họ Tên Ứng Viên</th>
                  <th>Thông Tin Liên Hệ</th>
                  <th>Vị Trí Ứng Tuyển</th>
                  <th>Hồ Sơ CV</th>
                  <th>Ngày Nộp</th>
                </tr>
              </thead>
              <tbody>
                ${appRows.length > 0 ? appRows : '<tr><td colspan="6" class="text-center py-3 text-muted">Chưa có ứng viên nào nộp CV.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Bảng 2: Danh sách các tin tuyển dụng đã đăng -->
        <div class="card border-0 shadow-sm">
          <div class="card-header bg-secondary text-white fw-bold py-3">
            📌 Các Tin Tuyển Dụng Đã Đăng (${jobs.length})
          </div>
          <div class="card-body p-0">
            <table class="table table-striped mb-0">
              <thead>
                <tr>
                  <th>Tiêu Đề Work</th>
                  <th>Công Ty</th>
                  <th>Địa Điểm & Lương</th>
                  <th>Email Nhà Tuyển Dụng</th>
                  <th>Ngày Đăng</th>
                </tr>
              </thead>
              <tbody>
                ${postedJobsRows.length > 0 ? postedJobsRows : '<tr><td colspan="5" class="text-center py-3 text-muted">Chưa có bài đăng nào.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Đăng tin tuyển dụng -->
        <div class="modal fade" id="postJobModal" tabindex="-1">
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header bg-warning">
                <h5 class="modal-title fw-bold">Tạo Bài Đăng Tuyển Dụng Mới</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <form action="/employer/jobs" method="POST">
                <div class="modal-body">
                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Tiêu Đề Tuyển Dụng</label>
                      <input type="text" name="title" class="form-control" placeholder="VD: Lập trình viên Backend" required>
                    </div>
                    <div class="col-md-6 mb-3">
                      <label class="form-label fw-bold">Tên Công Ty / Doanh Nghiệp</label>
                      <input type="text" name="company" class="form-control" placeholder="VD: Công ty Công nghệ ABC" required>
                    </div>
                  </div>
                  <div class="row">
                    <div class="col-md-4 mb-3">
                      <label class="form-label fw-bold">Địa Điểm Làm Việc</label>
                      <input type="text" name="location" class="form-control" placeholder="VD: Hà Nội / Remote" required>
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label fw-bold">Mức Lương Dự Kiến</label>
                      <input type="text" name="salary" class="form-control" placeholder="VD: 15 - 25 Triệu" required>
                    </div>
                    <div class="col-md-4 mb-3">
                      <label class="form-label fw-bold">Hình Thức</label>
                      <select name="job_type" class="form-select">
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Remote">Remote</option>
                      </select>
                    </div>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-bold">Email Liên Hệ Nhà Tuyển Dụng</label>
                    <input type="email" name="employer_email" class="form-control" placeholder="hr@company.com" required>
                  </div>
                  <div class="mb-3">
                    <label class="form-label fw-bold">Mô Tả Chi Tiết Công Việc & Yêu Cầu</label>
                    <textarea name="description" class="form-control" rows="4" placeholder="Nhập các thông tin mô tả công việc..." required></textarea>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                  <button type="submit" class="btn btn-warning fw-bold">Đăng Bài Ngay</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ` + footer;

      res.send(html);
    });
  });
});

// Xử lý tạo tin tuyển dụng mới
app.post('/employer/jobs', (req, res) => {
  const { title, company, location, salary, job_type, employer_email, description } = req.body;
  db.query(
    'INSERT INTO jobs (title, company, location, salary, job_type, employer_email, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, company, location, salary, job_type, employer_email, description],
    (err) => {
      if (err) return res.status(500).send('Lỗi khi đăng tin tuyển dụng');
      res.redirect('/employer');
    }
  );
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server Job Board đang chạy tại cổng ${PORT}`);
});
