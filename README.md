# TheAgriDoctor 🌾
### AI-Powered Smart Agriculture & Crop Disease Diagnosis Platform

🚀 Live Demo: https://theagridoctor.vercel.app/

---

## Overview

TheAgriDoctor is a modern AI-powered agriculture platform designed to assist farmers with intelligent crop disease diagnosis, personalized agricultural guidance, weather intelligence, NDVI monitoring, and smart farm management.

The platform combines AI, geospatial technologies, and modern full-stack architecture to provide real-time decision support for farmers.

Built using Next.js 14, Supabase, OpenRouter AI, Gemini AI, and OpenWeather APIs.

---

# Features

## 🌱 AI Crop Disease Diagnosis
- Upload up to 5 crop images
- AI-powered disease detection
- Severity analysis
- Treatment recommendations
- Prevention suggestions
- Yield impact estimation

## 🤖 Personalized AI Farming Advisor
- Real-time streaming AI chat
- Context-aware agricultural assistance
- Voice input support
- Multilingual responses
- Farm-specific recommendations

## 🌦 Weather & NDVI Intelligence
- Real-time weather monitoring
- Soil temperature tracking
- UV index monitoring
- NDVI satellite visualization
- 5-day forecasting

## 🗺 Smart Farm Management
- Multi-farm support
- Crop cycle tracking
- GeoJSON polygon mapping
- Stage-wise crop task generation

## 📊 Community & Alerts
- Farmer discussion platform
- AI-assisted replies
- Smart notifications
- Agricultural alerts
- Diagnosis heatmaps

---

# Tech Stack

## Frontend
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- shadcn/ui
- Zustand
- TanStack Query
- React Hook Form
- Zod

## Backend
- Next.js Route Handlers
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage

## AI & APIs
- OpenRouter AI
- Gemini 2.5 Flash
- OpenWeather Agro API
- Leaflet Maps

## Deployment
- Vercel
- Supabase Cloud

---

# System Architecture

- Next.js App Router frontend
- Server Components + Route Handlers
- Supabase PostgreSQL database
- JWT authentication
- Multi-provider AI fallback system
- Edge-ready deployment architecture

---

# AI Pipeline

```txt
OpenRouter Vision Models
    ↓
Gemma Vision
    ↓
Qwen VL
    ↓
Llama Vision
    ↓
Gemini 2.5 Flash Fallback
```

This architecture ensures reliability even during provider failures or rate limits.

---

# Core Modules

- Authentication & Profile Management
- Farm Management
- Crop Cycle Tracking
- AI Disease Diagnosis
- Personalized AI Advisor
- Weather & NDVI Dashboard
- Market Price Browser
- Community Forum
- Smart Alerts & Notifications

---

# Performance & Security

- JWT-based authentication
- RLS-ready database schema
- Secure image uploads
- Optimized API routes
- Dynamic component loading
- Mobile responsive UI
- Edge deployment optimization

---

# Installation

Clone the repository:

```bash
git clone https://github.com/koushikreddy-p/TheAgriDoctor.git
```

Navigate into the project directory:

```bash
cd TheAgriDoctor
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

---

# Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENROUTER_API_KEY=
GEMINI_API_KEY=

OPENWEATHER_API_KEY=
```

---

# Project Highlights

- Production-ready full-stack architecture
- AI-powered agriculture assistance
- Real-time streaming AI chat
- Multi-provider AI fallback system
- Geo-spatial farm visualization
- Mobile-first responsive dashboard
- Cloud-native deployment

---

# Future Improvements

- Offline diagnosis support
- Native mobile application
- Push notifications
- AI-powered yield prediction
- IoT sensor integration
- Advanced multilingual support

---

# Screenshots

Add project screenshots inside:

```txt
/screenshots
```

Suggested screenshots:
- Dashboard
- AI Diagnosis
- Advisor Chat
- Weather Module
- Heatmap
- Farm Management

---

# Author

## Poreddy Koushik Reddy

Final Year Computer Science Engineering Student  
Full Stack Developer | AI Enthusiast

GitHub: https://github.com/koushikreddy-p

You can Download full document [HERE](https://drive.google.com/uc?export=download&id=1vNIu23TJUaoKOJCpWa4gMY2Y_vItQwga)

---

# Live Demo

🌐 https://theagridoctor.vercel.app/
