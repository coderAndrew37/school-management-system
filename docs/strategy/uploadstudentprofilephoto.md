s-creates the student-photos bucket (public, 2 MB limit, JPEG/PNG/WEBP only), and sets four storage RLS policies: admins can insert/update/delete, all authenticated users can read.

2.  student-photo-utils.ts → lib/utils/student-photo.ts. The getStudentPhotoUrl(path) helper converts a storage path like photos/uuid.jpg to a full CDN URL. Import this wherever you display student photos — student list, profile pages, report cards.

3.  admit.ts — added uploadStudentPhotoAction(studentId, formData) at the bottom. It uploads to student-photos/photos/{studentId}.{ext} with upsert: true (so re-uploading replaces the old photo), then updates students.photo_url. This function can also be called standalone from a future student edit page.

4.  AdmissionForm.tsx — the photo upload sits between the student fields and the parent section as an optional step. The UX is: click the dashed box or "Choose Photo" button → file picker → instant local preview → the photo is uploaded after the student record is created, so a slow upload never blocks admission. If the upload fails, the student is still admitted and the admin sees a console warning — photo can be added later. The submit button state also shows "Uploading photo…" if needed. All three states (no photo, photo selected with preview, uploading spinner) are handled.Migration 016 student photoCode ·
