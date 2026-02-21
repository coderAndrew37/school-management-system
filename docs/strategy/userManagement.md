Admin Forms within your dashboard.

Step A: Admin Inputs Data: The Admin fills out a "Register Teacher" or "Add Parent" form.

Step B: Server Action / API: This triggers a Next.js Server Action or an API route.

Step C: Atomic Transaction: The server performs a Database Transaction. It creates the record in the users table and the teachers (or parents) table at the exact same time. If one fails, both fail (no "ghost" users).

Step D: Invite Email: Instead of the Admin setting a password, the system sends an email to the Parent/Teacher with a "Set your password" link.

2. Why this is the "Gold Standard"
   Security: Passwords are never handled by the Admin; they are securely set by the user via a tokenized link.

Validation: The app can check if a TSC Number or Email already exists before trying to save, preventing SQL errors.

Relationships: The code automatically handles the user_id foreign key, so you don't have to copy-paste UUIDs manually.

3. Alternative: Bulk CSV Upload
   For a school with 50 teachers and 1,000 parents, adding them one by one is a nightmare.

The Pro Way: You provide an Excel/CSV template.

The Logic: Your code parses the file, validates every row, and performs a "Bulk Insert."

4. Self-Registration (Parents Only)
   Sometimes, you want parents to sign themselves up (e.g., from the school website).

The Flow: Parent signs up -> System marks them as "Pending" -> Admin clicks Approve in the DataTable you just built.

Current Reality Check
