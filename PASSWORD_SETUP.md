# Password Protection Setup (Hash-Based)

## Current Password
Default password: `eiken2024`

## How to Change the Password (Secure Method)

1. **Generate a SHA-256 hash** of your new password:
   - Go to: https://emn178.github.io/online-tools/sha256.html
   - Enter your new password
   - Copy the hash output

2. **Update the hash in index.html** (around line 217):
```javascript
const PASSWORD_HASHES = [
    '0cf2fd0220f9c6eade3336dd33938a0e8c0144e9bc3b5a3d64c1b112c907295a',  // Replace this
    // Add more hashes as needed
];
```

3. Replace the hash with your new one
4. Save and push to GitHub

## Why Hash-Based?

✅ **Password is NEVER stored in plain text**
✅ **Cannot reverse-engineer the password from the hash**
✅ **Even if someone reads your source code, they can't see the password**
❌ **Still not 100% secure** (determined users could still bypass client-side checks)

## Example Hashes

| Password | SHA-256 Hash |
|----------|--------------|
| eiken2024 | 0cf2fd0220f9c6eade3336dd33938a0e8c0144e9bc3b5a3d64c1b112c907295a |
| (your password) | (generate at link above) |

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