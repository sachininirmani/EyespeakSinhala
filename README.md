# 📝 Eyespeak Sinhala — Eye-Controlled Sinhala Keyboard  
*A Tobii Eye Tracker + Python Backend + Next.js Frontend Project*

Eyespeak Sinhala is a gaze-controlled Sinhala keyboard designed for hands-free text entry.  
The system integrates a **Tobii eye tracker**, a **Python backend**, and a **Next.js frontend** to provide:

- Real-time eye-driven key selection  
- Sinhala vowel-popup predictions  
- Multi-stage diacritic handling  
- Word completions (top 5)  
- Dwell-free selection  
- Accurate and responsive gaze-based UI  

This document explains the **complete setup** and how to **run the working model**.

Frontend - cmd
- cd frontend
- npm run dev

Backend - cmd
- cd backend
- .venv\Scripts\activate
- python app.py

http://localhost:5173/
---

## 📁 Project Structure

```
project-root/
│
├── backend/                 # Python backend
│   ├── app.py
│   ├── requirements.txt
│   └── ...
│
├── frontend/                # Next.js frontend
│   ├── package.json
│   └── ...
│
└── TobiiBridge/             # Java WebSocket bridge (run in IntelliJ)
```

---

# 🚀 How to Run the Project

To run the project end-to-end, you must launch **three separate components** in the correct order:

1️⃣ **Tobii WebSocket Connection (TobiiBridge in IntelliJ)**  
2️⃣ **Backend (Python)**  
3️⃣ **Frontend (Next.js)**  

Details below.

---

# 1️⃣ Connect Tobii Eye Tracker & Start TobiiBridge

TobiiBridge must be running before starting backend or frontend.

### ✔️ Steps
1. Connect your **Tobii Eye Tracker** to the computer.  
2. Open **IntelliJ IDEA**.  
3. Open the **TobiiBridge** project.  
4. Click **Run** to start the WebSocket server.

### ✔️ What TobiiBridge Does
- Establishes a WebSocket server.  
- Reads gaze coordinates from Tobii SDK.  
- Streams them to the backend in real-time.  
- Must remain active throughout the session.

> ⚠️ **Note:** If TobiiBridge is not running, the keyboard will NOT receive gaze data.

---

# 2️⃣ Backend Setup (Python)

The backend handles:
- Receiving Tobii gaze coordinates  
- Generating vowel/diacritic combinations  
- Word completion predictions  
- Communicating with the frontend UI  

---

## ✔️ First-time setup

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
python app.py
```

### Explanation
- `python -m venv .venv` → creates a virtual environment  
- `source .venv/Scripts/activate` → activates the environment  
- `pip install -r requirements.txt` → installs backend dependencies  
- `python app.py` → starts backend server  

---

## ✔️ Running Backend After First Setup

```bash
cd backend
source .venv/Scripts/activate
python app.py
```

No reinstalling required unless dependencies change.

---

# 3️⃣ Frontend Setup (Next.js)

The frontend renders the Sinhala keyboard UI and interacts with backend APIs & websocket streams.

```bash
cd frontend
npm install     # optional: only first time
npm run dev
```

- `npm install` → installs React/Next.js and all dependencies  
- `npm run dev` → runs the development server at **http://localhost:3000**  

---

# 🔄 Correct Startup Order (MUST follow)

| Step | Component | Notes |
|------|-----------|-------|
| 1 | **TobiiBridge** | Starts WebSocket gaze stream |
| 2 | **Backend** | Receives gaze + predictions |
| 3 | **Frontend** | UI displays gaze & keyboard interactions |

---

# 🛠️ Troubleshooting

### ❌ Gaze not moving in UI?
✔ TobiiBridge not running  
✔ Backend not receiving WebSocket data  
✔ Tobii disconnected / permissions issue  

### ❌ Backend fails to start?
✔ `.venv` not activated  
✔ Missing dependencies → run `pip install -r requirements.txt`  
✔ Port 5000 may already be in use  

### ❌ Frontend error?
✔ Delete `node_modules` → run `npm install` again  

### ❌ CORS or API connection issues?
✔ Backend CORS must be enabled  
✔ Check correct backend URL in frontend  

---

# 🎯 Summary

To run the Eyespeak Sinhala working model:

### **1️⃣ Connect Tobii → Run TobiiBridge**  
### **2️⃣ Activate Backend → python app.py**  
### **3️⃣ Start Frontend → npm run dev**

All components must stay running during testing.

---



