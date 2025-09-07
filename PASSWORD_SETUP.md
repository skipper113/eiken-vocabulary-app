# Password Protection Setup

## Current Password
Default password: `eiken2024`

## How to Change the Password

1. Open `index.html` in a text editor
2. Find this section (around line 195):
```javascript
const PASSWORDS = [
    'eiken2024',  // Default password - CHANGE THIS!
    'study123',   // Alternative password
    // Add more passwords as needed
];
```
3. Change `'eiken2024'` to your desired password
4. You can add multiple passwords if needed
5. Save the file
6. Commit and push to GitHub

## Features

- ✅ **Remember Me**: Stays logged in for 30 days
- ✅ **Multiple Passwords**: Can set multiple valid passwords
- ✅ **Session Protection**: App.html redirects to login if not authenticated
- ✅ **Clean Interface**: Professional login screen
- ✅ **Mobile Friendly**: Works on all devices

## Security Note

⚠️ **Important**: This is client-side protection only. It prevents casual access but is NOT secure against determined users who can view source code. 

For learning materials this is usually sufficient, but don't use this for sensitive data.

## For Better Security

If you need real security, consider:
1. Using a backend authentication service
2. Netlify Identity (if using Netlify)
3. GitHub private repository (but no public website)
4. Password-protected hosting service

## Logout

To logout, users can:
1. Clear browser data/cookies
2. Use incognito/private browsing
3. Wait 30 days for session to expire

## Testing

1. Go to your site
2. Try wrong password (should show error)
3. Enter correct password
4. Check "Remember me" 
5. Close browser and reopen (should stay logged in)
6. Uncheck "Remember me" and login (should need password after closing browser)