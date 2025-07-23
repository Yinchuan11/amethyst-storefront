import { Button } from "@/components/ui/button";
import heroBanner from "@/assets/hero-banner.jpg";
import { useToast } from "@/hooks/use-toast";

const HeroSection = () => {
  const { toast } = useToast();

  const handleShopNow = () => {
    // Scroll to products section
    const productsSection = document.querySelector('[data-section="products"]');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      toast({
        title: "Navigation",
        description: "Scrollen Sie nach unten, um die Produkte zu sehen.",
      });
    }
  };

  return (
    <section className="relative h-96 overflow-hidden rounded-lg mx-4 mt-4">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBanner})` }}
      />
      <div className="absolute inset-0 bg-background/60" />
      <div className="relative z-10 h-full flex items-center justify-center text-center">
        <div className="max-w-2xl px-4">
          <h2 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Moderne Produkte
          </h2>
          <p className="text-lg md:text-xl text-foreground/90 mb-8">
            Entdecken Sie unsere exklusive Auswahl an hochwertigen Produkten
          </p>
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg"
            onClick={handleShopNow}
          >
            Jetzt einkaufen
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;