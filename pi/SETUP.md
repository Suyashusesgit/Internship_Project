# Pi Setup Guide

## 1 · Copy files to the Pi

Run this from your **Mac terminal** (replace `pi@raspberrypi.local` with your Pi's actual hostname or IP):

```bash
# Copy the entire pi/ folder to your Pi home directory
scp -r ./pi pi@raspberrypi.local:~/tbtn
```

## 2 · Get the Firebase Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com) → **Project Settings** → **Service accounts**
2. Click **Generate new private key** → Download the JSON file
3. Rename it to `serviceAccountKey.json`
4. Copy it to the Pi:

```bash
scp serviceAccountKey.json pi@raspberrypi.local:~/tbtn/serviceAccountKey.json
```

> ⚠️ **Never commit this file to Git.** It gives full admin write access to your Firestore.

## 3 · SSH into the Pi and install dependencies

```bash
ssh pi@raspberrypi.local
cd ~/tbtn
pip install -r requirements.txt
```

## 4 · Enable I2C and Serial on the Pi

If you haven't already:

```bash
sudo raspi-config
```

- **Interface Options → I2C → Enable**
- **Interface Options → Serial Port → Enable** (disable login shell over serial, enable serial hardware)

Then reboot:

```bash
sudo reboot
```

## 5 · Test each sensor individually

```bash
# Confirm I2C devices are detected (should see 0x5a for MLX90614, 0x57 for MAX30102)
sudo i2cdetect -y 1

# Test GPS is sending data
cat /dev/ttyAMA0
# You should see NMEA sentences like $GPGGA, $GPRMC, etc.
```

## 6 · Run the script

```bash
cd ~/tbtn
python main.py
```

You should see log output like:
```
2026-06-27 12:00:00 [INFO] MLX90614 ready
2026-06-27 12:00:00 [INFO] MAX30102 ready
2026-06-27 12:00:15 [INFO] Wrote → temp=38.2°C  bpm=92  spo2=97%  gps=(28.6139,77.2090)
```

## 7 · Run automatically on boot (optional)

To start the script every time the Pi powers on:

```bash
sudo nano /etc/systemd/system/tbtn.service
```

Paste:

```ini
[Unit]
Description=T-BTN Wearable Sensor Service
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/tbtn/main.py
WorkingDirectory=/home/pi/tbtn
StandardOutput=journal
StandardError=journal
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

Then enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable tbtn.service
sudo systemctl start tbtn.service

# Check status
sudo systemctl status tbtn.service
```

## 8 · Watch logs from your Mac (no monitor needed)

```bash
ssh pi@raspberrypi.local "tail -f ~/tbtn/tbtn.log"
```

---

## Wiring Reference

### MAX30102 → Pi (I2C)
| MAX30102 Pin | Pi Pin |
|---|---|
| VIN | 3.3V (Pin 1) |
| GND | GND (Pin 6) |
| SDA | GPIO 2 / SDA (Pin 3) |
| SCL | GPIO 3 / SCL (Pin 5) |

### MLX90614 → Pi (I2C)
| MLX90614 Pin | Pi Pin |
|---|---|
| VIN | 3.3V (Pin 1) |
| GND | GND (Pin 9) |
| SDA | GPIO 2 / SDA (Pin 3) |
| SCL | GPIO 3 / SCL (Pin 5) |

> Both sensors share the same I2C bus — that's fine. MLX90614 address: `0x5A`, MAX30102 address: `0x57`.

### NEO-6M/8M GPS → Pi (UART)
| GPS Pin | Pi Pin |
|---|---|
| VCC | 3.3V or 5V (Pin 2) |
| GND | GND (Pin 6) |
| TX  | GPIO 15 / RXD (Pin 10) |
| RX  | GPIO 14 / TXD (Pin 8) |

> Connect GPS **TX → Pi RX** and GPS **RX → Pi TX**.
