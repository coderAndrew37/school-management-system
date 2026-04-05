-- 1. Allow Authenticated users to upload files to the 'avatars' bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 2. Allow Authenticated users to update/overwrite their files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- 3. Allow Authenticated users to delete files (optional but recommended for cleanup)
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- 4. Ensure public read access (if not already set via the dashboard)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');