# T-BTN — Connectivity Guide (Hotspot + USB 4G Dongle)

This guide explains how to connect the Raspberry Pi 5 to the internet in the field
using either a **soldier's mobile hotspot** or a **USB 4G LTE dongle**.
Both methods work simultaneously — the Pi will prefer whichever is available.

---

## Option A — Mobile Hotspot (Soldier's Phone)

### How does the Pi connect to a hotspot?
The Pi connects to a hotspot **exactly like any Wi-Fi network**.
You pre-save the hotspot's name (SSID) and password **once** on the Pi.
After that, whenever the soldier turns on their hotspot, the Pi auto-connects within ~10 seconds.

### Step 1 — Find your phone's hotspot name and password

**On Android**:
- Settings → Network & Internet → Hotspot & Tethering → Wi-Fi Hotspot
- Note the **Network name (SSID)** and **Password**

**On iPhone (iOS)**:
- Settings → Personal Hotspot
- Note the **Wi-Fi Password** (the hotspot name is your phone's name)

### Step 2 — Add the hotspot to the Pi

SSH into the Pi and run:

```bash
sudo nmcli device wifi connect "YOUR_HOTSPOT_NAME" password "YOUR_HOTSPOT_PASSWORD"
```

**Example** (replace with your actual values):
```bash
sudo nmcli device wifi connect "Raj_iPhone" password "mypassword123"
```

The Pi will connect immediately and remember this network forever.

### Step 3 — Verify it worked

```bash
# Check which Wi-Fi network you're on
nmcli connection show --active

# Confirm internet works
ping -c 3 8.8.8.8
```

### Step 4 — Set priority (prefer hotspot over other networks)

If the Pi knows multiple Wi-Fi networks, set the hotspot as high priority:

```bash
# List saved connections
nmcli connection show

# Set hotspot to highest priority (lower number = higher priority)
sudo nmcli connection modify "YOUR_HOTSPOT_NAME" connection.autoconnect-priority 10
```

> ✅ **That's it!** From now on, when the soldier turns on their hotspot, the Pi
> connects automatically within ~10 seconds — no keyboard or monitor needed.

---

## Option B — USB 4G LTE Dongle

### Compatible dongles (tested with Raspberry Pi OS)

| Brand | Model | Notes |
|-------|-------|-------|
| Jio | JioFi M2S / M2Pro | Works as Wi-Fi hotspot mode only |
| Airtel | AirtelWi-Fi Hotspot | Works as Wi-Fi hotspot mode only |
| Huawei | E3372h-320 | **Best choice** — appears as Ethernet adapter (`eth1`), zero config |
| ZTE | MF833 | Works, may need `usb-modeswitch` |

> 💡 **Recommended for demo**: **Huawei E3372h** — plug it in and the Pi gets internet
> automatically with no configuration, because it pretends to be an Ethernet cable.

### Step 1 — Plug in the dongle

```bash
# Plug the USB dongle into any USB-A port on the Pi 5
# Wait 10 seconds, then check if it's detected:
ip link show
```

You should see a new interface like `eth1`, `usb0`, or `wwan0`.

### Step 2 (Huawei E3372 only — zero config needed)

If you have the Huawei E3372, it shows up as `eth1` automatically and the Pi
gets an IP via DHCP. No further setup required. Verify:

```bash
curl -s https://ipinfo.io/ip   # should print your public IP via 4G
```

### Step 3 (other dongles — usb-modeswitch)

Some dongles start in "storage mode" and need to be switched to modem mode:

```bash
sudo apt install usb-modeswitch -y
# Reboot and re-plug the dongle
sudo reboot
```

### Step 4 — Set metric so dongle is a fallback (optional)

If you want the Pi to prefer home Wi-Fi and only use the dongle when Wi-Fi is gone:

```bash
# Lower metric = preferred. Default Wi-Fi metric is usually 600.
sudo nmcli connection modify "YOUR_4G_CONNECTION" ipv4.route-metric 700
```

---

## Dual Connectivity — Both Hotspot AND Dongle

The Pi can have both configured at the same time:

```
Priority 1 (preferred): Home Wi-Fi or soldier's hotspot (wlan0)
Priority 2 (fallback):  USB 4G LTE dongle (eth1 / usb0)
Priority 3 (offline):   SQLite local buffer (no internet)
```

The `connectivity.py` module checks if **any** interface has internet — it does not
care whether it's Wi-Fi or 4G. If any path is up, data flows to Firebase.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Pi not connecting to hotspot | Run `sudo nmcli device wifi scan` — is the SSID visible? |
| Hotspot connects but no internet | Check phone has mobile data enabled |
| 4G dongle not detected | Try `lsusb` — if dongle shows, run `usb-modeswitch` |
| Pi connects to wrong network | Adjust `autoconnect-priority` (higher number = preferred) |
| Data not reaching Firebase | Run `python3 -c "from connectivity import has_internet; print(has_internet())"` |

---

## Check live connectivity status on the Pi

```bash
# Run the health check script:
bash ~/tbtn/health_check.sh
```
