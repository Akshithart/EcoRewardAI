from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# Authentication
class UserRegister(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    eco_points: int = 0
    level: int = 1
    badge: str = "Beginner"
    is_admin: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Waste Records
class WasteRecordOut(BaseModel):
    id: int
    user_id: int
    category: str
    weight_g: float
    carbon_saved_kg: float
    value_inr: float
    status: str
    image_path: Optional[str] = None
    confidence: float
    created_at: datetime
    user_name: Optional[str] = None  # Added for admin view

    class Config:
        from_attributes = True

# Recycling Rates
class RecyclingRateSchema(BaseModel):
    category: str
    rate_per_kg: float
    carbon_saved_per_kg: float

    class Config:
        from_attributes = True

# Chatbot
class ChatRequest(BaseModel):
    message: str
    language: str  # English, Tamil, Hindi, Malayalam, Telugu

class ChatResponse(BaseModel):
    response: str

# Dashboard Analytics
class DashboardStats(BaseModel):
    total_uploads: int
    today_recycling_g: float
    carbon_saved_kg: float
    revenue_earned_inr: float
    eco_points: int
    level: int
    badge: str
    weekly_analytics: dict
    monthly_analytics: dict
    recent_records: List[WasteRecordOut]
    leaderboard: List[dict]

# Admin Dashboard Stats
class AdminStats(BaseModel):
    total_users: int
    total_uploads: int
    pending_approvals: int
    total_weight_kg: float
    total_carbon_saved_kg: float
    total_value_inr: float
    category_distribution: dict
    weekly_trends: dict

# Notification
class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True