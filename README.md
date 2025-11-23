# 🎯 Assistant Attendance System

A GPS-based attendance tracking system for educational assistants with real-time location validation.

![Status](https://img.shields.io/badge/status-active-success.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## 🚀 Quick Start (Windows)

### Option 1: Use Batch Scripts (Recommended)

1. **Setup Database:**
   ```batch
   setup-database.bat
   ```

2. **Start Application:**
   ```batch
   start-app.bat
   ```

3. **Access the System:**
   - Admin Dashboard: http://localhost:8080/frontend/admin/
   - Assistant PWA: http://localhost:8080/frontend/assistant/

4. **Stop Application:**
   ```batch
   stop-app.bat
   ```

### Option 2: Manual Setup

See [docs/QUICK_START.md](docs/QUICK_START.md) for detailed instructions.

---

## 📚 Documentation

All documentation is organized in the **[`docs/`](docs/)** folder:

### 🏁 Getting Started
- **[BATCH_SCRIPTS_GUIDE.md](docs/BATCH_SCRIPTS_GUIDE.md)** - How to use the batch scripts
- **[WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md)** - Windows-specific setup
- **[QUICK_START.md](docs/QUICK_START.md)** - Quick start guide
- **[CREDENTIALS.md](docs/CREDENTIALS.md)** - Test accounts and passwords

### 📖 Configuration & Setup
- **[SETUP_INSTRUCTIONS.md](docs/SETUP_INSTRUCTIONS.md)** - Detailed setup guide
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### 🏗️ Architecture & Design
- **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** - Folder structure
- **[assistant_attendance_system.md](docs/assistant_attendance_system.md)** - System design
- **[API.md](docs/API.md)** - Complete API reference
- **[geofence_osm_guide.md](docs/geofence_osm_guide.md)** - GPS implementation

📋 **[View Full Documentation Index](docs/README.md)**

---

## ✨ Features

### 👤 For Assistants
- ✅ GPS-based attendance marking (30m radius validation)
- ✅ View today's assigned sessions
- ✅ Real-time location tracking with OpenStreetMap
- ✅ Installable as Progressive Web App (PWA)
- ✅ Offline support with service worker

### 👨‍💼 For Admins
- ✅ Dashboard with statistics
- ✅ Manage centers (CRUD with map)
- ✅ Manage assistants and sessions
- ✅ View attendance reports
- ✅ Export data to CSV

### 🔧 Technical
- ✅ RESTful API with JWT authentication
- ✅ MySQL database with proper relationships
- ✅ Role-based access control
- ✅ Haversine formula for distance calculation
- ✅ OpenStreetMap (free, no API key needed)

---

## 🏗️ Project Structure

```
asist web/
├── backend/              # Node.js + Express API
│   ├── config/          # Database & JWT config
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth & role checking
│   ├── models/          # Database queries
│   ├── routes/          # API routes
│   └── server.js        # Main server file
│
├── frontend/
│   ├── admin/           # Admin dashboard
│   ├── assistant/       # Assistant PWA
│   └── shared/          # Shared resources
│
├── database/
│   ├── schema.sql       # Database structure
│   └── seed.sql         # Sample data
│
├── docs/                # 📚 All documentation
│
├── setup-database.bat   # Database setup script
├── start-app.bat        # Start all servers
└── stop-app.bat         # Stop all servers
```

---

## 🔐 Test Credentials

### Admin Account
```
Email:    admin@attendance.com
Password: Admin@2024
```

### Assistant Account
```
Email:    assistant1@attendance.com
Password: Assistant@2024
```

See [docs/CREDENTIALS.md](docs/CREDENTIALS.md) for all test accounts.

---

## 🛠️ Technology Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | Node.js, Express.js |
| **Database** | MySQL |
| **Authentication** | JWT (JSON Web Tokens) |
| **Frontend** | HTML5, CSS3, JavaScript (Vanilla) |
| **Maps** | Leaflet.js + OpenStreetMap |
| **PWA** | Service Workers, Web Manifest |
| **GPS** | Geolocation API + Haversine Formula |

---

## 📋 Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - [Download](https://dev.mysql.com/downloads/mysql/)

---

## 🐛 Troubleshooting

Having issues? Check the **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** for common problems and solutions.

Common issues:
- Database connection errors
- CORS issues
- GPS not working
- Server startup problems

---

## 📞 Support

- 📖 **Documentation**: [docs/](docs/)
- 🐛 **Issues**: Check [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- 📧 **Questions**: See documentation files for detailed guides

---

## 📄 License

This project is licensed under the MIT License.

---

## 🎓 Next Steps

1. ✅ Run `setup-database.bat` to create the database
2. ✅ Edit `backend\.env` with your MySQL password
3. ✅ Run `start-app.bat` to start the application
4. ✅ Login with test credentials
5. ✅ Explore the system!

**For detailed instructions, see [docs/BATCH_SCRIPTS_GUIDE.md](docs/BATCH_SCRIPTS_GUIDE.md)**

---

**Built with ❤️ using HTML, CSS, JavaScript, Node.js, Express, MySQL, and OpenStreetMap**
