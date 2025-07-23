import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    bundesland: "",
    stadt: "",
    postleitzahl: "",
    adresse: ""
  });

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
      // Generate Bitcoin address and amount (in real app, use proper Bitcoin API)
      const bitcoinAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"; // Example address
      const totalEur = getTotalPrice();
      const bitcoinAmount = (totalEur / 45000).toFixed(8); // Example conversion rate

      // Create order in database
      const { data, error } = await supabase
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
          bitcoin_address: bitcoinAddress,
          bitcoin_amount: parseFloat(bitcoinAmount),
          payment_status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      // Show payment info
      toast({
        title: "Bestellung erstellt!",
        description: `Senden Sie ${bitcoinAmount} BTC an: ${bitcoinAddress}`,
        duration: 10000,
      });

      // Clear cart and close dialog
      clearCart();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        bundesland: "",
        stadt: "",
        postleitzahl: "",
        adresse: ""
      });

      // In real app, redirect to payment page or show payment QR code
      alert(`Zahlung erforderlich:\n\nBitcoin Adresse: ${bitcoinAddress}\nBetrag: ${bitcoinAmount} BTC\n\nNach der Zahlung wird Ihre Bestellung automatisch bestätigt.`);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Checkout - Lieferadresse</DialogTitle>
        </DialogHeader>
        
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
                Mit Bitcoin bezahlen
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;