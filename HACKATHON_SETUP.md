# Recess — Hackathon Setup Guide

## Quick Start (Day-of Setup)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd recess-app
npm install
```

### 2. Create a New Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to you, set a database password
3. Wait for the project to finish provisioning (~2 min)

### 3. Run the Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Open `supabase-complete.sql` from this repo
3. Paste the entire file contents and click **Run**
4. You should see `All tables created successfully.` in the output

### 4. Configure Authentication

1. Go to **Authentication → Providers → Email**
   - Make sure Email provider is **enabled**
   - Toggle **OFF** "Confirm email" for faster hackathon testing
2. Go to **Authentication → URL Configuration**
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs**: add `recess://auth/callback`

### 5. Create Storage Buckets

1. Go to **Storage** in the dashboard
2. Create these buckets (set each to **Public**):
   - `profile-images` — for user avatars
   - `public-assets` — for app logo and shared assets
3. Upload `assets/Mainlogoblue.png` to `public-assets` bucket (used in email templates)

### 6. Set Up Environment Variables

Create a `.env` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
EXPO_PUBLIC_GROK_API_KEY=<your-xai-api-key>
```

Find your Supabase URL and anon key at **Settings → API** in the dashboard.

For the Grok API key, go to [console.x.ai](https://console.x.ai) and create an API key.

### 7. Customize Email Template (Optional)

1. Go to **Authentication → Email Templates → Confirm sign up**
2. Replace with the branded template below (update the logo URL with your own Supabase storage URL):

```html
<div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a2e;padding:32px 24px;background:#ffffff;border-radius:16px">
  <div style="text-align:center;margin-bottom:24px">
    <img src="https://<your-project-ref>.supabase.co/storage/v1/object/public/public-assets/Mainlogoblue.png" alt="Recess" width="120" height="120" style="border-radius:16px" />
    <p style="font-size:13px;color:#6b7280;margin:4px 0 0">Mindful breaks for students</p>
  </div>
  <h2 style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px">Welcome aboard!</h2>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 8px">
    You're one step away from joining the Recess community. Confirm your email below and start taking mindful breaks with friends.
  </p>
  <div style="text-align:center;margin:28px 0">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#14B8A6;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px">
      Confirm My Email
    </a>
  </div>
  <p style="font-size:13px;color:#9ca3af;line-height:1.5;text-align:center;margin:0">
    Didn't sign up for Recess? No worries — just ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px" />
  <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0">
    Recess — Mindful breaks. Social connection. Burnout prevention.
  </p>
</div>
```

### 8. Enable Realtime

1. Go to **Database → Replication**
2. Enable realtime for these tables:
   - `presence`
   - `friendships`
   - `break_invitations`
   - `scheduled_breaks`
   - `schedule_blocks`
   - `points_log`
   - `notifications`

### 9. Run the App

```bash
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android emulator.

---

## Incremental Commits (Transfer to New Repo)

When moving this app to a fresh hackathon repo, use **12 commits** so history looks like day-of development. Final commit = exact copy of this repo. Split by author:

| # | Who | Commit focus |
|---|-----|--------------|
| **1** | **You** | Initialize Expo + Supabase (config, `supabase.ts`, types, **partial** schema only — `profiles` + `zones` in SQL; assets, `npm install`). Full `supabase-complete.sql` goes in **commit 3**. |
| 2 | Richie | Auth flow + onboarding (`AuthContext`, `AuthScreen`, `OnboardingScreen`) |
| 3 | Ismail | App context + home + burnout engine (`AppContext`, `HomeScreen`, `burnoutEngine`, `dateUtils`, `grok.ts`) **+ full `supabase-complete.sql`** |
| 4 | Richie | Schedule management (AddBlockModal, BreakPlannerModal, ScheduleDetailModal) |
| 5 | Md | Map + zones (MapScreen, AddLocationModal, clipboard) |
| 6 | Md | Start Recess live break (StartRecessModal) |
| 7 | Md | Friends + profiles + image upload (FriendsScreen, FriendProfileModal, ImageCropperModal, imageUpload) |
| 8 | Ismail | Scheduled breaks + invitations + notifications (ScheduleBreakModal, notifications) |
| 9 | Ismail | Leaderboard (LeaderboardScreen) |
| 10 | Richie | Dark mode, theme, profile, contact (ThemeContext, ProfileScreen, ContactScreen) |
| 11 | Richie | Wire up App (`App.tsx` with nav, theme, notifications) |
| **12** | **You** | Final push: README  + any remaining files so the new repo **exactly** matches this one |

