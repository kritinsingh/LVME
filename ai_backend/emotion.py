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
            
        # Create a unique multi-dimensional Face Hash to act as secure login token
        # Use many geometric ratios so different faces produce clearly different hashes
        eps = 1e-6
        
        # Key landmark references
        left_eye_inner  = landmarks[133]   # inner corner left eye
        right_eye_inner = landmarks[362]   # inner corner right eye
        left_eye_outer  = landmarks[33]    # outer corner left eye
        right_eye_outer = landmarks[263]   # outer corner right eye
        nose_tip        = landmarks[1]
        nose_bridge     = landmarks[6]     # top of nose bridge
        chin            = landmarks[152]
        forehead        = landmarks[10]    # top of forehead
        upper_lip       = landmarks[13]    # centre upper lip
        lower_lip       = landmarks[14]    # centre lower lip
        left_mouth      = landmarks[61]    # left lip corner
        right_mouth     = landmarks[291]   # right lip corner
        left_cheek      = landmarks[234]   # left jaw / tragus
        right_cheek     = landmarks[454]   # right jaw / tragus
        left_brow_inner = landmarks[55]
        right_brow_inner= landmarks[285]
        left_brow_outer = landmarks[46]
        right_brow_outer= landmarks[276]
        
        # Base measurements
        jaw_width      = abs(right_cheek.x - left_cheek.x) + eps
        face_height    = abs(chin.y - forehead.y) + eps
        inter_ocular   = abs(left_eye_inner.x - right_eye_inner.x) + eps
        
        # Compute 12 independent ratios for a high-dimensional face signature
        r1  = round(inter_ocular / jaw_width, 4)                                                    # eye spacing vs jaw
        r2  = round(abs(left_eye_outer.x - right_eye_outer.x) / jaw_width, 4)                       # outer eye span vs jaw
        r3  = round(abs(nose_tip.y - nose_bridge.y) / face_height, 4)                               # nose length vs face height
        r4  = round(abs(nose_tip.y - upper_lip.y) / face_height, 4)                                 # nose-to-lip vs face height
        r5  = round(abs(upper_lip.y - lower_lip.y) / face_height, 4)                                # lip thickness vs face height
        r6  = round(abs(left_mouth.x - right_mouth.x) / jaw_width, 4)                               # mouth width vs jaw
        r7  = round(abs(left_eye_inner.y - left_brow_inner.y) / face_height, 4)                     # left brow height vs face height
        r8  = round(abs(right_eye_inner.y - right_brow_inner.y) / face_height, 4)                   # right brow height vs face height
        r9  = round(abs(forehead.y - nose_bridge.y) / face_height, 4)                               # forehead to nose bridge
        r10 = round(abs(chin.y - lower_lip.y) / face_height, 4)                                     # chin length vs face height
        r11 = round(abs(left_brow_outer.x - right_brow_outer.x) / jaw_width, 4)                     # brow span vs jaw
        r12 = round(abs(nose_tip.x - ((left_cheek.x + right_cheek.x) / 2)) / jaw_width, 4)         # nose centering
        
        face_hash = f"{r1}_{r2}_{r3}_{r4}_{r5}_{r6}_{r7}_{r8}_{r9}_{r10}_{r11}_{r12}"
        
        return {
            "face_found": True,
            "pose": pose,
            "face_hash": face_hash
        }
        
    except Exception as e:
        print(f"Liveness error: {e}")
        return {"face_found": False}
