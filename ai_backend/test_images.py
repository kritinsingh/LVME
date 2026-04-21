import os
from emotion import analyze_emotion

def test_image(image_path, runs=1):
    print(f"\n--- Testing Image: {os.path.basename(image_path)} ---")
    if not os.path.exists(image_path):
        print(f"Error: File not found {image_path}")
        return
        
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        
    for i in range(runs):
        result = analyze_emotion(image_bytes)
        print(f"Step {i+1} => Emotion: {result['emotion']} | Triggers: {result.get('reasons', [])} | Action: {result['action']}")

if __name__ == "__main__":
    # Smiling (we expect 'alone_but_smiling' trigger) with 30% random capture chance
    smile_img = r"C:\Users\janma\.gemini\antigravity\brain\41a73fdc-7af2-4f89-a637-062628f24358\smile_portrait_1776586290503.png"
    print("TEST 1: Smiling Portrait")
    print("Notice how the 'action' randomly becomes 'save_memory' due to the 30% randomizer filter!")
    test_image(smile_img, 15)
    
    # Neutral (we expect no trigger, action always 'ignore')
    neutral_img = r"C:\Users\janma\.gemini\antigravity\brain\41a73fdc-7af2-4f89-a637-062628f24358\neutral_portrait_1776586306308.png"
    print("\nTEST 2: Neutral Portrait")
    test_image(neutral_img, 2)
