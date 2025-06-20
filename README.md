# 🍎 Nutrition Tracking App

*A modern nutrition tracking application built with Next.js, Supabase, and Tailwind CSS*

[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

## 🚀 Features

- **🔐 Authentication**: Secure user registration and login with Supabase Auth
- **📊 Nutrition Tracking**: Log meals, track calories, and monitor nutritional intake
- **🎨 Modern UI**: Beautiful, responsive design with shadcn/ui components
- **📱 Mobile-First**: Optimized for mobile and desktop experiences
- **⚡ Real-time**: Live updates with Supabase real-time subscriptions
- **🌙 Dark Mode**: Built-in dark/light mode support

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.17 or later
- **npm**, **yarn**, or **pnpm**
- A **Supabase** account and project
- **Git** for version control

## 🏃‍♂️ Quick Start

### 1. Clone the Repository

\`\`\`bash
git clone <your-repo-url>
cd meal-app-react
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### 3. Environment Setup

Create a `.env.local` file in the root directory:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

Get these values from your [Supabase Dashboard](https://supabase.com/dashboard):
- Go to **Settings** → **API**
- Copy the **Project URL** and **anon public** key

### 4. Supabase Setup

#### Option A: Using Supabase CLI (Recommended)

\`\`\`bash
# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Login to Supabase
npx supabase login

# Link to your project
npx supabase link --project-ref your_project_ref

# Pull remote schema
npx supabase db pull
\`\`\`

#### Option B: Manual Setup

If CLI linking fails, manually set up your environment variables as shown in step 3.

### 5. Run the Development Server

\`\`\`bash
npm run dev
# or
yarn dev
# or
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

\`\`\`
meal-app-react/
├── app/                    # Next.js App Router
│   ├── auth/              # Authentication pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── login-form.tsx    # Login form component
│   └── signup-form.tsx   # Signup form component
├── lib/                  # Utility functions
│   ├── actions.ts        # Server actions
│   ├── supabase/         # Supabase configuration
│   └── utils.ts          # Utility functions
├── hooks/                # Custom React hooks
├── .vscode/              # VS Code settings
└── public/               # Static assets
\`\`\`

## 🔧 Development

### Available Scripts

\`\`\`bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Lint code
npm run lint
\`\`\`

### VS Code Setup

This project includes optimized VS Code settings:

- **Auto-formatting** with Prettier
- **TypeScript** enhanced support
- **Tailwind CSS** IntelliSense
- **Supabase** extension integration
- **Debugging** configurations

Install recommended extensions when prompted by VS Code.

## 🗄️ Database Schema

The app uses the following main tables:

- **Users**: User profiles and preferences
- **Foods**: Food items and nutritional data
- **Meals**: User meal entries
- **Meal_Items**: Individual food items in meals

*Database migrations and schema will be added as the project develops.*

## 🔐 Authentication

The app uses Supabase Auth with:

- **Email/Password** authentication
- **Server-side** session management
- **Protected routes** with middleware
- **Automatic redirects** for authenticated/unauthenticated users

## 🎨 UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components:

- **Forms**: Login, signup, and data entry forms
- **Navigation**: Responsive navigation and menus
- **Data Display**: Tables, cards, and charts
- **Feedback**: Toasts, alerts, and loading states

## 📱 Responsive Design

- **Mobile-first** approach
- **Tailwind CSS** for responsive utilities
- **Flexible layouts** that work on all screen sizes
- **Touch-friendly** interactions

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically on every push

### Other Platforms

The app can be deployed to any platform that supports Next.js:

- **Netlify**
- **Railway**
- **DigitalOcean App Platform**
- **AWS Amplify**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**Supabase Connection Issues**
- Verify your environment variables are correct
- Check your Supabase project is active
- Ensure your database is accessible

**Build Errors**
- Clear `.next` folder and rebuild
- Check for TypeScript errors
- Verify all dependencies are installed

**Authentication Issues**
- Check Supabase Auth settings
- Verify redirect URLs in Supabase dashboard
- Clear browser cookies and try again

### Getting Help

- Check the [Issues](../../issues) page
- Review [Supabase Documentation](https://supabase.com/docs)
- Visit [Next.js Documentation](https://nextjs.org/docs)

## 🙏 Acknowledgments

- [v0.dev](https://v0.dev) for rapid prototyping
- [Supabase](https://supabase.com) for backend infrastructure
- [shadcn/ui](https://ui.shadcn.com) for beautiful components
- [Tailwind CSS](https://tailwindcss.com) for styling utilities

---

**Happy coding! 🎉**
