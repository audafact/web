# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication for your Audafact application.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `audafact` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Select the region closest to your users
5. Click "Create new project"

## 2. Get Your Project Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (starts with `https://`)
   - **anon/public key** (starts with `eyJ`)

## 3. Configure Environment Variables

Create a `.env` file in your project root with the following content:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Application Configuration
VITE_APP_ENV=development
VITE_AUDIO_SAMPLE_RATE=44100
VITE_MAX_UPLOAD_SIZE=10485760
```

Replace `your_project_url_here` and `your_anon_key_here` with the values from step 2.

## 4. Configure Authentication Settings

### Email Authentication

1. In your Supabase dashboard, go to **Authentication** → **Settings**
2. Under **Email Auth**, ensure the following settings:
   - ✅ **Enable email confirmations**: ON
   - ✅ **Enable secure email change**: ON
   - ✅ **Enable double confirm changes**: ON

### Google OAuth Setup

1. **Create Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google+ API
   - Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
   - Choose **Web application**
   - Add authorized redirect URIs:
     - `https://your-project-ref.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (for development)
   - Copy the **Client ID** and **Client Secret**

2. **Configure Google OAuth in Supabase**:
   - In your Supabase dashboard, go to **Authentication** → **Providers**
   - Find **Google** and click **Enable**
   - Enter your Google OAuth credentials:
     - **Client ID**: Your Google OAuth Client ID
     - **Client Secret**: Your Google OAuth Client Secret
   - Save the configuration

3. **Test Google OAuth**:
   - Try signing in with Google from your application
   - Check the Supabase logs for any errors
   - Verify that users are created in the `auth.users` table

### Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize the email templates for:
   - **Confirm signup**
   - **Reset password**
   - **Change email address**

### Site URL Configuration

1. Go to **Authentication** → **Settings** → **URL Configuration**
2. Set the following URLs:
   - **Site URL**: `http://localhost:5173` (for development)
   - **Redirect URLs**: 
     - `http://localhost:5173/auth`
     - `http://localhost:5173/`
     - `http://localhost:5173/studio`
     - `http://localhost:5173/auth/callback`

## 5. Database Schema (Optional)

If you want to store additional user data, you can create a `profiles` table:

```sql
-- Create a profiles table to store additional user information
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create a trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

## 6. Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:5173/auth`

3. Try the following:
   - Sign up with a new email
   - Check your email for confirmation
   - Sign in with your credentials
   - Test password reset functionality
   - Sign out

## 7. Production Deployment

When deploying to production:

1. Update your environment variables with production values
2. Update the Site URL and Redirect URLs in Supabase to your production domain
3. Consider enabling additional security features:
   - **Two-factor authentication**
   - **Social providers** (Google, GitHub, etc.)
   - **Custom SMTP** for email delivery

## 8. Security Best Practices

1. **Never commit your `.env` file** - it's already in `.gitignore`
2. **Use environment-specific keys** for development and production
3. **Enable Row Level Security** on all tables
4. **Validate user input** on both client and server
5. **Use HTTPS** in production
6. **Regularly rotate API keys**

## 9. Troubleshooting

### Common Issues

1. **"Invalid API key" error**:
   - Check that your environment variables are correctly set
   - Ensure you're using the anon key, not the service role key

2. **Email not received**:
   - Check spam folder
   - Verify email templates are configured
   - Check Supabase logs for email delivery issues

3. **Redirect errors**:
   - Ensure redirect URLs are correctly configured in Supabase
   - Check that your site URL matches your application URL

4. **CORS errors**:
   - Add your domain to the allowed origins in Supabase settings

### Getting Help

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- [GitHub Issues](https://github.com/supabase/supabase/issues)

## 10. Next Steps

After setting up authentication, you can:

1. Add user-specific features to your application
2. Implement role-based access control
3. Add social authentication providers
4. Create user profiles and settings
5. Implement audit logging for user actions 