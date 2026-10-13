# HRMS - Human Resource Management System

A professional MERN web app with a mobile-first responsive design featuring authentication, employee registration, and dashboard management.

## Features

✅ **Mobile-First Responsive Design** - Works seamlessly on mobile, tablet, and desktop
✅ **Black & White Theme** - Professional minimalist UI
✅ **Smooth Animations** - Beautiful transitions and hover effects
✅ **Login System** - Secure JWT-based authentication
✅ **User Registration** - Email, Employee ID, Manager selection via dropdown
✅ **Dashboard** - User profile, attendance tracking, quick actions
✅ **Manager Assignment** - Select manager during registration from dropdown
✅ **MongoDB Integration** - Connected with provided MongoDB Atlas

## Tech Stack

**Backend:**
- Node.js + Express
- MongoDB (Mongoose)
- JWT Authentication
- Bcrypt for password hashing

**Frontend:**
- React 18
- React Router
- Axios
- CSS3 with animations

## Project Structure

```
HRMS/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   └── Manager.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── manager.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   └── Dashboard.js
    │   ├── styles/
    │   │   └── global.css
    │   ├── App.js
    │   └── index.js
    ├── package.json
    └── .env
```

## Setup Instructions

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Update `.env` file (already configured with MongoDB):
```
PORT=5000
MONGODB_URI=mongodb+srv://dibyanjayapanda25_db_user:9bmOyqUKeHnjsYM2@cluster0.flfpwgp.mongodb.net/?appName=Cluster0
JWT_SECRET=your_jwt_secret_key_here_change_in_production
NODE_ENV=development
```

4. Start the server:
```bash
npm run dev
```
Server will run on `http://hrms-bk2g.onrender.com/`

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the React app:
```bash
npm start
```
App will open on `http://localhost:5000`

## API Endpoints

### Authentication
- **POST** `/api/auth/register` - Register new user
- **POST** `/api/auth/login` - Login user
- **GET** `/api/auth/me` - Get current user (requires auth token)

### Managers
- **GET** `/api/managers` - Get all managers
- **POST** `/api/managers` - Create new manager (for setup)

## Sample Manager Data (Create in MongoDB)

Before registering users, create managers:

```json
{
  "managerId": "MGR001",
  "name": "John Doe",
  "email": "john@company.com",
  "department": "Engineering"
}
```

## Features Details

### Login Page
- Email and password fields
- Form validation
- Error handling with animations
- Link to register page
- Smooth transitions

### Register Page
- Email field
- Employee ID field
- Manager selection dropdown
- Password fields (with confirmation)
- Form validation
- Server-side duplicate checking
- Link to login page

### Dashboard
- Welcome message with user email
- Quick action cards (Check In, Analytics, Tasks)
- Navigation tabs (Home, Profile, Attendance)
- Profile section showing:
  - Email
  - Employee ID
  - Manager info with department
- Attendance tracking
- Logout functionality

## Design Highlights

✨ **Black & White Theme** - Elegant and professional
✨ **Smooth Animations** - Fade-in, slide-up, hover effects
✨ **Mobile Responsive** - Optimized for all screen sizes
✨ **Interactive Elements** - Buttons with hover/click animations
✨ **Tab Navigation** - Easy switching between sections
✨ **Professional Cards** - Clean card-based layout

## Responsive Breakpoints

- **Mobile**: 0-480px
- **Tablet**: 481px-768px
- **Desktop**: 769px+

## Authentication Flow

1. User registers with email, employee ID, and manager selection
2. Password is hashed using bcrypt
3. JWT token is generated and stored in localStorage
4. Token is sent with each request via Authorization header
5. Dashboard is protected and requires valid token
6. Logout clears token and redirects to login

## Notes

- All environment variables are in `.env` files
- MongoDB connection is pre-configured
- Ensure both backend and frontend are running
- Use mobile viewport for best experience
- All animations are smooth and responsive

## Future Enhancements

- Attendance punch in/out functionality
- Leave management system
- Department management
- Reports and analytics
- Email notifications
- Mobile app version
- Dark mode toggle

## License

MIT

---

**Happy coding!** 🚀
