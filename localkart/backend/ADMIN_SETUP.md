# Local administrator setup

Public registration intentionally accepts only customer and vendor accounts. Create the first administrator once from the backend directory. The script refuses to run if an administrator already exists or if the email belongs to another user.

Set `MONGODB_URI`, `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the local, git-ignored `backend/.env` file. Use a password with at least eight characters. The script hashes it with bcrypt and never prints it.

Then run:

```sh
npm run bootstrap:admin
```

On PowerShell, you can instead set the bootstrap values only for one terminal session:

```powershell
$env:ADMIN_NAME = 'LocalKart Administrator'
$env:ADMIN_EMAIL = 'admin@example.com'
$env:ADMIN_PASSWORD = 'replace-with-a-private-password'
npm run bootstrap:admin
Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
```

The script disconnects from MongoDB after it finishes. Never commit `backend/.env` or store a real password in this document.
