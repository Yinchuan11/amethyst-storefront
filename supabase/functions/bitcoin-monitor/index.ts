import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BitcoinTransaction {
  txid: string;
  vout: Array<{
    value: number;
    scriptpubkey_address: string;
  }>;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Bitcoin monitor started...')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Bitcoin wallet address
    const walletAddress = Deno.env.get('BITCOIN_WALLET_ADDRESS')
    if (!walletAddress) {
      throw new Error('BITCOIN_WALLET_ADDRESS not configured')
    }

    // Get all pending orders (both Bitcoin and Litecoin)
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_status', 'pending')
      .or('bitcoin_address.is.not.null,litecoin_address.is.not.null')

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError)
      throw ordersError
    }

    console.log(`Found ${pendingOrders?.length || 0} pending orders`)

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending orders to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let confirmedCount = 0

    // Check each pending order
    for (const order of pendingOrders) {
      try {
        let isPaymentConfirmed = false;
        
        if (order.bitcoin_address && order.bitcoin_amount) {
          console.log(`Checking Bitcoin payment for order ${order.id} for ${order.bitcoin_amount} BTC`)
          isPaymentConfirmed = await checkBitcoinPayment(order.bitcoin_address, parseFloat(order.bitcoin_amount))
        } else if (order.litecoin_address && order.litecoin_amount) {
          console.log(`Checking Litecoin payment for order ${order.id} for ${order.litecoin_amount} LTC`)
          isPaymentConfirmed = await checkLitecoinPayment(order.litecoin_address, parseFloat(order.litecoin_amount))
        } else {
          console.log(`Skipping order ${order.id} - no payment details`)
          continue;
        }

        if (isPaymentConfirmed) {
          console.log(`Payment confirmed for order ${order.id}`)
          
          // Update order status to confirmed
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'confirmed',
              payment_confirmed_at: new Date().toISOString()
            })
            .eq('id', order.id)

          if (updateError) {
            console.error(`Error updating order ${order.id}:`, updateError)
          } else {
            confirmedCount++
            console.log(`Successfully confirmed order ${order.id}`)
          }
        } else {
          const currency = order.bitcoin_address ? 'Bitcoin' : 'Litecoin';
          console.log(`${currency} payment not yet confirmed for order ${order.id}`)
        }
      } catch (error) {
        console.error(`Error checking order ${order.id}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        message: `Crypto monitor completed. Confirmed ${confirmedCount} orders out of ${pendingOrders.length} pending orders.`,
        confirmedCount,
        totalChecked: pendingOrders.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Crypto monitor error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function checkBitcoinPayment(address: string, expectedAmount: number): Promise<boolean> {
  try {
    // Get address transactions from blockstream.info
    const response = await fetch(`https://blockstream.info/api/address/${address}/txs`)
    
    if (!response.ok) {
      console.error('Failed to fetch transactions:', response.status, response.statusText)
      return false
    }

    const transactions: BitcoinTransaction[] = await response.json()
    
    // Check each transaction for the expected amount
    for (const tx of transactions) {
      // Only check confirmed transactions
      if (!tx.status.confirmed) {
        continue
      }

      // Check each output of the transaction
      for (const vout of tx.vout) {
        if (vout.scriptpubkey_address === address) {
          // Convert satoshis to BTC (1 BTC = 100,000,000 satoshis)
          const receivedBTC = vout.value / 100000000
          
          // Allow for small rounding differences (within 0.00001 BTC)
          if (Math.abs(receivedBTC - expectedAmount) < 0.00001) {
            console.log(`Found matching payment: ${receivedBTC} BTC in transaction ${tx.txid}`)
            return true
          }
        }
      }
    }

    return false
  } catch (error) {
    console.error('Error checking Bitcoin payment:', error)
    return false
  }
}

async function checkLitecoinPayment(address: string, expectedAmount: number): Promise<boolean> {
  try {
    // Use blockchair API for Litecoin
    const response = await fetch(`https://api.blockchair.com/litecoin/dashboards/address/${address}`)
    
    if (!response.ok) {
      console.error('Failed to fetch Litecoin transactions:', response.status, response.statusText)
      return false
    }

    const data = await response.json()
    
    if (data.data && data.data[address]) {
      const addressInfo = data.data[address].address;
      const receivedLitoshis = addressInfo.received; // Amount in litoshis (1 LTC = 100,000,000 litoshis)
      const receivedLTC = receivedLitoshis / 100000000; // Convert to LTC
      
      // Allow for small rounding differences (within 0.00001 LTC)
      if (Math.abs(receivedLTC - expectedAmount) < 0.00001) {
        console.log(`Found matching Litecoin payment: ${receivedLTC} LTC to ${address}`)
        return true
      }
    }
    
    return false
  } catch (error) {
    console.error('Error checking Litecoin payment:', error)
    return false
  }
}