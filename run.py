import os
import sys
import subprocess
import time
import webbrowser
import threading

def setup_and_run():
    print("=================================================================")
    print("        EcoReward AI - Smart Waste Detection System        ")
    print("=================================================================")
    
    # 1. Base directory where run.py lives (C:\waste collection)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 2. Check where requirements.txt is located
    if os.path.exists(os.path.join(script_dir, "requirements.txt")):
        project_root = script_dir
    elif os.path.exists(os.path.join(script_dir, "waste", "requirements.txt")):
        project_root = os.path.join(script_dir, "waste")
    else:
        project_root = script_dir

    # 3. Locate backend root (where backend folder actually lives)
    if os.path.exists(os.path.join(script_dir, "backend")):
        backend_root = script_dir
    elif os.path.exists(os.path.join(script_dir, "waste", "backend")):
        backend_root = os.path.join(script_dir, "waste")
    else:
        backend_root = script_dir

    # Virtual environment path
    venv_dir = os.path.join(project_root, ".venv")
    
    if sys.platform == "win32":
        python_path = os.path.join(venv_dir, "Scripts", "python.exe")
    else:
        python_path = os.path.join(venv_dir, "bin", "python")

    # Step 1: Create virtual environment
    if not os.path.exists(venv_dir):
        print("\n[1/3] Creating virtual environment (.venv)...")
        try:
            subprocess.run([sys.executable, "-m", "venv", venv_dir], check=True)
            print("Virtual environment created successfully.")
        except subprocess.CalledProcessError as e:
            print(f"Failed to create virtual environment: {e}")
            sys.exit(1)
    else:
        print("\n[1/3] Virtual environment (.venv) already exists. Skipping creation.")

    # Step 2: Install dependencies
    print("\n[2/3] Installing Python dependencies from requirements.txt...")
    req_file = os.path.join(project_root, "requirements.txt")
    if not os.path.exists(req_file):
        print(f"[ERROR] requirements.txt not found in: {project_root}")
        sys.exit(1)
        
    try:
        print("Upgrading pip...")
        subprocess.run([python_path, "-m", "pip", "install", "--upgrade", "pip"], check=True)
        
        print(f"Installing packages from {req_file}...")
        subprocess.run([python_path, "-m", "pip", "install", "-r", req_file], check=True)
        print("All dependencies installed successfully.")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to install dependencies: {e}")
        sys.exit(1)
        
    # Step 3: Start browser thread
    def open_browser():
        time.sleep(4)
        url = "http://127.0.0.1:8000/static/index.html"
        print(f"\n[INFO] Opening app in default browser: {url}")
        webbrowser.open(url)
        
    browser_thread = threading.Thread(target=open_browser, daemon=True)
    browser_thread.start()

    # Step 4: Start FastAPI server
    print("\n[3/3] Launching EcoReward AI web application...")
    print("[INFO] Starting Uvicorn backend server on http://127.0.0.1:8000")
    print("[INFO] Press Ctrl+C to stop the server.\n")
    
    # Ensure backend_root is in PYTHONPATH so 'backend.main:app' imports work
    current_env = os.environ.copy()
    current_env["PYTHONPATH"] = backend_root

    uvicorn_cmd = [
        python_path, "-m", "uvicorn", 
        "backend.main:app", 
        "--host", "127.0.0.1", 
        "--port", "8000", 
        "--reload"
    ]

    try:
        # cwd set to backend_root so uvicorn finds backend.main:app
        subprocess.run(uvicorn_cmd, check=True, env=current_env, cwd=backend_root)
    except KeyboardInterrupt:
        print("\n[INFO] Server stopped by user.")
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Server process failed with exit code {e.returncode}.")
        print(f"Ensure 'backend/main.py' exists inside '{backend_root}'.")


if __name__ == "__main__":
    setup_and_run()