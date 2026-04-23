import os
import shutil
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from video_generator import generate_trailer_video
from emotion import analyze_emotion
from fastapi import WebSocket, WebSocketDisconnect, Form, Depends, HTTPException
from database import SessionLocal, User, Partnership, Message
from sqlalchemy.orm import Session
import json

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="Memory App Backend", description="AI microservice for Couple Memory App")

# Allow CORS for frontend WebRTC integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, face_hash: str):
        await websocket.accept()
        self.active_connections[face_hash] = websocket

    def disconnect(self, face_hash: str):
        if face_hash in self.active_connections:
            del self.active_connections[face_hash]

    async def send_personal_message(self, message: str, face_hash: str):
        if face_hash in self.active_connections:
            websocket = self.active_connections[face_hash]
            try:
                await websocket.send_text(message)
            except:
                pass

manager = ConnectionManager()

@app.get("/")
def read_root():
    return {"status": "Backend is running", "message": "Welcome to the Couple Memory App API"}

@app.post("/liveness-check/")
async def liveness_check(file: UploadFile = File(...)):
    temp_file = f"temp_liveness_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Analyze for head pose and face hash
    from emotion import analyze_liveness
    result = analyze_liveness(temp_file)
    
    # Cleanup
    if os.path.exists(temp_file):
        os.remove(temp_file)
        
    return result

@app.post("/analyze-frame/")
async def analyze_frame(file: UploadFile = File(...)):
    """
    Receives an image frame (e.g., from WebRTC video call), runs MediaPipe
    to detect expressions, and returns a 'Love Score' or excitement level.
    """
    try:
        contents = await file.read()
        # Pass raw bytes to the sentiment analyzer
        result = analyze_emotion(contents)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/auth/")
def auth_user(mode: str = Form(...), face_hash: str = Form(...), username: str = Form(""), db: Session = Depends(get_db)):
    import math
    
    def parse_hash_vector(h: str):
        """Parse a multi-dimensional face hash like '0.34_0.56_...' into a list of floats."""
        try:
            parts = h.split("_")
            if len(parts) > 1:
                return [float(p) for p in parts]
            else:
                # Legacy single-float hash
                return [float(h)]
        except:
            return None
    
    def face_distance(v1, v2):
        """Euclidean distance between two face hash vectors."""
        if len(v1) != len(v2):
            return float('inf')  # incompatible formats can never match
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(v1, v2)))
    
    potential_vec = parse_hash_vector(face_hash)
    if potential_vec is None:
        return {"status": "error", "message": "Invalid face data. Please try again."}
    
    users = db.query(User).all()
    matched_user = None
    best_distance = float('inf')
    
    # Matching threshold: with 12 dimensions, same-person variance ~0.07, different-person distance ~0.20+
    MATCH_THRESHOLD = 0.15
    
    for u in users:
        stored_vec = parse_hash_vector(u.face_hash)
        if stored_vec is None:
            continue
        dist = face_distance(stored_vec, potential_vec)
        if dist < MATCH_THRESHOLD and dist < best_distance:
            best_distance = dist
            matched_user = u

    if mode == "signup":
        if matched_user:
            return {"status": "error", "message": f"Face already tied to account: {matched_user.username}!"}
        if db.query(User).filter(User.username == username).first():
             return {"status": "error", "message": "Username taken by another face!"}
             
        new_user = User(username=username, face_hash=face_hash)
        db.add(new_user)
        db.commit()
        return {"status": "success", "username": username, "face_hash": face_hash}
        
    if mode == "login":
        if not matched_user:
            return {"status": "error", "message": "Face not recognized. Please create an account."}
            
        partner = None
        partnership = db.query(Partnership).filter(
            (Partnership.user1_hash == matched_user.face_hash) | 
            (Partnership.user2_hash == matched_user.face_hash)
        ).first()
        
        if partnership:
            partner_hash = partnership.user2_hash if partnership.user1_hash == matched_user.face_hash else partnership.user1_hash
            partner_user = db.query(User).filter(User.face_hash == partner_hash).first()
            if partner_user:
                 partner = partner_user.username
                 
        return {"status": "success", "username": matched_user.username, "face_hash": matched_user.face_hash, "partner": partner}


