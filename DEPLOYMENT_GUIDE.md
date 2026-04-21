# LVME Global Deployment Guide

When you are ready to take the LVME app from a local prototype to a live, global application that connects you and your partner across the internet, follow these exact steps.

## Step 1: Push Your Code to GitHub
You need to put your local code into a free GitHub repository so that your cloud server can securely access and build it.

1. Create a free account on **[GitHub.com](https://github.com/)** and create a **New Repository**. Call it `LVME` (make it private or public, your choice).
2. Open your terminal in the root folder (`C:\Users\janma\OneDrive\Desktop\LVME`) and run these exact commands:
   ```bash
   git init
   git add .
   git commit -m "Initial Launch Setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/LVME.git
   git push -u origin main
   ```
   *(Note: A `.gitignore` file has already been created to ensure your massive Python virtual environment folders won't accidentally be uploaded to GitHub!)*

## Step 2: Deploy the AI Backend
Since the app handles real-time WebRTC and video parsing via OpenCV, using **Render (Free Tier)** is the best free option because it natively supports the `Dockerfile` we prepared.

1. Go to **[Render.com](https://render.com/)**, create an account, and connect your GitHub.
2. Click **New +** and select **Web Service**.
3. Choose your new `LVME` GitHub repository.
4. Render will automatically detect the `render.yaml` and `Dockerfile` inside the `ai_backend` folder!
5. Select the **Free Instance** plan, hit **Create Web Service**, and watch it automatically build your facial-recognition AI server in the cloud.
6. Once it finishes, the dashboard will give you a live public URL (e.g., `https://lvme-ai-backend.onrender.com`). **Copy this URL**.

## Step 3: Link the Frontend to the Live Backend
1. Open your `frontend/app.js` file.
2. Find **Line 3** at the very top:
   ```javascript
   const CLOUD_BACKEND_URL = null; // Set to null to use localhost
   ```
3. Change it to your new, live URL from Render (**removing the trailing slash** and the `https://` part!):
   ```javascript
   const CLOUD_BACKEND_URL = "lvme-ai-backend.onrender.com"; 
   ```

## Step 4: Share & Play!
Since your backend is now magically floating in the cloud processing data, anyone running the `index.html` frontend code will automatically connect to it via the internet!

- You can instantly **ZIP the `frontend` folder** and send it directly to your partner to double-click and open on their laptop.
- **OR**, you can package the `frontend` folder into a runnable Desktop `.exe` or Mobile `.apk` using tools like Capacitor or Electron, as discussed previously!

---
*Created by Antigravity AI on the brink of launch day! You've got this.* 🚀
