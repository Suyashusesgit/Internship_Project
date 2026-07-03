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
Description=T-BTN Army Dog Wearable Sensor Service
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/tbtn/main.py
WorkingDirectory=/home/pi/tbtn
StandardOutput=journal
StandardError=journal
Restart=always
RestartSec=10
User=pi

[Install]
WantedBy=multi-user.target
```

> **Why `network-online.target`?** When the Pi boots from a powerbank it may take
> 20–40 seconds to join the hotspot or 4G dongle. `network-online.target` makes
> the service wait until at least one interface has an IP before starting.
> If internet is still not available after that, the offline buffer handles it.

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

---

## Powerbank Wiring

```
[Powerbank USB-C PD port] ──── USB-C cable (5A) ────► [Raspberry Pi 5 USB-C Power Input]
```

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Output protocol | USB-C 5V/3A (15W) | USB-C PD 5V/5A (25W) |
| Capacity | 10,000 mAh | 20,000 mAh |
| Cable | USB-C rated 3A | USB-C rated 5A (E-Marked) |

> ⚠️ Connect to the Pi 5's **USB-C power port** (top edge), NOT the USB-A data ports.

---

## Connectivity (Hotspot / 4G Dongle)

See **[CONNECTIVITY.md](CONNECTIVITY.md)** for step-by-step instructions on:
- Connecting to a soldier's mobile hotspot (pre-saved, auto-connects)
- Setting up a USB 4G LTE dongle (Huawei E3372 recommended)
- Dual connectivity with automatic fallback

---

## 8 · Hardware Watchdog (P8 — prevents silent freezes)

If `main.py` deadlocks on an I2C bus hang, the process stays alive but frozen.
Systemd's `Restart=always` won't help — it only triggers when the process exits.
The Pi hardware watchdog forces a reboot if it doesn't receive a "keep-alive" signal.

```bash
# 1. Enable watchdog daemon
sudo systemctl enable watchdog
sudo systemctl start watchdog

# 2. Configure /etc/watchdog.conf (open with nano)
sudo nano /etc/watchdog.conf
```

Add / uncomment these lines:
```
watchdog-device = /dev/watchdog
watchdog-timeout = 15
interval = 1
```

Then restart:
```bash
sudo systemctl restart watchdog
```

> The main.py script does **not** need to explicitly feed the watchdog — systemd's
> `WatchdogSec` integration handles this automatically as long as the service
> is reporting active. For belt-and-suspenders reliability, you can optionally
> add `sd_notify` or a file-touch heartbeat inside the main loop.

---

## 9 · Check status during demo

```bash
# Run the health check from your laptop (no monitor needed):
ssh pi@raspberrypi.local "bash ~/tbtn/health_check.sh"
```

This shows: service status, internet state, offline buffer count, recent logs, and powerbank voltage.
