# Audafact - Audio Artifact Creation Platform

Project Date: 2025-07-01 23:20:34

Audafact empowers creators to dig, dissect, and deploy audio artifacts with precision tools for cueing, looping, and sampling. Built with React, Vite, TypeScript, and Tailwind CSS.

## Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher (comes with Node.js)
- **Git**: For cloning the repository

## Installation

1. **Clone the repository** (if not already done):

   ```bash
   git clone <repository-url>
   cd audafact
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Application Configuration
VITE_APP_ENV=development
VITE_AUDIO_SAMPLE_RATE=44100
VITE_MAX_UPLOAD_SIZE=10485760
```

### Getting Supabase Credentials

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to your project settings
3. Copy the Project URL and anon/public key
4. Add them to your `.env` file

## Available Scripts

### Development

```bash
# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Run ESLint
npm run lint
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── context/            # React context providers
├── hooks/              # Custom React hooks
├── routes/             # Application routing
├── services/           # External service integrations
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── views/              # Page components
└── App.tsx             # Main application component
```

## Technologies Used

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Audio**: Tone.js, WaveSurfer.js
- **Backend**: Supabase
- **Testing**: Vitest, Testing Library
- **Icons**: Lucide React

## Troubleshooting

### Common Issues

1. **Port already in use**: If port 5173 is busy, Vite will automatically try the next available port
2. **Environment variables not loading**: Ensure your `.env` file is in the root directory and variables start with `VITE_`
3. **Audio not working**: Check browser permissions for microphone access

### Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Ensure all dependencies are installed: `npm install`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

## License

This project is private and proprietary.
