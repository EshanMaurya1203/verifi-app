-- Ensure the proofs bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload files to their own directory
CREATE POLICY "Users can upload to their own directory" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own files" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their own files" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'proofs' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);
