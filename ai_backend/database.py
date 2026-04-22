import os
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://lvme_db_user:Qa3u33Slor46rnBZQwLV9JoTingkGUMU@dpg-d7kg66647okc73c0ejtg-a.oregon-postgres.render.com/lvme_db")

# If using Postgres, remove check_same_thread
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    face_hash = Column(String, unique=True, index=True)
    
class Partnership(Base):
    __tablename__ = "partnerships"
    
    id = Column(Integer, primary_key=True, index=True)
    user1_hash = Column(String, ForeignKey("users.face_hash"))
    user2_hash = Column(String, ForeignKey("users.face_hash"))
    
class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_hash = Column(String, ForeignKey("users.face_hash"))
    receiver_hash = Column(String, ForeignKey("users.face_hash"))
    content = Column(Text)
    msg_type = Column(String) # 'text', 'image', 'audio', 'video'
    timestamp = Column(DateTime, default=datetime.utcnow)

# Create tables if they don't exist
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
