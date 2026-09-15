"""
send_email.py - High-Performance Direct Gmail SMTP Dispatcher
Utilizes Python's native smtplib to send up to 500 emails/day directly via Gmail SMTP,
bypassing the 100 emails/day restriction of Google Apps Script.
"""

import sys
import os
import json
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from email.utils import formataddr, formatdate, make_msgid
from pathlib import Path

# Load environment variables manually if python-dotenv is not installed
def load_env():
    env_path = Path(__file__).resolve().parent / '.env'
    if env_path.exists():
        try:
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_env()

GMAIL_USER = os.environ.get('GMAIL_USER', 'nourishnetwork.official@gmail.com')
GMAIL_APP_PASS = os.environ.get('GMAIL_APP_PASS', 'mrqkdqumrbihwncd').replace(' ', '')
SENDER_NAME = os.environ.get('SENDER_NAME', 'Nourish Network')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_SSL_PORT = int(os.environ.get('SMTP_SSL_PORT', 465))
SMTP_TLS_PORT = int(os.environ.get('SMTP_TLS_PORT', 587))

def strip_html_tags(text):
    """Generate a clean plain-text fallback from HTML to maximize anti-spam score."""
    clean = re.sub(r'<style.*?>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<script.*?>.*?</script>', '', clean, flags=re.DOTALL | re.IGNORECASE)
    clean = re.sub(r'<br\s*/?>', '\n', clean, flags=re.IGNORECASE)
    clean = re.sub(r'</p>', '\n\n', clean, flags=re.IGNORECASE)
    clean = re.sub(r'<[^<]+?>', '', clean)
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    return clean.strip()

def send_mail(to_email, subject, html_content):
    if not to_email:
        raise ValueError("Missing recipient email address ('to').")
    if not subject:
        subject = "Notification from Nourish Network"
    if not html_content:
        html_content = "<p>No content provided.</p>"

    # 1. Construct MIME message
    msg = MIMEMultipart('alternative')
    msg_id = make_msgid(domain='nourishnetwork.org')
    
    # Headers
    msg['Message-ID'] = msg_id
    msg['Date'] = formatdate(localtime=True)
    msg['From'] = formataddr((str(Header(SENDER_NAME, 'utf-8')), GMAIL_USER))
    msg['To'] = to_email
    msg['Subject'] = Header(subject, 'utf-8')
    msg['MIME-Version'] = '1.0'

    # Anti-Spam: Add both Plain Text and HTML versions (multipart/alternative)
    plain_text = strip_html_tags(html_content)
    part_text = MIMEText(plain_text, 'plain', 'utf-8')
    part_html = MIMEText(html_content, 'html', 'utf-8')
    msg.attach(part_text)
    msg.attach(part_html)

    last_error = None

    # 2. Try Port 465 (SSL) first (Fastest, direct encrypted connection)
    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_SSL_PORT, timeout=12) as server:
            server.login(GMAIL_USER, GMAIL_APP_PASS)
            server.send_message(msg)
            return {
                "success": True,
                "messageId": msg_id,
                "via": f"python-smtp-ssl-{SMTP_SSL_PORT}"
            }
    except Exception as e:
        last_error = e

    # 3. Fallback to Port 587 (STARTTLS) if Port 465 is blocked by network
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_TLS_PORT, timeout=12) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(GMAIL_USER, GMAIL_APP_PASS)
            server.send_message(msg)
            return {
                "success": True,
                "messageId": msg_id,
                "via": f"python-smtp-tls-{SMTP_TLS_PORT}"
            }
    except Exception as e:
        last_error = e

    raise RuntimeError(f"All SMTP attempts failed. Last error: {str(last_error)}")

def main():
    try:
        # Read payload from stdin (JSON)
        input_data = sys.stdin.read()
        if not input_data.strip():
            # Allow CLI args for testing: python send_email.py <to> <subject> <html>
            if len(sys.argv) >= 4:
                payload = {
                    "to": sys.argv[1],
                    "subject": sys.argv[2],
                    "html": sys.argv[3]
                }
            else:
                print(json.dumps({"success": False, "error": "No input provided via stdin or CLI args."}))
                sys.exit(1)
        else:
            payload = json.loads(input_data)

        to_email = payload.get('to') or payload.get('toEmail')
        subject = payload.get('subject', '')
        html = payload.get('html', '')

        result = send_mail(to_email, subject, html)
        print(json.dumps(result))
        sys.exit(0)

    except Exception as err:
        err_response = {"success": False, "error": str(err)}
        print(json.dumps(err_response))
        sys.exit(1)

if __name__ == '__main__':
    main()
