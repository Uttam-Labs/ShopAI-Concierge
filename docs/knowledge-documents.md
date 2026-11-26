# Knowledge Source documents

The Knowledge Source page accepts `.txt`, `.docx`, and `.xlsx` files up to 10 MB. Text extraction is capped at 200,000 characters per file. Uploaded originals are stored privately in Supabase Storage under a per-shop folder; extracted text and file metadata are stored in Postgres.

Uploading a file only saves it. To make it available to the concierge, select it in the Documents tab and choose **Add to training**. The app then saves it in the selected sources list and indexes its text in searchable chunks. Removing a document from the selected sources list stops training it but leaves the original upload available. Deleting from the Documents tab removes the stored file, extracted text, training selection, and indexed chunks.

The app creates the private storage bucket on first upload using the configured server-side Supabase Secret/service-role key. The `supabase/migrations/004_knowledge_documents_storage.sql` migration can also provision the bucket in advance. The Prisma migration creates the document metadata table and is applied by the normal app setup/build migration step.
