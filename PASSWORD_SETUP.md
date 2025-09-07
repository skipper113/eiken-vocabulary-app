# Password Protection Setup (Salted Hash-Based)

## Current Password
You have the default password (not shown here for security)

## How to Change the Password (Secure Method)

1. **Create a salted hash** of your new password:
   - Open browser console (F12)
   - Run this code with YOUR password:
   ```javascript
   (async () => {
     const password = 'YOUR_NEW_PASSWORD_HERE';
     const salt = 'eikenVocab2024!@#UniqueString';
     const data = new TextEncoder().encode(password + salt);
     const hash = await crypto.subtle.digest('SHA-256', data);
     console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''));
   })();
   ```
   - Copy the hash output

2. **Update the hash in index.html** (around line 216):
```javascript
const PASSWORD_HASHES = [
    'your_new_hash_here',  // Replace with your generated hash
    // Add more hashes as needed
];
```

3. Save and push to GitHub

## Why Hash-Based?

✅ **Password is NEVER stored in plain text**
✅ **Cannot reverse-engineer the password from the hash**
✅ **Even if someone reads your source code, they can't see the password**
❌ **Still not 100% secure** (determined users could still bypass client-side checks)

## Security Features

- **Salted Hashes**: Even common passwords become unique hashes
- **Cannot be found in rainbow tables**: Salt prevents database lookups
- **Source code doesn't reveal password**: Only the hash is visible

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