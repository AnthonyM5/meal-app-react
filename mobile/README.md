# NutriTrack Mobile

React Native version of the NutriTrack nutrition tracking app built with Expo.

## Features

- 🔐 Authentication with Supabase
- 👤 Guest mode for trying the app
- 🍎 Food search and nutrition information
- 📱 Native mobile experience
- 🎨 Clean, modern UI design

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio/Emulator (for Android development)

### Installation

1. **Navigate to the mobile directory**
   ```bash
   cd mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

### Running on Devices

- **iOS**: Press `i` in the terminal or scan the QR code with the Camera app
- **Android**: Press `a` in the terminal or scan the QR code with the Expo Go app
- **Web**: Press `w` in the terminal

## Project Structure

```
mobile/
├── src/
│   ├── components/          # Reusable UI components
│   ├── contexts/           # React contexts (Auth, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities and configurations
│   ├── navigation/         # Navigation setup
│   └── screens/            # Screen components
├── assets/                 # Images, fonts, etc.
├── app.json               # Expo configuration
└── package.json           # Dependencies and scripts
```

## Key Features

### Authentication
- Email/password authentication via Supabase
- Guest mode for trying the app without signing up
- Secure token storage using Expo SecureStore

### Food Database
- Search through comprehensive food database
- View detailed nutrition information
- Same backend as the web version

### Navigation
- Tab-based navigation for main screens
- Stack navigation for detailed views
- Smooth transitions and native feel

## Building for Production

### Android
```bash
npm run build:android
```

### iOS
```bash
npm run build:ios
```

## Deployment

The app can be deployed to:
- **App Store** (iOS)
- **Google Play Store** (Android)
- **Expo Application Services (EAS)**

## Environment Variables

Required environment variables:

- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both iOS and Android
5. Submit a pull request

## License

This project is licensed under the MIT License.