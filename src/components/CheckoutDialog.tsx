import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, CheckCircle } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaymentDetails {
  address: string;
  amount_btc: number;
  amount_eur: number;
  qr_url: string;
}

const BUNDESLAENDER = [
  "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen",
  "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen",
  "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen",
  "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen"
];

const CheckoutDialog = ({ open, onOpenChange }: CheckoutDialogProps) => {
  const { toast } = useToast();
  const { items, getTotalPrice, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'address' | 'payment'>('address');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bundesland: "",
    stadt: "",
    postleitzahl: "",
    adresse: ""
  });

  // Check payment status every 10 seconds when on payment step
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (step === 'payment' && orderId && !paymentConfirmed) {
      setCheckingPayment(true);
      interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('bitcoin-payment', {
            body: { action: 'check-payment', orderId }
          });

          if (error) throw error;

          if (data.paid) {
            setPaymentConfirmed(true);
            setCheckingPayment(false);
            clearInterval(interval);
            
            toast({
              title: "Zahlung bestätigt! 🎉",
              description: "Ihre Bestellung wurde erfolgreich bezahlt.",
            });

            // Clear cart and close dialog after confirmation
            setTimeout(() => {
              clearCart();
              onOpenChange(false);
              resetDialog();
            }, 3000);
          }
        } catch (error) {
          console.error('Error checking payment:', error);
        }
      }, 10000); // Check every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
      setCheckingPayment(false);
    };
  }, [step, orderId, paymentConfirmed]);

  const resetDialog = () => {
    setStep('address');
    setPaymentDetails(null);
    setOrderId(null);
    setPaymentConfirmed(false);
    setCheckingPayment(false);
    setFormData({
      name: "",
      email: "",
      bundesland: "",
      stadt: "",
      postleitzahl: "",
      adresse: ""
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.bundesland || !formData.stadt || !formData.postleitzahl || !formData.adresse) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Fehler",
        description: "Ihr Warenkorb ist leer.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const totalEur = getTotalPrice();

      // Create order in database (without clearing cart)
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          customer_name: formData.name,
          customer_email: formData.email,
          bundesland: formData.bundesland,
          stadt: formData.stadt,
          postleitzahl: formData.postleitzahl,
          adresse: formData.adresse,
          items: JSON.parse(JSON.stringify(items)),
          total_amount: totalEur,
          payment_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setOrderId(order.id);

      // Create Bitcoin payment through Edge Function
      const { data: payment, error: paymentError } = await supabase.functions.invoke('bitcoin-payment', {
        body: {
          action: 'create-payment',
          orderId: order.id,
          amount: totalEur
        }
      });

      if (paymentError) throw paymentError;

      setPaymentDetails(payment);
      setStep('payment');

      toast({
        title: "Bestellung erstellt!",
        description: "Bitte überweisen Sie den Bitcoin-Betrag zur angegebenen Adresse.",
      });

    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: "Fehler",
        description: "Bestellung konnte nicht erstellt werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Kopiert!",
        description: "Text wurde in die Zwischenablage kopiert.",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetDialog();
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'address' ? 'Checkout - Lieferadresse' : 
             paymentConfirmed ? 'Zahlung bestätigt!' : 'Bitcoin Zahlung'}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'address' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ihr vollständiger Name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-Mail (optional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ihre@email.de"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bundesland">Bundesland *</Label>
            <Select
              value={formData.bundesland}
              onValueChange={(value) => setFormData({ ...formData, bundesland: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wählen Sie Ihr Bundesland" />
              </SelectTrigger>
              <SelectContent>
                {BUNDESLAENDER.map((land) => (
                  <SelectItem key={land} value={land}>
                    {land}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stadt">Stadt *</Label>
              <Input
                id="stadt"
                value={formData.stadt}
                onChange={(e) => setFormData({ ...formData, stadt: e.target.value })}
                placeholder="Berlin"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postleitzahl">PLZ *</Label>
              <Input
                id="postleitzahl"
                value={formData.postleitzahl}
                onChange={(e) => setFormData({ ...formData, postleitzahl: e.target.value })}
                placeholder="12345"
                pattern="[0-9]{5}"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse">Straße & Hausnummer *</Label>
            <Input
              id="adresse"
              value={formData.adresse}
              onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
              placeholder="Musterstraße 123"
              required
            />
          </div>

          <div className="pt-4 border-t">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Gesamtbetrag:</span>
              <span className="font-bold text-lg">€{getTotalPrice().toFixed(2)}</span>
            </div>
            
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Weiter zur Zahlung
              </Button>
            </div>
          </div>
        </form>
        ) : (
        <div className="space-y-6">
          {paymentConfirmed ? (
            <div className="text-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700 mb-2">Zahlung erfolgreich!</h3>
              <p className="text-muted-foreground">Ihre Bestellung wurde bestätigt und wird bearbeitet.</p>
            </div>
          ) : paymentDetails ? (
            <>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Bitcoin-Zahlung erforderlich</h3>
                <p className="text-muted-foreground mb-4">
                  Überweisen Sie den unten angegebenen Betrag an die Bitcoin-Adresse
                </p>
              </div>

              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-sm font-medium">Bitcoin-Adresse:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-background p-2 rounded text-xs flex-1 break-all">
                      {paymentDetails.address}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(paymentDetails.address)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Betrag:</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="bg-background p-2 rounded font-mono flex-1">
                      {paymentDetails.amount_btc.toFixed(8)} BTC
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(paymentDetails.amount_btc.toFixed(8))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ €{paymentDetails.amount_eur.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="text-center">
                {checkingPayment ? (
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Prüfe Zahlung...</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Die Zahlung wird automatisch erkannt (kann 1-10 Minuten dauern)
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('address')}
                  className="flex-1"
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    resetDialog();
                  }}
                  className="flex-1"
                >
                  Später bezahlen
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>Erstelle Zahlung...</p>
            </div>
          )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;