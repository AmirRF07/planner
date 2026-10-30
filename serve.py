#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
لوکال سرور وب اختصاصی برای اجرای سامانه هوشمند برنامه‌ریزی تاریخ ایران
سازگار با پایتون ۳ و ویندوز همراه با قابلیت همگام‌سازی شبکه محلی (LAN Sync)
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import socket
import json
import datetime

# تنظیم خروجی کنسول روی UTF-8 برای جلوگیری از خطای یونیکد در ویندوز
try:
    if sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
    if sys.stderr.encoding.lower() != 'utf-8':
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIRECTORY, "user_study_data.json")

def get_local_ip():
    """یافتن آدرس IP شبکه محلی (LAN) جهت اتصال گوشی یا سایر دستگاه‌ها"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # پشتیبانی از CORS و جلوگیری از کش برای کارکرد مطلوب PWA و همگام‌سازی
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # مسیر همگام‌سازی خواندن داده‌ها
        if self.path == '/api/sync' or self.path.startswith('/api/sync?'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                try:
                    with open(DATA_FILE, 'r', encoding='utf-8') as f:
                        data = f.read()
                    self.wfile.write(data.encode('utf-8'))
                except Exception as e:
                    err_resp = json.dumps({"error": str(e), "exists": False})
                    self.wfile.write(err_resp.encode('utf-8'))
            else:
                empty_resp = json.dumps({"empty": True, "message": "هنوز داده‌ای ذخیره نشده است."})
                self.wfile.write(empty_resp.encode('utf-8'))
            return

        return super().do_GET()

    def do_POST(self):
        # مسیر ذخیره همگام‌سازی داده‌ها از کلاینت
        if self.path == '/api/sync':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                post_body = self.rfile.read(content_len).decode('utf-8')
                parsed_json = json.loads(post_body)

                with open(DATA_FILE, 'w', encoding='utf-8') as f:
                    json.dump(parsed_json, f, ensure_ascii=False, indent=2)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                resp = json.dumps({
                    "status": "ok",
                    "updatedAt": datetime.datetime.now().isoformat(),
                    "sizeBytes": len(post_body)
                })
                self.wfile.write(resp.encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                resp = json.dumps({"status": "error", "message": str(e)})
                self.wfile.write(resp.encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def main():
    os.chdir(DIRECTORY)
    port = PORT
    lan_ip = get_local_ip()

    for attempt in range(5):
        try:
            with socketserver.TCPServer(("", port), Handler) as httpd:
                local_url = f"http://localhost:{port}/index.html"
                lan_url = f"http://{lan_ip}:{port}/index.html"

                print("=" * 72)
                print("  🏛️  سامانه هوشمند برنامه‌ریزی تحصیلات تکمیلی تاریخ ایران (دوره اسلامی)")
                print(f"  💻 اجرای محلی (روی همین رایانه):  {local_url}")
                print(f"  📱 دسترسی از طریق موبایل و شبکه محلی: {lan_url}")
                print(f"  🔄 مسیر همگام‌سازی داده‌ها (LAN Sync):  http://{lan_ip}:{port}/api/sync")
                print("  برای خروج و توقف سرور کلیدهای Ctrl + C را فشار دهید.")
                print("=" * 72)

                try:
                    webbrowser.open(local_url)
                except Exception:
                    pass

                httpd.serve_forever()
                break
        except OSError:
            port += 1

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nسرور با موفقیت متوقف شد.")
        sys.exit(0)
