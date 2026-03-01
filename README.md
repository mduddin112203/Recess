# Recess - Student Wellbeing App

A mobile app designed to prevent student burnout by scheduling recovery breaks, coordinating downtime with friends, and showing nearby students who are free or on break using a privacy-safe map.

## Hackathon Track: Mindfulness & Wellbeing

Recess directly supports mindfulness and wellbeing by:
- Preventing cognitive overload
- Encouraging intentional breaks
- Reducing loneliness through social features
- Promoting movement
- Reinforcing healthy routines

## Core Features

### 1. Burnout Prevention Engine
- Schedule your classes, study blocks, and work sessions
- Get personalized burnout risk assessment
- AI-powered explanations (via Grok)
- Automatic break plan generation

### 2. Start Recess
- Choose break type: Social, Walk, Gym, Quiet, or Coffee
- Select your zone on campus
- Timer with countdown
- Earn points for completing breaks

### 3. Campus Map
- See which zones have students on break
- View friend counts per zone
- Privacy-safe (no individual tracking)
- Zone-based presence system

### 4. Friends System
- Connect via unique friend codes
- See friends' break status
- Coordinate breaks together
- Earn social points for group recess

### 5. Leaderboard
- Weekly reset for fair competition
- Categories: Total, Active, Physical, Social
- Friends-only leaderboard

## Tech Stack

- **Mobile**: React Native + Expo
- **Backend**: Supabase (Auth, Database, Realtime)
- **Maps**: react-native-maps (Apple Maps on iOS)
- **AI**: Grok API for burnout explanations

## Setup Instructions

### Prerequisites
- Node.js (v20+)
- Xcode (for iOS Simulator)
- Supabase account

### 1. Clone and Install

```bash
cd recess-app
npm install
```

### 2. Environment Setup

Create a `.env` file with your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GROK_API_KEY=your_grok_api_key
```

### 3. Database Setup

1. Go to your Supabase project
2. Open SQL Editor
3. Run the contents of `supabase-schema.sql`

### 4. Enable Authentication

In Supabase Dashboard:
1. Go to Authentication > Providers
2. Enable **Email** provider
3. Enable **Google** provider (optional)
   - Add your Google OAuth credentials
   - Set redirect URL to: `recess://auth/callback`

### 5. Run the App

```bash
npx expo start --ios
```

Press `i` to open in iOS Simulator.

## Demo Flow (For Judges)

1. **Open App** → See burnout risk card
2. **Add Schedule Blocks** → Risk increases
3. **Generate Break Plan** → See suggested breaks
4. **Start Social Recess** → Select Library zone
5. **Map Updates** → Zone shows +1 in recess
6. **End Recess** → Earn points
7. **Leaderboard** → See your rank

## Color Palette

- Primary: `#1FB6A6` (Teal)
- Secondary: `#2F80ED` (Blue)
- Background: `#F8FAFC` (Off-white)
- Text: `#0F172A` (Charcoal)
- Accent: `#A7F3D0` (Mint)

## Points System

| Action | Points | Daily Cap |
|--------|--------|-----------|
| Complete Recess | +8 | 3 sessions |
| Walk | +10 | 2 physical |
| Gym | +12 | 2 physical |
| Friend Overlap | +10 | 30 social |
| Group (3+) | +15 | 30 social |

## Project Structure

```
recess-app/
├── App.tsx                 # Main entry point
├── src/
│   ├── context/           # Auth & App state
│   ├── screens/           # All screens
│   ├── components/        # Modals & UI
│   ├── lib/               # Supabase & Grok
│   ├── utils/             # Constants & helpers
│   └── types/             # TypeScript types
├── supabase-schema.sql    # Database schema
└── .env                   # Environment variables
```

## Team

Built for Stevens Quack Hacks 2026 — Mindfulness & Wellbeing

---

**Remember**: Take breaks. Stay connected. Prevent burnout. 🌿
