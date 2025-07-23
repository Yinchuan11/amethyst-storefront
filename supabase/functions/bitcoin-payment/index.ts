import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BitcoinPaymentRequest {
  orderId: string;
  amount: number; // Amount in EUR
  currency?: 'bitcoin' | 'litecoin';
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
const LITECOIN_WALLET_ADDRESS = Deno.env.get('LITECOIN_WALLET_ADDRESS');
const BLOCKCHAIN_API_KEY = Deno.env.get('BLOCKCHAIN_API_KEY') || '';

// Get current BTC/EUR exchange rate
async function getBTCPrice(): Promise<number> {
  try {
    // Try CoinGecko API first (more reliable)
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
    const data = await response.json();
    if (data.bitcoin && data.bitcoin.eur) {
      console.log(`BTC price from CoinGecko: €${data.bitcoin.eur}`);
      return data.bitcoin.eur;
    }
    throw new Error('Invalid response from CoinGecko');
  } catch (error) {
    console.error('Error fetching BTC price from CoinGecko:', error);
    try {
      // Fallback to CoinDesk API
      const response = await fetch('https://api.coindesk.com/v1/bpi/currentprice/EUR.json');
      const data = await response.json();
      const price = parseFloat(data.bpi.EUR.rate.replace(/,/g, ''));
      console.log(`BTC price from CoinDesk: €${price}`);
      return price;
    } catch (fallbackError) {
      console.error('Error fetching BTC price from CoinDesk:', fallbackError);
      // More realistic fallback price (current market price around 90,000€)
      console.log('Using fallback BTC price: €90000');
      return 90000;
    }
  }
}

// Get current LTC/EUR exchange rate
async function getLTCPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur');
    const data = await response.json();
    if (data.litecoin && data.litecoin.eur) {
      console.log(`LTC price from CoinGecko: €${data.litecoin.eur}`);
      return data.litecoin.eur;
    }
    throw new Error('Invalid response from CoinGecko');
  } catch (error) {
    console.error('Error fetching LTC price from CoinGecko:', error);
    // Fallback price (current market price around 120€)
    console.log('Using fallback LTC price: €120');
    return 120;
  }
}

// Check if Bitcoin payment has been received
async function checkBitcoinPayment(address: string, expectedAmount: number): Promise<boolean> {
  try {
    const response = await fetch(`https://blockstream.info/api/address/${address}`);
    const addressInfo = await response.json();
    
    // Check if received amount is at least the expected amount (in satoshis)
    const receivedSatoshis = addressInfo.chain_stats.funded_txo_sum;
    const expectedSatoshis = Math.floor(expectedAmount * 100000000); // Convert BTC to satoshis
    
    console.log(`Bitcoin Address: ${address}, Expected: ${expectedSatoshis} sats, Received: ${receivedSatoshis} sats`);
    
    return receivedSatoshis >= expectedSatoshis;
  } catch (error) {
    console.error('Error checking Bitcoin payment:', error);
    return false;
  }
}

// Check if Litecoin payment has been received
async function checkLitecoinPayment(address: string, expectedAmount: number): Promise<boolean> {
  try {
    const response = await fetch(`https://api.blockchair.com/litecoin/dashboards/address/${address}`);
    const data = await response.json();
    
    if (data.data && data.data[address]) {
      const addressInfo = data.data[address].address;
      const receivedLitoshis = addressInfo.received; // Amount in litoshis (1 LTC = 100,000,000 litoshis)
      const expectedLitoshis = Math.floor(expectedAmount * 100000000); // Convert LTC to litoshis
      
      console.log(`Litecoin Address: ${address}, Expected: ${expectedLitoshis} litoshis, Received: ${receivedLitoshis} litoshis`);
      
      return receivedLitoshis >= expectedLitoshis;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking Litecoin payment:', error);
    return false;
  }
}

// Generate payment address based on currency
function generatePaymentAddress(currency: 'bitcoin' | 'litecoin'): string {
  if (currency === 'bitcoin') {
    if (!BITCOIN_WALLET_ADDRESS) {
      throw new Error('Bitcoin wallet address not configured');
    }
    return BITCOIN_WALLET_ADDRESS;
  } else {
    if (!LITECOIN_WALLET_ADDRESS) {
      throw new Error('Litecoin wallet address not configured');
    }
    return LITECOIN_WALLET_ADDRESS;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    if (action === 'create-payment') {
      const { orderId, amount, currency = 'bitcoin' }: BitcoinPaymentRequest = body;
      
      console.log(`Creating ${currency} payment for order ${orderId}, amount: €${amount}`);

      let cryptoAmount: number;
      let paymentAddress: string;
      let qrUrl: string;
      
      if (currency === 'bitcoin') {
        const btcPrice = await getBTCPrice();
        cryptoAmount = amount / btcPrice;
        paymentAddress = generatePaymentAddress('bitcoin');
        qrUrl = `bitcoin:${paymentAddress}?amount=${cryptoAmount.toFixed(8)}`;
        
        // Update order with Bitcoin payment details
        const { error } = await supabase
          .from('orders')
          .update({
            bitcoin_address: paymentAddress,
            bitcoin_amount: cryptoAmount,
            payment_status: 'pending'
          })
          .eq('id', orderId);
          
        if (error) {
          console.error('Error updating order with Bitcoin details:', error);
          throw error;
        }
        
        console.log(`Bitcoin payment created: ${cryptoAmount.toFixed(8)} BTC to ${paymentAddress}`);
        
        return new Response(JSON.stringify({
          address: paymentAddress,
          amount_btc: cryptoAmount,
          amount_eur: amount,
          qr_url: qrUrl
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
        
      } else if (currency === 'litecoin') {
        const ltcPrice = await getLTCPrice();
        cryptoAmount = amount / ltcPrice;
        paymentAddress = generatePaymentAddress('litecoin');
        qrUrl = `litecoin:${paymentAddress}?amount=${cryptoAmount.toFixed(8)}`;
        
        // Update order with Litecoin payment details
        const { error } = await supabase
          .from('orders')
          .update({
            litecoin_address: paymentAddress,
            litecoin_amount: cryptoAmount,
            payment_status: 'pending'
          })
          .eq('id', orderId);
          
        if (error) {
          console.error('Error updating order with Litecoin details:', error);
          throw error;
        }
        
        console.log(`Litecoin payment created: ${cryptoAmount.toFixed(8)} LTC to ${paymentAddress}`);
        
        return new Response(JSON.stringify({
          address: paymentAddress,
          amount_ltc: cryptoAmount,
          amount_eur: amount,
          qr_url: qrUrl
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } else {
        throw new Error('Unsupported currency');
      }

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

      // Check blockchain for payment based on currency
      let isPaid = false;
      
      if (order.bitcoin_address && order.bitcoin_amount) {
        isPaid = await checkBitcoinPayment(order.bitcoin_address, order.bitcoin_amount);
      } else if (order.litecoin_address && order.litecoin_amount) {
        isPaid = await checkLitecoinPayment(order.litecoin_address, order.litecoin_amount);
      }
      
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