# Project Management System

A web-based Project Management System developed as a Software Engineering project. It helps teams manage projects, members, tasks, deadlines, priorities, and progress.

## Live Demo

**[Open the Project Management System](https://project-management-system-se-projec.vercel.app/dashboard)**

You can access the deployed application directly without installing it locally.

## Demo Login Credentials

Use either of the following accounts to explore the application:

| Role | Email | Password |
|---|---|---|
| Admin | admin@pms.com | Admin@123 |
| Team Member | member@pms.com | TestMember123! |

> **Note:** These are demo credentials intended only for testing. Do not use these accounts for real or confidential data. Since this README is public, anyone can view these credentials.

## Features

- User authentication and role-based access.
- Project creation and management.
- Project member management.
- Task creation, assignment, and tracking.
- Task priorities, deadlines, and status updates.
- Task comments.
- Dashboard with project and task summaries.

## Technology Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** MongoDB
- **Authentication:** bcrypt password hashing and session management

## Run Locally

### Prerequisites

- Python 3.12+
- Node.js and npm
- MongoDB

### 1. Clone the repository

```bash
git clone https://github.com/PMS-SE-Project/Project-Management-System-SE-Project.git
cd Project-Management-System-SE-Project
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
```

Configure the backend environment variables using `.env.example`, then start the server:

```bash
uvicorn app.main:app --reload
```

Backend: `http://127.0.0.1:8000`

API documentation: `http://127.0.0.1:8000/docs`

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually `http://localhost:5173`.

## Database

The application uses MongoDB. The default local configuration is:

```env
MONGO_URI=mongodb://127.0.0.1:27017
DATABASE_NAME=pms_db
```

Main collections: `users`, `sessions`, `projects`, `tasks`, and `task_comments`.

## Testing

Run backend tests from the `backend` directory:

```bash
pytest -v -ra
```

Build the frontend:

```bash
cd frontend
npm run build
```

Run frontend linting:

```bash
npm run lint
```

## Project Structure

```text
Project-Management-System-SE-Project/
├── backend/
│   └── app/
│       ├── auth/
│       ├── database/
│       ├── routes/
│       └── schemas/
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── services/
└── README.md
```

## Current Limitations

Milestone management, notifications, audit logs, and a dedicated report-generation feature are not yet implemented.

## Contributors

**Group 4 | Semester 5 | Section I**

- Sphoorthi Pulipati — QA Lead
- Sowmya Ramesh — Developer
- Tanisha Dalmia — Project Manager
- Suhas Prusty — Test Engineer
