-- Hikâye kaydetme (taslak + yayınlama) tamamen kırıktı.
--
-- `story_save` içindeki
--   delete from public.story_linked_content where story_id = story_id;
-- ifadesinde `story_id` hem PL/pgSQL değişkeni hem tablo kolonuydu; PostgreSQL
-- "column reference story_id is ambiguous" hatası veriyordu. Bu dal, bağlantılı
-- içerik (Kur'an / dua) seçilmemiş HER kayıtta çalıştığı için kullanıcı hikâyesini
-- ne taslak olarak kaydedebiliyor ne de yayınlayabiliyordu. Tabloya takma ad
-- vermek çözüm değil (DELETE hedefinin kolon adları yine görünür kalıyor), bu
-- yüzden yerel değişken `v_story_id` olarak yeniden adlandırıldı.

create or replace function public.story_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_story_id uuid := nullif(p_payload->>'id', '')::uuid;
  existing public.life_stories%rowtype;
  v_title text := nullif(trim(coalesce(p_payload->>'title', '')), '');
  v_body text := nullif(trim(coalesce(p_payload->>'body', '')), '');
  v_cover text := nullif(trim(coalesce(p_payload->>'cover_url', '')), '');
  v_status text := lower(coalesce(p_payload->>'status', 'draft'));
  v_category uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_pseudonymous boolean := coalesce((p_payload->>'pseudonymous')::boolean, false);
  v_comments boolean := coalesce((p_payload->>'comments_enabled')::boolean, true);
  v_contact boolean := coalesce((p_payload->>'contact_enabled')::boolean, true);
  v_support boolean := coalesce((p_payload->>'support_enabled')::boolean, true);
  linked jsonb := p_payload->'linked';
  linked_kind text;
  linked_key text;
  linked_label text;
  linked_reciter text;
  minutes integer;
  publish_limit integer;
  published_today integer;
  alias_value text;
begin
  if uid is null then
    raise exception 'Oturum gerekli';
  end if;
  if not public.live_setting_bool('story_enabled', true) then
    raise exception 'Hayat Hikâyeleri şu anda kapalı';
  end if;
  if v_title is null or char_length(v_title) < 3 then
    raise exception 'Başlık en az 3 karakter olmalı';
  end if;
  if char_length(v_title) > 160 then
    raise exception 'Başlık çok uzun';
  end if;
  if v_body is null then
    raise exception 'Hikâye metni boş olamaz';
  end if;
  if char_length(v_body) > 40000 then
    raise exception 'Hikâye metni çok uzun';
  end if;
  if v_status not in ('draft', 'published') then
    raise exception 'Geçersiz yayın durumu';
  end if;
  if v_status = 'published' and char_length(v_body) < 120 then
    raise exception 'Yayınlamak için hikâye en az 120 karakter olmalı';
  end if;
  if v_cover is not null and (char_length(v_cover) > 1000 or v_cover !~* '^https?://') then
    raise exception 'Kapak görseli geçersiz';
  end if;
  if v_category is not null and not exists (
    select 1 from public.story_categories where id = v_category and active
  ) then
    raise exception 'Kategori bulunamadı';
  end if;

  if v_story_id is not null then
    select * into existing from public.life_stories where id = v_story_id for update;
    if existing.id is null or existing.author_id <> uid then
      raise exception 'Hikâye bulunamadı';
    end if;
    if existing.status = 'removed' then
      raise exception 'Kaldırılan hikâye düzenlenemez';
    end if;
    if existing.status = 'hidden' and v_status = 'published' then
      raise exception 'Moderasyon incelemesi tamamlanmadan hikâye yeniden yayınlanamaz';
    end if;
  end if;

  if linked is not null and jsonb_typeof(linked) = 'object' then
    linked_kind := lower(coalesce(linked->>'kind', ''));
    linked_key := nullif(trim(coalesce(linked->>'key', '')), '');
    linked_label := nullif(left(trim(coalesce(linked->>'label', '')), 160), '');
    linked_reciter := nullif(left(trim(coalesce(linked->>'reciter_id', '')), 80), '');
    if linked_kind not in ('quran', 'dua') then
      raise exception 'İlgili içerik türü geçersiz';
    end if;
    if linked_key is null
       or not public.worship_content_key_valid(linked_key)
       or split_part(linked_key, ':', 1) <> linked_kind then
      raise exception 'İlgili içerik kimliği geçersiz';
    end if;
  end if;

  alias_value := case when v_pseudonymous then coalesce(existing.alias, public.story_alias(coalesce(v_story_id, gen_random_uuid()))) else null end;
  minutes := greatest(1, least(240, ceil(array_length(regexp_split_to_array(v_body, '\s+'), 1) / 200.0)::integer));

  if v_story_id is null then
    if v_status = 'published' then
      select count(*) into published_today
      from public.life_stories
      where author_id = uid and published_at > now() - interval '24 hours';
      publish_limit := public.live_setting_int('story_daily_publish_limit', 5);
      if published_today >= publish_limit then
        raise exception 'Günlük hikâye yayınlama sınırına ulaştın';
      end if;
    end if;
    insert into public.life_stories (
      author_id, category_id, title, body, cover_url, pseudonymous, alias,
      status, comments_enabled, contact_enabled, support_enabled,
      reading_minutes, published_at
    ) values (
      uid, v_category, v_title, v_body, v_cover, v_pseudonymous, alias_value,
      v_status, v_comments, v_contact, v_support,
      minutes, case when v_status = 'published' then now() else null end
    ) returning id into v_story_id;
  else
    if v_status = 'published' and existing.status <> 'published' then
      select count(*) into published_today
      from public.life_stories
      where author_id = uid and published_at > now() - interval '24 hours' and id <> v_story_id;
      publish_limit := public.live_setting_int('story_daily_publish_limit', 5);
      if published_today >= publish_limit then
        raise exception 'Günlük hikâye yayınlama sınırına ulaştın';
      end if;
    end if;
    update public.life_stories set
      category_id = v_category,
      title = v_title,
      body = v_body,
      cover_url = v_cover,
      pseudonymous = v_pseudonymous,
      alias = alias_value,
      status = v_status,
      comments_enabled = v_comments,
      contact_enabled = v_contact,
      support_enabled = v_support,
      reading_minutes = minutes,
      published_at = case
        when v_status = 'published' then coalesce(existing.published_at, now())
        else existing.published_at
      end,
      hidden_reason = case when v_status = 'published' then null else hidden_reason end
    where id = v_story_id;
  end if;

  if linked_kind is not null then
    insert into public.story_linked_content (story_id, content_kind, content_key, label, reciter_id)
    values (v_story_id, linked_kind, linked_key, linked_label, linked_reciter)
    on conflict (story_id) do update set
      content_kind = excluded.content_kind,
      content_key = excluded.content_key,
      label = excluded.label,
      reciter_id = excluded.reciter_id;
  else
    delete from public.story_linked_content where story_id = v_story_id;
  end if;

  return jsonb_build_object('id', v_story_id, 'status', v_status, 'reading_minutes', minutes);
end;
$$;

revoke all on function public.story_save(jsonb) from public, anon;
grant execute on function public.story_save(jsonb) to authenticated, service_role;
