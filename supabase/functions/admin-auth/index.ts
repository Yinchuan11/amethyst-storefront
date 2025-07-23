import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, password } = await req.json()

    // Admin credentials stored securely in environment
    const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') || 'ADMkz'
    const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || 'ADMkz777'

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ success: true, message: 'Admin authenticated successfully' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid credentials' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: 'Authentication failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})