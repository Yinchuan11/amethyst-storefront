import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import productPlaceholder from "@/assets/product-placeholder.jpg";

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
}

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Card className="group hover:bg-shop-card-hover transition-all duration-300 hover:shadow-lg hover:shadow-shop-accent-glow border-border">
      <CardContent className="p-4">
        <div className="aspect-square overflow-hidden rounded-lg mb-4">
          <img 
            src={product.image || productPlaceholder}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <h3 className="font-semibold text-foreground mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-2xl font-bold text-primary">
          €{product.price.toFixed(2)}
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button 
          className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
          size="sm"
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          In den Warenkorb
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ProductCard;