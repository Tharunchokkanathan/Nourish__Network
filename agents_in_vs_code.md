# 🚀 Complete Setup Guide: Free AI Agents in VS Code & Terminal (OmniRoute + Gemini + Continue + Cline)

This master guide explains how to set up an **unlimited, free 1M-token local AI development environment** using **OmniRoute Gateway**, **Claude Code CLI**, and **VS Code Extensions (Continue & Cline)**. Share this guide with friends to help them configure their ultimate free AI setup!

---

## 🛠️ Part 1: OmniRoute AI Gateway Setup

**OmniRoute** is a local proxy server running on your machine at `http://localhost:20128/v1`. It connects to free AI providers (like Google AI Studio and OpenRouter) and transforms them into an OpenAI/Anthropic-compatible endpoint.

### Step 1.1: Get Free Provider API Keys
1. **Google AI Studio**: Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) and create 1 to 3 free API keys.
2. **OpenRouter (Optional)**: Go to [openrouter.ai/keys](https://openrouter.ai/keys) and generate a free API key.

### Step 1.2: Connect Keys in OmniRoute
1. Open OmniRoute Dashboard (`http://localhost:20128`).
2. Go to **Providers** → Click **Gemini** → Click `+ Add` → Paste your Google API keys.
3. *Pro-Tip*: Adding 2-3 keys enables automatic load-balancing so you never hit rate limit cooldowns!

---

## 💻 Part 2: Terminal Setup (Claude Code CLI)

To run the official `claude-code` CLI using your free local Gemini model:

1. Open **PowerShell**.
2. Run these commands:
   ```powershell
   $env:ANTHROPIC_BASE_URL="http://localhost:20128/v1"
   $env:ANTHROPIC_API_KEY="omniroute"
   $env:ANTHROPIC_MODEL="gemini/gemini-3-flash-preview"
   claude
   ```
3. Type `hi` and press Enter—you're running Claude CLI powered by Gemini 3 Flash for free!

---

## 🎨 Part 3: VS Code Setup (Continue Extension)

**Continue** gives you a full AI chat sidebar and inline code editing right inside VS Code.

### Step 3.1: Install Extension
1. Open VS Code → Press `Ctrl + Shift + X` (Extensions).
2. Search for `Continue` → Click **Install**.

### Step 3.2: Global Configuration File
Save the following configuration into your user folder (`C:\Users\<Your-Username>\.continue\config.yaml`):

```yaml
name: Main Config
version: 1.0.0
schema: v1
models:
  - name: Gemini 3 Flash Preview (FASTEST & FREE)
    title: Gemini 3 Flash Preview (FASTEST & FREE)
    provider: openai
    model: gemini/gemini-3-flash-preview
    apiBase: http://localhost:20128/v1
    apiKey: omniroute
  - name: Gemini 3.5 Flash
    title: Gemini 3.5 Flash
    provider: openai
    model: gemini/gemini-3.5-flash
    apiBase: http://localhost:20128/v1
    apiKey: omniroute
  - name: Gemini 2.5 Flash
    title: Gemini 2.5 Flash
    provider: openai
    model: gemini/gemini-2.5-flash
    apiBase: http://localhost:20128/v1
    apiKey: omniroute
```

### Step 3.3: Reload VS Code
1. Press `Ctrl + Shift + P` → Type `Reload Window` → Press Enter.
2. Press `Ctrl + L` to open the Continue sidebar.
3. Click `Select model ∨` → Choose **`Gemini 3 Flash Preview`**.

---

## 🤖 Part 4: VS Code Setup (Cline Extension)

**Cline** is an autonomous coding agent that builds features, runs commands, and creates files.

1. Open Extensions (`Ctrl + Shift + X`) → Search `Cline` → Click **Install**.
2. Press `Ctrl + Shift + P` → Type `Cline: Focus on Primary Side Bar View` → Press Enter.
3. Click the **Gear ⚙️ Settings icon** in the Cline panel.
4. Configure these fields:
   - **API Provider**: `OpenAI Compatible`
   - **Base URL**: `http://localhost:20128/v1`
   - **API Key**: `omniroute`
   - **Model ID**: `gemini/gemini-3-flash-preview`

---

## 🔥 Part 5: Daily AI Superpowers

| Action | Shortcut / Trigger | Description |
| :--- | :--- | :--- |
| **Open Chat Sidebar** | `Ctrl + L` | Opens Continue chat window |
| **In-Line Code Edit** | Highlight code + `Ctrl + I` | Rewrites selected code in-place |
| **Attach Files to Context** | Type `@filename` in chat | Gives AI full context of any file |
| **Apply Code Snippets** | Click `Apply 📥` in chat | Injects code directly into open document |
| **Commit & Push Code** | VS Code Source Control tab | Stage, commit message, and push to GitHub |

---
*Created for Nourish Network & Friends! Happy Coding!* 🚀
