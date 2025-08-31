#!/bin/bash

echo "🚀 Setting up R2 Library Population Script"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the web/scripts directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file template..."
    cat > .env << EOF
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# Optional: Override default values
R2_BUCKET=audafact
CSV_FILE=./audafact-track-genre-and-tags - Sheet1.csv
EOF
    echo "✅ Created .env file. Please edit it with your actual credentials."
else
    echo "✅ .env file already exists."
fi

# Check if CSV file exists
if [ ! -f "audafact-track-genre-and-tags - Sheet1.csv" ]; then
    echo "⚠️  Warning: CSV file not found. Please place 'audafact-track-genre-and-tags - Sheet1.csv' in this directory."
else
    echo "✅ CSV file found."
fi

echo ""
echo "🎯 Next steps:"
echo "1. Edit .env file with your actual credentials"
echo "2. Ensure your CSV file is in this directory"
echo "3. Run the database migration first: cd ../.. && supabase db push"
echo "4. Test the parsing logic: node test-parsing.js"
echo "5. Run the full script: npm start"
echo ""
echo "📚 See README.md for detailed instructions."
