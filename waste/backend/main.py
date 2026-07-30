import os
import shutil
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
# main.py top section-la intha import line irukkanum
from .ai_model import classify_waste_image, generate_chatbot_response, DEFAULT_POINTS, DEFAULT_CO2_SAVED, CLASSES
# Database models and session
from .database import engine, SessionLocal, init_db, User, WasteRecord, RecyclingRate, Notification

# Schemas
from .schemas import (
    UserRegister, UserLogin, Token, UserOut, WasteRecordOut,
    RecyclingRateSchema, ChatRequest, ChatResponse, DashboardStats, AdminStats, NotificationOut
)

# Initialize database
init_db()

# Secret keys for JWT
SECRET_KEY = "ecoreward_super_secret_key_987654321"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="EcoReward AI Backend", version="1.0.0")

# Setup directories for uploads and static hosting relative to frontend folder
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BASE_DIR, "frontend", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (entire frontend directory maps to /static)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "frontend")), name="static")

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Safe point lookup helper function
def safe_get_points(category: str) -> int:
    if not category:
        return 10
    # Try exact match or capitalized match
    return DEFAULT_POINTS.get(category) or DEFAULT_POINTS.get(category.title()) or 10

# Password hashing utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# JWT utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Helper to verify token in headers or query params
def get_user_from_token(token: str, db: Session):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Helper to recalculate user levels and badges
def update_user_gamification(user: User, db: Session):
    points = user.eco_points or 0
    # Level calculations: 100 points per level
    new_level = max(1, (points // 100) + 1)
    
    # Badge calculations
    new_badge = "Beginner"
    if points >= 1000:
        new_badge = "Sustainability Champion"
    elif points >= 500:
        new_badge = "Green Hero"
    elif points >= 200:
        new_badge = "Eco Warrior"
        
    old_badge = user.badge
    old_level = user.level
    
    user.level = new_level
    user.badge = new_badge
    
    # Trigger notifications for updates
    if new_level > old_level:
        db.add(Notification(
            user_id=user.id,
            message=f"🎉 Level Up! You have reached Level {new_level}!"
        ))
    if new_badge != old_badge:
        db.add(Notification(
            user_id=user.id,
            message=f"🏆 Badge Unlocked: You are now a {new_badge}!"
        ))
    db.commit()

# --- ROUTES ---

@app.post("/api/auth/register", response_model=Token)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    clean_email = user_data.email.strip().lower()
    clean_name = user_data.name.strip() if user_data.name else "User"
    clean_password = user_data.password.strip()

    print(f"\n[REGISTER TRY] Email: '{clean_email}', Name: '{clean_name}'")

    if not clean_email or not clean_password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    # Check existing user
    db_user = db.query(User).filter(User.email == clean_email).first()
    if db_user:
        print("[REGISTER FAILED] Email already registered!")
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create new user
    hashed_pwd = get_password_hash(clean_password)
    new_user = User(
        name=clean_name,
        email=clean_email,
        password_hash=hashed_pwd,
        eco_points=0,
        level=1,
        badge="Beginner",
        is_admin=False
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Welcome Notification
    try:
        db.add(Notification(
            user_id=new_user.id,
            message="🌱 Welcome to EcoReward AI! Upload your waste photo to start."
        ))
        db.commit()
    except Exception as e:
        print(f"[NOTE] Notification skipped: {e}")

    print(f"[REGISTER SUCCESS] Account created for: {clean_email}")
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    clean_email = user_data.email.strip().lower()
    clean_password = user_data.password.strip()

    print(f"\n[LOGIN TRY] Email: '{clean_email}'")

    user = db.query(User).filter(User.email == clean_email).first()
    if not user:
        print(f"[LOGIN FAILED] Email '{clean_email}' not found in database!")
        raise HTTPException(status_code=400, detail="User not found! Please Sign Up first.")

    if not verify_password(clean_password, user.password_hash):
        print(f"[LOGIN FAILED] Password mismatch for '{clean_email}'!")
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    print(f"[LOGIN SUCCESS] User '{clean_email}' logged in!")
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=UserOut)
def get_me(token: str, db: Session = Depends(get_db)):
    return get_user_from_token(token, db)


# AI Waste Classification Upload
@app.post("/api/waste/upload")
async def upload_waste(
    token: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    user = get_user_from_token(token, db)
    
    # Save file
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Analyze Image using AI Engine
    ai_results = classify_waste_image(file_path)
    
    # Calculate carbon impact and value
    category = ai_results["category"]
    weight_g = ai_results["estimated_weight_g"]
    
    rate_info = db.query(RecyclingRate).filter(RecyclingRate.category == category).first()
    rate_per_kg = rate_info.rate_per_kg if rate_info else 10.0
    co2_per_kg = rate_info.carbon_saved_per_kg if rate_info else 1.0
    
    # Carbon calculations
    carbon_saved_kg = round((weight_g / 1000.0) * co2_per_kg, 3)
    recycling_value = round((weight_g / 1000.0) * rate_per_kg, 2)
    estimated_points = safe_get_points(category)
    
    # Relative path for serving
    web_image_path = f"/static/uploads/{unique_filename}"
    
    return {
        "image_url": web_image_path,
        "category": category,
        "confidence": ai_results["confidence"],
        "bounding_box": ai_results["bounding_box"],
        "weight_g": weight_g,
        "carbon_saved_kg": carbon_saved_kg,
        "recycling_value": recycling_value,
        "points": estimated_points
    }


# Save Confirmed Waste Submission
@app.post("/api/waste/confirm")
async def confirm_waste(
    token: str = Form(...),
    category: str = Form(...),
    weight_g: float = Form(...),
    carbon_saved_kg: float = Form(...),
    value_inr: float = Form(...),
    image_url: str = Form(...),
    confidence: float = Form(...),
    db: Session = Depends(get_db)
):
    user = get_user_from_token(token, db)
    
    # Create the pending record
    new_record = WasteRecord(
        user_id=user.id,
        category=category,
        weight_g=weight_g,
        carbon_saved_kg=carbon_saved_kg,
        value_inr=value_inr,
        image_path=image_url,
        confidence=confidence,
        status="Pending" # Pending admin approval
    )
    db.add(new_record)
    db.commit()
    
    # Create submission notification
    db.add(Notification(
        user_id=user.id,
        message=f"📥 Recycling request submitted for {category} ({weight_g}g). Awaiting Admin verification."
    ))
    db.commit()
    
    return {"message": "Waste recycling details submitted successfully.", "record_id": new_record.id}


# Waste History List
@app.get("/api/waste/history", response_model=List[WasteRecordOut])
def get_waste_history(token: str, db: Session = Depends(get_db)):
    user = get_user_from_token(token, db)
    records = db.query(WasteRecord).filter(WasteRecord.user_id == user.id).order_by(WasteRecord.created_at.desc()).all()
    return records


# User Notifications
@app.get("/api/notifications", response_model=List[NotificationOut])
def get_notifications(token: str, db: Session = Depends(get_db)):
    user = get_user_from_token(token, db)
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(20).all()


@app.post("/api/notifications/read")
def read_notifications(token: str, db: Session = Depends(get_db)):
    user = get_user_from_token(token, db)
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"message": "Notifications marked as read"}


# Chatbot Multilingual Assistant
@app.post("/api/chatbot", response_model=ChatResponse)
def chatbot_message(req: ChatRequest):
    reply = generate_chatbot_response(req.message, req.language)
    return {"response": reply}


# User Dashboard Stats
@app.get("/api/dashboard/stats", response_model=DashboardStats)
def get_dashboard_stats(token: str, db: Session = Depends(get_db)):
    user = get_user_from_token(token, db)
    
    records = db.query(WasteRecord).filter(WasteRecord.user_id == user.id, WasteRecord.status == "Approved").all()
    all_uploads = db.query(WasteRecord).filter(WasteRecord.user_id == user.id).count()
    
    # Today's calculations
    today = datetime.utcnow().date()
    today_records = db.query(WasteRecord).filter(
        WasteRecord.user_id == user.id, 
        WasteRecord.status == "Approved"
    ).all()
    today_weight = sum(r.weight_g for r in today_records if r.created_at and r.created_at.date() == today)
    
    total_carbon = sum(r.carbon_saved_kg for r in records)
    total_revenue = sum(r.value_inr for r in records)
    
    # Weekly analytics (Last 7 days)
    weekly_analytics = {"dates": [], "weights": [], "carbon": []}
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_records = [r for r in records if r.created_at and r.created_at.date() == day]
        weekly_analytics["dates"].append(day.strftime("%a"))
        weekly_analytics["weights"].append(sum(r.weight_g for r in day_records))
        weekly_analytics["carbon"].append(sum(r.carbon_saved_kg for r in day_records))
        
    # Monthly Category Distribution
    monthly_analytics = {"categories": CLASSES.copy(), "weights": [0.0]*len(CLASSES)}
    for r in records:
        if r.category in monthly_analytics["categories"]:
            idx = monthly_analytics["categories"].index(r.category)
            monthly_analytics["weights"][idx] += (r.weight_g / 1000.0) # In kg
            
    recent_records = db.query(WasteRecord).filter(WasteRecord.user_id == user.id).order_by(WasteRecord.created_at.desc()).limit(5).all()
    
    # Leaderboard (Top 5 users by points)
    top_users = db.query(User).order_by(User.eco_points.desc()).limit(5).all()
    leaderboard = [{"name": u.name, "points": u.eco_points or 0, "badge": u.badge} for u in top_users]
    
    return {
        "total_uploads": all_uploads,
        "today_recycling_g": today_weight,
        "carbon_saved_kg": round(total_carbon, 2),
        "revenue_earned_inr": round(total_revenue, 2),
        "eco_points": user.eco_points or 0,
        "level": user.level or 1,
        "badge": user.badge or "Beginner",
        "weekly_analytics": weekly_analytics,
        "monthly_analytics": monthly_analytics,
        "recent_records": [WasteRecordOut.from_orm(r) for r in recent_records],
        "leaderboard": leaderboard
    }


# --- ADMIN PANEL ---

@app.get("/api/admin/stats", response_model=AdminStats)
def get_admin_stats(token: str, db: Session = Depends(get_db)):
    admin_user = get_user_from_token(token, db)
    if not admin_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    total_users = db.query(User).count()
    total_uploads = db.query(WasteRecord).count()
    pending = db.query(WasteRecord).filter(WasteRecord.status == "Pending").count()
    
    approved_records = db.query(WasteRecord).filter(WasteRecord.status == "Approved").all()
    total_weight = sum(r.weight_g for r in approved_records) / 1000.0 # kg
    total_carbon = sum(r.carbon_saved_kg for r in approved_records)
    total_val = sum(r.value_inr for r in approved_records)
    
    category_distribution = {c: 0.0 for c in CLASSES}
    for r in approved_records:
        if r.category in category_distribution:
            category_distribution[r.category] += r.weight_g / 1000.0
            
    # Weekly trends for admin
    weekly_trends = {"dates": [], "weights": []}
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        day_recs = [r for r in approved_records if r.created_at and r.created_at.date() == day]
        weekly_trends["dates"].append(day.strftime("%m/%d"))
        weekly_trends["weights"].append(sum(r.weight_g for r in day_recs) / 1000.0)
        
    return {
        "total_users": total_users,
        "total_uploads": total_uploads,
        "pending_approvals": pending,
        "total_weight_kg": round(total_weight, 2),
        "total_carbon_saved_kg": round(total_carbon, 2),
        "total_value_inr": round(total_val, 2),
        "category_distribution": category_distribution,
        "weekly_trends": weekly_trends
    }


@app.get("/api/admin/records", response_model=List[WasteRecordOut])
def get_all_records(token: str, db: Session = Depends(get_db)):
    admin_user = get_user_from_token(token, db)
    if not admin_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    records = db.query(WasteRecord).order_by(WasteRecord.created_at.desc()).all()
    out_list = []
    for r in records:
        schema_out = WasteRecordOut.from_orm(r)
        schema_out.user_name = r.user.name if r.user else "Deleted User"
        out_list.append(schema_out)
    return out_list


@app.post("/api/admin/records/{record_id}/action")
def record_action(record_id: int, action: str, token: str, db: Session = Depends(get_db)):
    admin_user = get_user_from_token(token, db)
    if not admin_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    record = db.query(WasteRecord).filter(WasteRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
        
    if action not in ["Approve", "Reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
        
    if record.status != "Pending":
        raise HTTPException(status_code=400, detail="Record has already been processed")
        
    record.status = f"{action}d"
    
    if action == "Approve":
        user = record.user
        points_to_add = safe_get_points(record.category)
        user.eco_points = (user.eco_points or 0) + points_to_add
        
        # Notify user
        db.add(Notification(
            user_id=user.id,
            message=f"⭐ Approved! Your recycling of {record.category} ({record.weight_g}g) was verified. +{points_to_add} Eco Points!"
        ))
        update_user_gamification(user, db)
    else:
        # Notify user of rejection
        db.add(Notification(
            user_id=record.user_id,
            message=f"❌ Rejected: Your recycling request for {record.category} was declined by Admin."
        ))
        
    db.commit()
    return {"message": f"Record {action}d successfully"}


@app.get("/api/admin/rates", response_model=List[RecyclingRateSchema])
def get_rates(db: Session = Depends(get_db)):
    return db.query(RecyclingRate).all()


@app.post("/api/waste/scan")
async def scan_waste(file: UploadFile = File(...)):
    # Save uploaded image temporarily
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # 1. Run Classification
    result = classify_waste_image(file_path)
    category = result["category"]
    weight_kg = result["estimated_weight_g"] / 1000.0

    # 2. Calculate Points & CO2 Saved safely using imported dicts & fallback helper
    earned_points = safe_get_points(category)
    co2_rate = DEFAULT_CO2_SAVED.get(category) or DEFAULT_CO2_SAVED.get(category.title()) or 1.0
    co2_saved = round(weight_kg * co2_rate, 2)

    return {
        "status": "success",
        "category": category,
        "confidence": result["confidence"],
        "bounding_box": result["bounding_box"],
        "estimated_weight_g": result["estimated_weight_g"],
        "earned_points": earned_points,
        "co2_saved_kg": co2_saved
    }


@app.get("/api/admin/users", response_model=List[UserOut])
def get_all_users(token: str, db: Session = Depends(get_db)):
    admin_user = get_user_from_token(token, db)
    if not admin_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin permissions required")
        
    return db.query(User).order_by(User.eco_points.desc()).all()

import json
import os
from google import genai
from google.genai import types
from PIL import Image
import io

# 1. API Key set-up (Your Gemini API Key from Google AI Studio)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
client = genai.Client(api_key=GEMINI_API_KEY)

def predict_waste_accurate(image_bytes):
    try:
        # Load image with Pillow
        image = Image.open(io.BytesIO(image_bytes))

        prompt = """
        Analyze the waste item shown in this image carefully.
        Return ONLY a JSON response without markdown or backticks in this exact schema:
        {
            "category": "Plastic" | "Paper" | "Metal" | "Glass" | "Organic" | "E-waste",
            "weight_g": estimated_weight_in_grams_float,
            "confidence": score_between_0_and_1_float,
            "carbon_saved_kg": estimated_co2_saved_float,
            "value_inr": estimated_value_in_inr_float
        }
        
        Category mapping rules:
        - Plastic: bottles, wrappers, plastic containers, bags
        - Paper: cardboard, newspapers, books, paper cups
        - Metal: cans, foil, copper, iron scraps
        - Glass: glass bottles, jars
        - Organic: food scraps, leaves, vegetables, fruits
        - E-waste: cables, old phones, circuit boards, batteries
        """

        # Call Gemini Flash Vision Model
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        # Parse JSON
        result = json.loads(response.text)
        return result

    except Exception as e:
        print(f"Gemini Prediction Error: {e}")
        # Fallback values if prediction fails
        return {
            "category": "Plastic",
            "weight_g": 250.0,
            "confidence": 0.85,
            "carbon_saved_kg": 0.38,
            "value_inr": 4.5
        }