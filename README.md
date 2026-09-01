# SWAT4 - Samba 4 Web Administration Tool

Modern web panel for managing Samba 4 Active Directory.

## Quick Start

```bash
docker compose up -d --build
```

The `samba-dc` service builds from `./samba-dc`, which is part of the
separate [samba-ad-fs](https://github.com/fernandobayit/samba-ad-fs)
project — clone it at `./samba-dc` first (or deploy against an existing
Samba AD DC using `docker-compose.prod.yml`).

Then access:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs

### Default Credentials
- **Username**: `administrator`
- **Password**: the one set via `SAMBA_ADMIN_PASSWORD` in your `.env` (copy from `.env.example`)

## Architecture

| Service | Port | Technology |
|---------|------|-----------|
| Frontend | 3000 | Next.js 14 |
| Backend | 8000 | Python FastAPI |
| Samba DC | 389 | Samba 4 AD DC |

## Features

- 🔐 LDAP Authentication (Domain Users / Account Operators)
- 👤 User Management (CRUD + enable/disable)
- 👥 Security Group Management (CRUD + members)
- 📋 Group Policy (GPO) Management
- 💾 Share Management (smb.conf)
- 📝 Log Viewer (real-time)
- 🌍 Multi-language (PT / EN / ES)
- 🎨 Modern UI based on saxis.net
