-- Allow AAC in MP4 container for library ingests (e.g. Cristian Sigler stems).
ALTER TABLE public.library_tracks
  DROP CONSTRAINT IF EXISTS library_tracks_type_check;

ALTER TABLE public.library_tracks
  ADD CONSTRAINT library_tracks_type_check
  CHECK (type IN ('wav', 'mp3', 'm4a'));

COMMENT ON CONSTRAINT library_tracks_type_check ON public.library_tracks IS
  'Supported library file kinds; m4a = typically AAC in MP4 (.m4a).';
