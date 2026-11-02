update storage.buckets
set public = true
where id in ('avatars', 'covers', 'post-media');
