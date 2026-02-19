Double-Gate Security Strategy: >

1. Gate 1 (Frontend Middleware): Redirects users based on their profiles.role before the page even renders. This prevents unauthorized UI access.

2. Gate 2 (Database RLS): Our PostgreSQL policies (defined in Migration 003) act as the final authority, ensuring that even if a user bypasses the UI, they cannot fetch unauthorized rows via the API.
