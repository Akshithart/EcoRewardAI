# EcoReward AI – Smart Waste Detection & Recycling Reward System

EcoReward AI is a modern, responsive web platform designed to encourage sustainable waste management habits. By uploading images of waste items, users receive instant AI-driven classification, weight estimations, carbon impact details, and monetary rewards.

---

## 🌟 Core Features

1. **AI Waste Detection**: Real-time waste classification (Plastic, Paper, Metal, Glass, Organic, E-waste) with bounding boxes and confidence score overlay.
2. **Carbon Impact Calculator**: Computes CO₂ saved by recycling compared to normal landfill disposal.
3. **Recycling Value Calculator**: Automatically estimates weight and calculates monetary reward values based on dynamically updated market rates.
4. **Reward & Gamification System**: Earn Eco Points, unlock status badges (Beginner, Eco Warrior, Green Hero, Sustainability Champion), and rise through user levels.
5. **Interactive Dashboard**: Full user statistics cards, interactive Chart.js graphs for weekly and monthly analytics, recent activity logs, and a community leaderboard.
6. **AI Multilingual Recycling Assistant**: Conversational AI bot supporting English, Tamil (தமிழ்), Hindi (हिन्दी), Malayalam (മലയാളം), and Telugu (తెలుగు) for FAQs, segregation tips, and local recycling advice.
7. **Recycling History**: Searchable and filterable table logs showing past uploads, status states, and image previews.
8. **Admin Control Panel**: Review submissions queue, approve/reject pending recyclables, edit recycling price/carbon factors dynamically, and manage users.
9. **Notifications System**: In-app alerts for verified uploads, level ups, unlocked badges, and notifications.
10. **Report Downloader**: Download beautiful PDF sustainability reports containing data tables and graphs.

---

## 🛠️ Directory Structure

```
waste collection/
├── backend/
│   ├── database.py       # SQLAlchemy Models & SQLite DB setup
│   ├── schemas.py        # Pydantic validation schemas
│   ├── ai_model.py       # AI models, bounding box logic & chatbot engine
│   └── main.py           # FastAPI app routes (auth, uploads, admin, chatbot)
├── frontend/
│   ├── index.html        # Single Page Application glassmorphic dashboard
│   ├── styles.css        # Custom Glassmorphic styles & animations
│   └── app.js            # Core UI, API integration, and Chart.js controls
├── requirements.txt      # Backend Python dependencies
├── run.py                # Automated installation and startup script
└── README.md             # Documentation
```

---

## 🚀 Setup & Launch Instructions

Since Node.js and NPM are not installed on your system, this project is built to run entirely inside a **Python 3 virtual environment**. All frontend static pages are served directly from the FastAPI backend.

### One-Click Startup (Recommended)
Simply execute the following command in your terminal / PowerShell at the project folder:
```powershell
python run.py
```
This script will:
1. Automatically create a local python virtual environment (`.venv`).
2. Upgrade `pip` and install all required modules from `requirements.txt`.
3. Open your default web browser to the application page: `http://127.0.0.1:8000/static/index.html`.
4. Start the backend Uvicorn server automatically.

### Manual Setup
If you prefer running commands manually:
1. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
2. Activate the virtual environment:
   - **Windows PowerShell**: `.venv\Scripts\Activate.ps1`
   - **Windows Command Prompt**: `.venv\Scripts\activate.bat`
   - **macOS/Linux**: `source .venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
5. Open your browser and navigate to `http://127.0.0.1:8000/static/index.html`.

---

## 🔐 Credentials & Testing Accounts

### 👑 System Administrator Account
Use these credentials to log in as the Administrator, view the verification queue, approve uploads, and update rates:
- **Email**: `admin@ecoreward.ai`
- **Password**: `admin123`

### 🌱 Regular User Account
Create your own user profile using the **"Create an Account"** link on the login screen to start uploading waste photos, earning points, chatting with the AI bot, and rising on the leaderboard!

---

## 🎨 Design & Theme

- **Style**: Modern Glassmorphism (translucent white/slate panels, heavy background blur filters, neon border glows).
- **Colors**: Vibrant eco-greens, emerald, mint, gold-amber accents, and sleek charcoal slates.
- **Responsiveness**: Grid-based layouts scaling smoothly between desktop views and mobile screens.
- **Animations**: Slide-in notifications, hover scaling effects, pulsing glows, and smooth transitions.
- **Dark Mode**: Fully supported, synced with system preference or manually toggled via the profile footer.
