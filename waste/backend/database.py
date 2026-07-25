import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ecoreward.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    eco_points = Column(Integer, default=0)
    level = Column(Integer, default=1)
    badge = Column(String, default="Beginner")
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("WasteRecord", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

class WasteRecord(Base):
    __tablename__ = "waste_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(String, nullable=False)  # Plastic, Paper, Metal, Glass, Organic, E-waste
    weight_g = Column(Float, nullable=False)
    carbon_saved_kg = Column(Float, nullable=False)
    value_inr = Column(Float, nullable=False)
    status = Column(String, default="Pending")  # Pending, Approved, Rejected
    image_path = Column(String, nullable=True)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="records")

class RecyclingRate(Base):
    __tablename__ = "recycling_rates"

    category = Column(String, primary_key=True, index=True)
    rate_per_kg = Column(Float, nullable=False)
    carbon_saved_per_kg = Column(Float, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Populate default recycling rates if they don't exist
    try:
        default_rates = [
            ("Plastic", 18.0, 1.5),
            ("Paper", 10.0, 0.9),
            ("Metal", 30.0, 2.5),
            ("Glass", 15.0, 1.2),
            ("Organic", 5.0, 0.5),
            ("E-waste", 50.0, 3.2)
        ]
        for category, rate, carbon in default_rates:
            exists = db.query(RecyclingRate).filter(RecyclingRate.category == category).first()
            if not exists:
                db.add(RecyclingRate(category=category, rate_per_kg=rate, carbon_saved_per_kg=carbon))
        
        # Populate a default admin user if none exists
        admin_email = "admin@ecoreward.ai"
        admin_exists = db.query(User).filter(User.email == admin_email).first()
        if not admin_exists:
            # simple admin user (pwd: admin123)
            # using passlib bcrypt hash for admin123:
            # $2b$12$7H8l7H.8l7H.8l7H.8l7HuXQhYyV0pUoeE8y8f7P9fV1R1hV1R1h
            db.add(User(
                name="System Admin",
                email=admin_email,
                password_hash="$2b$12$R9h/lIPsI3qzGSSx9/6hUuG.N9F.V1lT3kG37Ue7f8U.tI8Y.n26O", # hashed 'admin123'
                eco_points=1000,
                level=10,
                badge="Sustainability Hero",
                is_admin=True
            ))
        db.commit()
    except Exception as e:
        print(f"Error seeding DB: {e}")
        db.rollback()
    finally:
        db.close()