@app.post("/bind-partner/")
def bind_partner(user_hash: str = Form(...), partner_username: str = Form(...), db: Session = Depends(get_db)):
    partner = db.query(User).filter(User.username == partner_username).first()
    if not partner:
        return {"status": "error", "message": "Partner handle not found in the LVME system."}
        
    if partner.face_hash == user_hash:
        return {"status": "error", "message": "You cannot bind to yourself."}
        
    existing = db.query(Partnership).filter(
        (Partnership.user1_hash == user_hash) | (Partnership.user2_hash == user_hash)
    ).first()
    
    if existing:
         return {"status": "error", "message": "You are already bound to a partner permanently!"}
         
    new_bind = Partnership(user1_hash=user_hash, user2_hash=partner.face_hash)
    db.add(new_bind)
    db.commit()
    return {"status": "success", "partner_username": partner.username, "partner_hash": partner.face_hash}


@app.get("/chat-history/{user_hash}")
def get_chat_history(user_hash: str, db: Session = Depends(get_db)):
    partnership = db.query(Partnership).filter(
        (Partnership.user1_hash == user_hash) | (Partnership.user2_hash == user_hash)
    ).first()
    
    if not partnership: return []
    partner_hash = partnership.user2_hash if partnership.user1_hash == user_hash else partnership.user1_hash
    
    msgs = db.query(Message).filter(
        ((Message.sender_hash == user_hash) & (Message.receiver_hash == partner_hash)) |
        ((Message.sender_hash == partner_hash) & (Message.receiver_hash == user_hash))
    ).order_by(Message.timestamp).all()
    
    result = []
    for m in msgs:
        result.append({
            "sender_hash": m.sender_hash,
            "type": m.msg_type,
            "content": m.content,
            "timestamp": m.timestamp.isoformat()
        })
    return result

@app.get("/generate-trailer/{face_hash}")
def generate_trailer(face_hash: str, db: Session = Depends(get_db)):
    partnership = db.query(Partnership).filter(
        (Partnership.user1_hash == face_hash) | (Partnership.user2_hash == face_hash)
    ).first()
    
    if not partnership:
        raise HTTPException(status_code=404, detail="Not partnered")
        
    partner_hash = partnership.user2_hash if partnership.user1_hash == face_hash else partnership.user1_hash
    
    msgs = db.query(Message).filter(
        ((Message.sender_hash == face_hash) & (Message.receiver_hash == partner_hash)) |
        ((Message.sender_hash == partner_hash) & (Message.receiver_hash == face_hash))
    ).order_by(Message.timestamp).all()
    
    out_path = f"trailer_{face_hash}.mp4"
    success = generate_trailer_video(msgs, out_path)
    
    if success and os.path.exists(out_path):
        return FileResponse(out_path, media_type="video/mp4", filename="LoveTrailer.mp4")
    return JSONResponse(status_code=400, content={"error": "Not enough media to generate trailer"})


@app.websocket("/ws/{face_hash}")
async def websocket_endpoint(websocket: WebSocket, face_hash: str, db: Session = Depends(get_db)):
    await manager.connect(websocket, face_hash)
    
    partnership = db.query(Partnership).filter(
        (Partnership.user1_hash == face_hash) | (Partnership.user2_hash == face_hash)
    ).first()
    
    partner_hash = None
    if partnership:
        partner_hash = partnership.user2_hash if partnership.user1_hash == face_hash else partnership.user1_hash

    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            msg_type = message_data.get("type", "")
            
            # If it's a persistent chat message
            if msg_type.startswith("chat_"):
                new_msg = Message(
                    sender_hash=face_hash,
                    receiver_hash=partner_hash,
                    content=message_data.get("content"),
                    msg_type=msg_type
                )
                db.add(new_msg)
                db.commit()
                
            # Relay to partner connected websocket
            if partner_hash:
                await manager.send_personal_message(data, partner_hash)
                
    except WebSocketDisconnect:
        manager.disconnect(face_hash)
