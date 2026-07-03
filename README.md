# T-BTN Army Dog Health Telemetry (IIT Jodhpur Research Prototype)

A rugged, offline-first IoT wearable designed for monitoring the health and location of military working dogs in the field. Developed as an advanced embedded systems research prototype for IIT Jodhpur.

![Army Dog Telemetry Dashboard](https://raw.githubusercontent.com/suyash-uses/internship-project/main/dashboard/public/preview.png) *(Note: Add a real preview screenshot here later)*

## 🌟 Key Research Features

*   **Real-time Vitals Monitoring:** Tracks Heart Rate (BPM), Blood Oxygen (SpO₂), and Body Temperature (°C) via I2C.
*   **GPS Tracking:** Live location, speed, and heading telemetry via UART.
*   **Offline-First Edge Architecture:** Zero data loss. If the dog enters a dead zone, the Raspberry Pi buffers all readings locally (SQLite WAL). When connectivity returns (via mobile hotspot or 4G dongle), a background daemon automatically flushes the buffer to the cloud using exponential backoff.
*   **Automated Alert System:** Visual pulsing banners, browser notifications, and audio alarms trigger immediately if vitals enter critical danger zones (e.g., BPM > 160, SpO₂ < 90%).
*   **Hardware Watchdog:** Immune to silent I2C bus hangs. The Pi's hardware watchdog will automatically reboot the system if the sensor loop deadlocks.
*   **Power Optimization:** Digital Signal Processing (DSP) is mathematically gated to exactly 1Hz to maximize powerbank battery life and prevent CPU starvation.

## 🏗️ Architecture

The system consists of a deeply decoupled Edge-to-Cloud pipeline:

1.  **Hardware Edge Node (Raspberry Pi 5 + Sensors)**
    *   `main.py`: The core polling loop. Reads MAX30102 and GPS sensors, runs the DSP, and pushes to the local buffer.
    *   `buffer.py`: A local SQLite database running in WAL mode to handle concurrent reads/writes safely.
    *   `firebase_client.py`: A background daemon thread that constantly attempts to flush the SQLite buffer to Firebase Firestore whenever an internet connection is verified via `connectivity.py`.

2.  **Cloud Dashboard (Next.js + Vercel)**
    *   A highly responsive React dashboard built with Next.js, Tailwind CSS, and Recharts.
    *   Subscribes to live Firestore updates via `onSnapshot`.
    *   Features a "History" view with downsampled charting (LTTB algorithm) and CSV data export.

## ⚙️ Hardware Setup

*   **Compute:** Raspberry Pi 5
*   **Sensors:** 
    *   MAX30102 (Pulse Oximeter and Heart Rate) -> Connected via I2C (Bus 1).
    *   MLX90614 (Infrared Temperature) -> Connected via I2C (`dtoverlay=i2c3-pi5` required to prevent bus collisions).
    *   GPS Module (e.g., NEO-6M) -> Connected via UART.
*   **Power:** 20W USB Powerbank (Undertension monitoring included).
*   **Connectivity:** Mobile Hotspot or USB 4G LTE Dongle.

For detailed wiring and Raspberry Pi OS configuration (including enabling systemd services and the hardware watchdog), see the [Hardware Setup Guide](pi/SETUP.md).

For Field Operations, view the [Standard Operating Procedure](SOP_T-BTN_Project.html).

## 🚀 Running the Dashboard Locally

1.  Navigate to the dashboard directory:
    ```bash
    cd dashboard
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables. Create a `.env.local` file with your Firebase credentials (see `.env.local.example`).
4.  Start the development server:
    ```bash
    npm run dev
    ```
5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧪 Simulation Mode

Don't have the hardware on hand? You can simulate a dog on patrol to test the dashboard by running the Python simulator script:

```bash
cd pi
pip install firebase-admin
python simulator.py --demo-critical
```

## 🔮 Future Roadmap (Phase 11 Advanced Features)
This project is built to scale. Future iterations will include:
*   **Edge AI Anomaly Detection:** Deploying TensorFlow Lite on the Pi to detect irregular heart rhythms natively before sending data to the cloud.
*   **Geofencing:** Tactical boundary alerts pushed directly to the dashboard if a dog leaves the operational zone.
*   **Health Readiness Score:** An aggregated metric weighting Temp, SpO2, and BPM into a single 0-100% tactical readiness index.
