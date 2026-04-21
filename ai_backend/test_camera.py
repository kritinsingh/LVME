import cv2
import requests
import time

URL = "http://127.0.0.1:8000/analyze-frame/"

def test_camera():
    cap = cv2.VideoCapture(0)
    print("Starting Camera... Press 'q' to quit.")
    
    last_post_time = time.time()
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        cv2.imshow('Couple Memory App - Local Test', frame)
        
        current_time = time.time()
        # Ping the API twice a second (every 0.5s) to avoid UI freezing
        if current_time - last_post_time > 0.5:
            last_post_time = current_time
            _, img_encoded = cv2.imencode('.jpg', frame)
            
            try:
                files = {"file": ("frame.jpg", img_encoded.tobytes(), "image/jpeg")}
                response = requests.post(URL, files=files)
                data = response.json()
                
                action = data.get('action', 'ignore')
                reasons = ", ".join(data.get('reasons', []))
                
                print(f"[{time.strftime('%H:%M:%S')}] Action: {action} | Triggers: {reasons}")
            except requests.exceptions.ConnectionError:
                print("Could not connect. Ensure FastAPI backend is running: uvicorn main:app --reload")
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    test_camera()
