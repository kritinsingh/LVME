import os
import base64
import random
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import tempfile
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips, concatenate_audioclips

def create_text_image(text, width=720, height=1280, bg_color=(20, 10, 20), text_color=(255, 100, 150)):
    # Create an image with PIL to avoid ImageMagick requirement in moviepy
    img = Image.new('RGB', (width, height), color=bg_color)
    d = ImageDraw.Draw(img)
    
    # Try to load a font, otherwise use default
    try:
        font = ImageFont.truetype("arial.ttf", 60)
    except:
        font = ImageFont.load_default()
        
    # Simple text wrapping could be done here, but for simplicity we just write it centrally
    # This is a naive centering that works well enough for "I miss you", "I love you" style texts
    text_w = d.textlength(text, font=font) if hasattr(d, 'textlength') else len(text) * 10
    text_h = 60 # approx
    
    x = (width - text_w) / 2
    y = (height - text_h) / 2
    
    d.text((x, y), text, font=font, fill=text_color)
    
    tmp_path = tempfile.mktemp(suffix=".png")
    img.save(tmp_path)
    return tmp_path

def generate_trailer_video(messages, output_file="trailer.mp4"):
    """
    messages: list of SQLAlchemy Message objects
    It filters out image, audio, and text types to create a synchronized video.
    """
    images_b64 = []
    audios_b64 = []
    texts = []
    
    for m in messages:
        if m.msg_type == "chat_image":
            images_b64.append(m.content)
        elif m.msg_type == "chat_audio":
            audios_b64.append(m.content)
        elif m.msg_type == "chat_text":
            if "ended" not in m.content: # avoid system messages
                texts.append(m.content)
                
    # If not enough media, we just make a dummy or return False
    if not images_b64 and not texts and not audios_b64:
        return False
        
    clips = []
    temp_files = []
    
    # Let's aim for a target duration of ~30 seconds, looping or reusing if needed.
    target_duration = 30
    current_duration = 0
    
    idx_img = 0
    idx_txt = 0
    
    # Generate visual clips
    while current_duration < target_duration and (images_b64 or texts):
        # alternate between image and text if both exist
        use_image = False
        if images_b64 and texts:
            use_image = random.choice([True, False])
        elif images_b64:
            use_image = True
        
        duration = random.uniform(3.0, 5.0)
        
        if use_image:
            b64_data = images_b64[idx_img % len(images_b64)]
            idx_img += 1
            # Decode b64
            try:
                head, data = b64_data.split(',', 1)
                img_bytes = base64.b64decode(data)
                tmp_path = tempfile.mktemp(suffix=".png")
                with open(tmp_path, "wb") as f:
                    f.write(img_bytes)
                temp_files.append(tmp_path)
                
                clip = ImageClip(tmp_path).set_duration(duration)
                clips.append(clip)
                current_duration += duration
            except:
                pass
        else:
            txt = texts[idx_txt % len(texts)]
            idx_txt += 1
            tmp_path = create_text_image(txt)
            temp_files.append(tmp_path)
            
            clip = ImageClip(tmp_path).set_duration(duration)
            clips.append(clip)
            current_duration += duration
            
    if not clips:
        # Fallback to a single text
        tmp_path = create_text_image("A memory awaits...")
        temp_files.append(tmp_path)
        clips.append(ImageClip(tmp_path).set_duration(5))
        
    video_track = concatenate_videoclips(clips, method="compose")
    
    # Generate audio track if any voice notes exist
    audio_clips = []
    if audios_b64:
        for b64_data in audios_b64:
            try:
                head, data = b64_data.split(',', 1)
                audio_bytes = base64.b64decode(data)
                # Save webm or ogg temporarily
                tmp_audio_path = tempfile.mktemp(suffix=".webm")
                with open(tmp_audio_path, "wb") as f:
                    f.write(audio_bytes)
                temp_files.append(tmp_audio_path)
                
                a_clip = AudioFileClip(tmp_audio_path)
                audio_clips.append(a_clip)
            except:
                pass
                
    if audio_clips:
        final_audio = concatenate_audioclips(audio_clips)
        # loop audio if it's shorter than video, or cut if video is shorter
        final_audio = final_audio.set_duration(video_track.duration)
        video_track = video_track.set_audio(final_audio)
        
    video_track.write_videofile(output_file, fps=24, codec="libx264", audio_codec="aac")
    
    # Cleanup temp resources
    video_track.close()
    for tmp in temp_files:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except:
                pass
                
    return True
