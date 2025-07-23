import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BitcoinPaymentRequest {
  orderId: string;
  amount: number; // Amount in EUR
}

interface BitcoinAddress {
  address: string;
  amount_btc: number;
  amount_eur: number;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const BITCOIN_WALLET_ADDRESS = Deno.env.get('BITCOIN_WALLET_ADDRESS');
const BLOCKCHAIN_API_KEY = Deno.env.get('BLOCKCHAIN_API_KEY') || '';

// Get current BTC/EUR exchange rate
async function getBTCPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice/EUR.json');
    const data = await response.json();
    return parseFloat(data.bpi.EUR.rate.replace(/,/g, ''));
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    // Fallback price if API fails
    return 45000;
  }
}

// Check if payment has been received
async function checkPayment(address: string, expectedAmount: number): Promise<boolean> {
  try {
    const response = await fetch(`https://blockstream.info/api/address/${address}`);
    const addressInfo = await response.json();
    
    // Check if received amount is at least the expected amount (in satoshis)
    const receivedSatoshis = addressInfo.chain_stats.funded_txo_sum;
    const expectedSatoshis = Math.floor(expectedAmount * 100000000); // Convert BTC to satoshis
    
    console.log(`Address: ${address}, Expected: ${expectedSatoshis} sats, Received: ${receivedSatoshis} sats`);
    
    return receivedSatoshis >= expectedSatoshis;
  } catch (error) {
    console.error('Error checking payment:', error);
    return false;
  }
}

// Generate unique address for each order (in real implementation, use HD wallet)
function generatePaymentAddress(): string {
  if (!BITCOIN_WALLET_ADDRESS) {
    throw new Error('Bitcoin wallet address not configured');
  }
  return BITCOIN_WALLET_ADDRESS;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'create-payment') {
      const { orderId, amount }: BitcoinPaymentRequest = body;
      
      console.log(`Creating payment for order ${orderId}, amount: €${amount}`);

      // Get current BTC price
      const btcPrice = await getBTCPrice();
      const btcAmount = amount / btcPrice;
      
      // Generate payment address
      const paymentAddress = generatePaymentAddress();
      
      // Update order with payment details
      const { error } = await supabase
        .from('orders')
        .update({
          bitcoin_address: paymentAddress,
          bitcoin_amount: btcAmount,
          payment_status: 'pending'
        })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating order:', error);
        throw error;
      }

      console.log(`Payment created: ${btcAmount.toFixed(8)} BTC to ${paymentAddress}`);

      return new Response(JSON.stringify({
        address: paymentAddress,
        amount_btc: btcAmount,
        amount_eur: amount,
        qr_url: `bitcoin:${paymentAddress}?amount=${btcAmount.toFixed(8)}`
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } else if (action === 'check-payment') {
      const orderId = body.orderId;
      
      if (!orderId) {
        throw new Error('Order ID required');
      }

      console.log(`Checking payment for order ${orderId}`);

      // Get order details
      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error || !order) {
        throw new Error('Order not found');
      }

      if (order.payment_status === 'confirmed') {
        return new Response(JSON.stringify({ paid: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // Check blockchain for payment
      const isPaid = await checkPayment(order.bitcoin_address, order.bitcoin_amount);
      
      if (isPaid) {
        // Update order status
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'confirmed',
            payment_confirmed_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (updateError) {
          console.error('Error updating payment status:', updateError);
        } else {
          console.log(`Payment confirmed for order ${orderId}`);
        }
      }

      return new Response(JSON.stringify({ paid: isPaid }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } else {
      throw new Error('Invalid action');
    }

  } catch (error: any) {
    console.error("Error in bitcoin-payment function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
};

serve(handler);