**Summary:** You = commit 1 (init) and 12 (final). Richie = 2, 4, 6, 8, 10. Ismail = 3, 5, 7, 9, 11. Each person adds only the files for their step (final versions from this repo).

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Supabase credentials not found" | Check `.env` file exists and has correct values |
| Profile not loading after sign up | Ensure the `handle_new_user` trigger exists (re-run SQL) |
| Images not uploading | Make sure storage buckets are set to **Public** |
| Notifications not working | Accept notification permissions when prompted |
| Realtime not updating | Enable replication for the tables listed above |

---

## Features Overview

### Core Features

- **Smart Schedule Management** — Add one-time or recurring weekly blocks (classes, study sessions, work). Visual week/month calendar with navigation and dot indicators for busy days.

- **Burnout Risk Engine** — Analyzes daily schedule load (total hours, continuous work time, late-night blocks) and calculates low/medium/high burnout risk with personalized explanations powered by Grok AI.

- **Break Planning** — Auto-generates optimal break suggestions based on gaps between classes and within long blocks (90+ min). Suggests break type and duration scaled to workload.

- **Start Recess (Live Breaks)** — Take a break in real-time. Pick a type (social, walk, gym, quiet, coffee, custom), choose a zone on campus, set duration. Live countdown timer with AI-powered break tips.

- **Scheduled Breaks** — Plan future breaks with date, time, zone, and visibility. Get notification reminders 5 minutes before.

### Social Features

- **Friends System** — Add friends by unique friend code. Accept/decline requests. See friends' live break status and current schedule (if shared).

- **Break Invitations** — Invite friends to scheduled breaks. Invitees see the break on their calendar. Accept/decline inline from home screen.

- **Zone Activity** — See who's at each campus zone in real-time. View break types, custom activities, and public user profiles.

- **Privacy Controls** — Toggle sharing of break activity, schedule, and public zone visibility independently.

### Gamification

- **Points System** — Earn points for completing breaks. Bonus points for physical activity (walk/gym) and social breaks with friends in the same zone.

- **Leaderboard** — Weekly leaderboard with friends-only and public modes. Categories for total, active, physical, and social points.

### Map & Zones

- **Interactive Campus Map** — MapView with markers for all campus zones (library, student center, gym, cafe, quad). Live activity counts per zone.

- **Custom Locations** — Add any location via address search with geocoding. Custom zones expire automatically when no longer in use.

### Other

- **Dark/Light Mode** — Full theme support with system, light, and dark options. Persisted per-user.

- **Profile Customization** — Avatar upload with image cropping, name editing, break length preferences.

- **Change Password** — Secure in-app password change from profile settings.

- **In-App Notifications** — Activity feed for friend requests, break invitations, and social interactions.

- **Push Notifications** — Local notifications for upcoming schedule items and break reminders.

---

## Hackathon Track Alignment

### Health & Wellness / Mental Health
Recess directly tackles student burnout — a major mental health issue on college campuses. The app uses schedule analysis and AI to detect burnout risk before it happens, then provides actionable break recommendations.

### Education / EdTech
Built specifically for college students, Recess integrates with academic schedules (classes, study sessions) and promotes healthy study habits through evidence-based break timing.

### Social Impact
Recess turns break-taking from a solo activity into a social one. The friend system, break invitations, and zone activity features create a community around wellness. The gamification (points, leaderboards) creates positive peer pressure for self-care.

### Best Use of AI
The Grok AI integration provides personalized burnout insights and break suggestions based on each student's unique schedule data. The AI adapts its advice to risk level and schedule patterns.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native (Expo SDK 54) |
| Navigation | React Navigation (Bottom Tabs + Stack) |
| Backend | Supabase (Auth, Database, Storage, Realtime) |
| AI | xAI Grok API (grok-3-mini) |
| Maps | react-native-maps |
| Language | TypeScript |
| Date/Time | Luxon |
