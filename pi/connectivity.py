"""
connectivity.py — Internet availability check for T-BTN Army Dog Wearable
==========================================================================
A lightweight helper that tests whether the Pi currently has a working
internet connection by attempting a TCP connection to Google's DNS.

Works whether the Pi is connected via:
  - Mobile hotspot (Wi-Fi)
  - USB 4G LTE dongle (wwan0 / eth1)
  - Home/base Wi-Fi (wlan0)

Usage
-----
    from connectivity import has_internet
    if has_internet():
        upload_to_firestore()
    else:
        save_to_local_buffer()
"""

import socket
import logging

log = logging.getLogger("T-BTN.connectivity")

# Google's public DNS — reliable, fast, always up
_CHECK_HOST = "8.8.8.8"
_CHECK_PORT = 53
_TIMEOUT_SEC = 3


def has_internet() -> bool:
    """
    Return True if the Pi can reach the internet right now.

    This is a TCP-level check (no HTTP overhead) so it's fast (~50 ms)
    and works even if DNS is misconfigured on the Pi.
    """
    try:
        socket.setdefaulttimeout(_TIMEOUT_SEC)
        with socket.create_connection((_CHECK_HOST, _CHECK_PORT)):
            return True
    except OSError:
        return False


def wait_for_internet(timeout_sec: int = 120, retry_interval_sec: int = 5) -> bool:
    """
    Block until internet is available or `timeout_sec` elapses.

    Used at boot time to give the network stack time to come up before
    attempting to connect to Firebase.

    Returns True if internet became available, False if timed out.
    """
    import time

    elapsed = 0
    log.info("Waiting for internet connection (timeout %ds)...", timeout_sec)
    while elapsed < timeout_sec:
        if has_internet():
            log.info("Internet available after %ds.", elapsed)
            return True
        time.sleep(retry_interval_sec)
        elapsed += retry_interval_sec
    log.warning("Internet not available after %ds. Running in offline mode.", timeout_sec)
    return False


def active_interface() -> str:
    """
    P14: Return the name of the network interface currently carrying internet traffic.
    Useful for logging whether data is going via Wi-Fi hotspot (wlan0) or 4G dongle (eth1/usb0).

    Returns the interface name (e.g. 'wlan0', 'eth1') or 'unknown' on error.
    """
    import subprocess
    try:
        out = subprocess.check_output(
            ["ip", "route", "get", "8.8.8.8"], text=True, timeout=3
        )
        tokens = out.split()
        if "dev" in tokens:
            return tokens[tokens.index("dev") + 1]
    except Exception:
        pass
    return "unknown"
