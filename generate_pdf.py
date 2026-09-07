import os
from fpdf import FPDF

class CustomPDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(100, 116, 139)
        self.cell(0, 6, 'NOURISH NETWORK -- SIH 2026 PRESENTATION & TECHNICAL GUIDE', new_x="LMARGIN", new_y="NEXT", align='R')
        self.set_draw_color(226, 232, 240)
        self.line(10, 16, 200, 16)
        self.ln(6)

    def footer(self):
        self.set_y(-12)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f'Page {self.page_no()} of {{nb}}  |  Team Pixel  |  Smart India Hackathon 2026', align='C')

def clean(text):
    return text.replace('—', '--').replace('•', '*').replace('^', '')

def create_pdf(filename):
    pdf = CustomPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title Banner
    pdf.set_fill_color(16, 185, 129) # Emerald Green
    pdf.rect(10, 20, 190, 24, style='F')
    
    pdf.set_xy(15, 23)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 8, 'NOURISH NETWORK', new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_x(15)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'SIH 2026 Team Presentation Guide & Technical Reference Manual', new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(10)
    
    def section_heading(title):
        pdf.set_font('Helvetica', 'B', 12)
        pdf.set_text_color(15, 23, 42)
        pdf.set_fill_color(241, 245, 249)
        pdf.cell(0, 8, f'  {clean(title)}', new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.ln(3)

    def sub_heading(title):
        pdf.set_font('Helvetica', 'B', 10.5)
        pdf.set_text_color(30, 41, 59)
        pdf.cell(0, 6, clean(title), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)

    def body_text(text):
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(51, 65, 85)
        pdf.multi_cell(0, 4.5, clean(text))
        pdf.ln(2)

    def bullet_point(title, desc):
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(16, 185, 129)
        pdf.write(4.5, '  * ')
        pdf.set_text_color(30, 41, 59)
        pdf.write(4.5, f'{clean(title)}: ')
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(51, 65, 85)
        pdf.write(4.5, f'{clean(desc)}\n')
        pdf.ln(1)

    # -------------------------------------------------------------
    # SECTION 1: PRESENTATION SLIDE UPDATES
    # -------------------------------------------------------------
    section_heading('SECTION 1: SIH 2026 PRESENTATION SLIDE UPDATES')
    body_text('Below are the exact updated text blocks for Slides 3, 4, and 6 to ensure your presentation matches your actual codebase and stands up to judge technical Q&A.')
    
    sub_heading('Slide 3: Technical Approach (Copy & Paste Ready)')
    bullet_point('Frontend', 'HTML5, Vanilla JavaScript (ES6+), Vanilla CSS')
    bullet_point('Backend', 'Node.js + Express.js REST API')
    bullet_point('Database/Auth', 'PostgreSQL (Supabase Cloud), SQLite3 (WAL Fallback), JWT, bcryptjs, Firebase Auth')
    bullet_point('Architecture Flow', 'User Action -> Express REST API -> Database Sync -> Email Dispatch (Google Apps Script / Nodemailer) -> Role Steering -> Vendor/NGO Dashboard')
    pdf.ln(2)

    sub_heading('Slide 4: Feasibility and Viability (Copy & Paste Ready)')
    bullet_point('Feasibility', 'Lightweight, cost-effective cloud architecture using Node.js, Express.js, PostgreSQL, and SQLite.')
    bullet_point('Feasibility (Scale)', 'Easy to deploy, maintain, and scale seamlessly based on user demand.')
    bullet_point('Viability (Network)', 'Creates a sustainable network connecting food businesses, NGOs, and communities.')
    bullet_point('Viability (CSR)', 'Potential partnerships with corporate CSR initiatives can support operational growth.')
    pdf.ln(2)

    sub_heading('Slide 6: Research and References (Copy & Paste Ready)')
    bullet_point('Reference 1', 'UNEP Food Waste Index Report -- Food waste and sustainability insights.')
    bullet_point('Reference 2', 'FSSAI -- Save Food Share Food Initiative -- Guidance on surplus food redistribution.')
    bullet_point('Reference 3', 'FSSAI Surplus Food Guidelines -- Food safety and handling considerations.')
    bullet_point('Reference 4', 'Companies Act, 2013 -- Section 135 -- CSR framework.')
    bullet_point('Reference 5', 'Google Apps Script, Nodemailer & Firebase Documentation')
    bullet_point('Reference 6', 'Node.js, Express.js, PostgreSQL & SQLite Documentation')
    pdf.ln(4)

    # -------------------------------------------------------------
    # SECTION 2: BASIC TECHNICAL CONCEPTS
    # -------------------------------------------------------------
    section_heading('SECTION 2: BASIC TECHNICAL CONCEPTS (SIMPLE EXPLANATIONS)')
    body_text('Use these everyday analogies when explaining the platform concepts to your teammates or judges.')
    
    bullet_point('Frontend (The Screen & Buttons)', 'Everything the user sees and clicks on their screen (HTML layout, CSS styling, JavaScript clicks). Files: index.html, dashboard.html, script.js.')
    bullet_point('Backend (The Hidden Engine)', 'The server running behind the scenes (server.js using Node.js & Express). It verifies passwords, saves food listings, and sends email alerts.')
    bullet_point('Database (The Digital Filing Cabinet)', 'The place where all data (user accounts, food listings, claimed orders) is permanently stored so it is not lost when the browser closes.')
    bullet_point('API (The Restaurant Waiter)', 'An API (Application Programming Interface) carries requests from the frontend to the backend and brings back the response. Analogy: You (Frontend) order food from the Waiter (API), who takes it to the Kitchen (Backend) and brings back your meal.')
    bullet_point('REST API (Standardized Menu)', 'A REST API follows standard web methods: POST /api/register (create account), POST /api/login (sign in), GET /api/listings (fetch meals), POST /api/orders (claim meal).')
    bullet_point('API Key (VIP Access Pass)', 'A secret password key that allows your software to talk to third-party services securely (e.g., Google Firebase API keys).')
    pdf.ln(4)

    # -------------------------------------------------------------
    # SECTION 3: DEEP-DIVE TECHNICAL Q&A
    # -------------------------------------------------------------
    section_heading('SECTION 3: DEEP-DIVE TECHNICAL Q&A FOR PRESENTATIONS')
    
    sub_heading('Q1: Why are there TWO databases (PostgreSQL + SQLite) in your code?')
    body_text('* Local SQLite (database.sqlite): Perfect for local offline testing on your laptop without internet or cloud credentials. Runs in WAL (Write-Ahead Logging) mode for fast concurrent operations.\n* Cloud PostgreSQL (Supabase): When deployed on live cloud hosts (Render.com), free servers restart often and wipe local laptop files. PostgreSQL on Supabase keeps all data permanently safe in the cloud.\n* In code (database.js): The server checks process.env.DATABASE_URL. If present, it connects to Supabase PostgreSQL; otherwise, it falls back to local SQLite.')
    pdf.ln(2)

    sub_heading('Q2: What is a Salt Round? (SALT_ROUNDS = 10)')
    body_text('* Plaintext passwords like "myPass123" are NEVER stored. They are scrambled (hashed) into gibberish using bcryptjs.\n* A "Salt" is a random string added to the password before scrambling so two users with "123456" get completely different hashes.\n* "10 Salt Rounds" means the algorithm scrambles the password 2^10 = 1,024 times in a loop! This prevents hacker supercomputers from guessing passwords, while real users log in in 0.05 seconds.')
    pdf.ln(2)

    sub_heading('Q3: Is it Verified Vendor or Verified NGO?')
    body_text('* BOTH are verified, but for different safety purposes!\n* Verified Vendors (Food Safety): Vendors must enter a valid 14-digit FSSAI Code. Your system decodes and verifies their license to ensure food safety.\n* Verified NGOs (Targeted Alerts): When vendors post surplus food, server.js sends real-time email alerts ONLY to verified NGOs (isVerified = 1) who activated their account. This prevents spammers from taking free community meals.')
    pdf.ln(2)

    sub_heading('Q4: What is the Dual-Engine Email Dispatcher?')
    body_text('* Engine 1 (Google Apps Script HTTPS Bridge - Primary): Cloud hosts like Render block SMTP ports (587/465). mailer.js calls a Google Apps Script HTTPS URL on standard Web Port 443 to send emails smoothly.\n* Engine 2 (Nodemailer SMTP - Fallback): When testing locally on a laptop, mailer.js uses standard Gmail SMTP.\n* Combined Result: 100% reliable email delivery on both cloud and local environments!')
    pdf.ln(4)

    pdf.output(filename)
    print(f"SUCCESS: PDF created at {filename}")

if __name__ == '__main__':
    pdf_path = r'd:\ANTIGRAVITY files\NOURISH NETWORK\Nourish_Network_Team_Guide.pdf'
    create_pdf(pdf_path)
