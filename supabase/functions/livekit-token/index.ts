import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Response('unauthorized', { status: 401 });

  const body = (await req.json()) as { roomId?: string };
  if (!body.roomId) return new Response('room required', { status: 400 });

  const { data: member } = await supabase
    .from('live_room_members')
    .select('role')
    .eq('room_id', body.roomId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!member) return new Response('forbidden', { status: 403 });

  const apiKey = Deno.env.get('LIVEKIT_API_KEY');
  const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
  const url = Deno.env.get('LIVEKIT_URL');
  if (!apiKey || !apiSecret || !url) {
    return new Response(JSON.stringify({ error: 'livekit_not_configured' }), { status: 503 });
  }

  const token = new AccessToken(apiKey, apiSecret, { identity: userData.user.id, ttl: '2h' });
  token.addGrant({
    roomJoin: true,
    room: body.roomId,
    canPublish: member.role !== 'listener',
    canSubscribe: true,
  });
  return new Response(JSON.stringify({ url, token: await token.toJwt() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
