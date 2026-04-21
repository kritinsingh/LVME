import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from geometric_utils import euclidean_distance
import os

# Set up Task configs with the new Tasks API because older solutions are deprecated in newer MediaPipe
base_options_face = python.BaseOptions(model_asset_path='face_landmarker.task')
base_options_hand = python.BaseOptions(model_asset_path='hand_landmarker.task')

options_face = vision.FaceLandmarkerOptions(
    base_options=base_options_face,
    min_face_detection_confidence=0.5,
    min_face_presence_confidence=0.5,
    min_tracking_confidence=0.5,
    num_faces=2
)
face_landmarker = vision.FaceLandmarker.create_from_options(options_face)

options_hand = vision.HandLandmarkerOptions(
    base_options=base_options_hand,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
    num_hands=4
)
hand_landmarker = vision.HandLandmarker.create_from_options(options_hand)

def check_smile(face_landmarks):
    # Lip corners: 61 (left), 291 (right)
    left_lip = [face_landmarks[61].x, face_landmarks[61].y]
    right_lip = [face_landmarks[291].x, face_landmarks[291].y]
    
    # Jaw width: 234 (left jaw), 454 (right jaw)
    left_jaw = [face_landmarks[234].x, face_landmarks[234].y]
    right_jaw = [face_landmarks[454].x, face_landmarks[454].y]
    
    mouth_width = euclidean_distance(left_lip, right_lip)
    jaw_width = euclidean_distance(left_jaw, right_jaw)
    
    if jaw_width == 0: return False
    ratio = mouth_width / jaw_width
    return ratio > 0.45

def detect_hand_hearts(hand_landmarks_list):
    if len(hand_landmarks_list) < 2:
        return False
    # Check if wrists are close
    hand1_wrist = [hand_landmarks_list[0][0].x, hand_landmarks_list[0][0].y]
    hand2_wrist = [hand_landmarks_list[1][0].x, hand_landmarks_list[1][0].y]
    
    return euclidean_distance(hand1_wrist, hand2_wrist) < 0.15

def analyze_emotion(image_bytes: bytes) -> dict:
    nparr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        return {"error": "Invalid image"}
        
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    
    face_results = face_landmarker.detect(mp_image)
    hand_results = hand_landmarker.detect(mp_image)
    
    is_best_part = False
    face_count = 0
    smiling_faces = 0
    action = "ignore"
    reasons = []
    
    if hand_results.hand_landmarks:
        if detect_hand_hearts(hand_results.hand_landmarks):
            is_best_part = True
            reasons.append("hand_hearts_detected")
    
    if face_results.face_landmarks:
        faces = face_results.face_landmarks
        face_count = len(faces)
        face_points = []
        
        for face in faces:
            if check_smile(face):
                smiling_faces += 1
            face_points.append([face[1].x, face[1].y])
            
        if face_count >= 2:
            if smiling_faces >= 2:
                is_best_part = True
                reasons.append("synchronized_smiles")
            elif smiling_faces == 1:
                is_best_part = True
                reasons.append("one_person_smiling")
                
            if len(face_points) >= 2:
                if euclidean_distance(face_points[0], face_points[1]) < 0.35:
                    is_best_part = True
                    reasons.append("leaning_in_close")
        elif face_count == 1:
            if smiling_faces == 1:
                is_best_part = True
                reasons.append("alone_but_smiling")
                
    if is_best_part:
        if np.random.rand() < 0.30:  
            action = "save_memory"
    
    return {
        "emotion": "happy" if smiling_faces > 0 else "neutral",
        "face_count": face_count,
        "action": action,
        "reasons": reasons
    }

def analyze_liveness(image_path: str) -> dict:
    import mediapipe as mp
    try:
        mp_image = mp.Image.create_from_file(image_path)
        face_result = face_landmarker.detect(mp_image)
        
        if not face_result.face_landmarks:
            return {"face_found": False}
        
        landmarks = face_result.face_landmarks[0]
        
        # Landmarks: Nose (1), Left Ear/Tragus (234), Right Ear/Tragus (454)
        nose = landmarks[1]
        left_ear = landmarks[234]
        right_ear = landmarks[454]
        
        # Center of head and width
        head_center_x = (left_ear.x + right_ear.x) / 2.0
        face_width = abs(right_ear.x - left_ear.x) + 1e-6
        
        # Calculate where the nose is pointing.
        # Since the frontend sends an UNMIRRORED webcam frame:
        # - When the user turns to their physical LEFT, their nose moves to the RIGHT side of the image (positive offset).
        # - When the user turns to their physical RIGHT, their nose moves to the LEFT side of the image (negative offset).
        nose_offset_ratio = (nose.x - head_center_x) / face_width
        
        pose = "center"
        if nose_offset_ratio > 0.15:
            pose = "left"  
        elif nose_offset_ratio < -0.15:
            pose = "right"
            
        # Create a unique mathematical Face Hash to act as secure login token
        inter_ocular = abs(landmarks[133].x - landmarks[362].x)
        jaw_width = abs(left_ear.x - right_ear.x)
        face_hash = str(round(inter_ocular / (jaw_width + 1e-6), 3))
        
        return {
            "face_found": True,
            "pose": pose,
            "face_hash": face_hash
        }
        
    except Exception as e:
        print(f"Liveness error: {e}")
        return {"face_found": False}
