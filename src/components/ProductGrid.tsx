import ProductCard from "./ProductCard";

// Beispiel-Produkte (später aus Datenbank)
const sampleProducts = [
  {
    id: "1",
    name: "Premium Kopfhörer",
    price: 199.99,
  },
  {
    id: "2", 
    name: "Gaming Maus",
    price: 79.99,
  },
  {
    id: "3",
    name: "Wireless Tastatur",
    price: 129.99,
  },
  {
    id: "4",
    name: "USB-C Hub",
    price: 59.99,
  },
  {
    id: "5",
    name: "Smartphone Halter",
    price: 24.99,
  },
  {
    id: "6",
    name: "Laptop Stand",
    price: 89.99,
  },
];

const ProductGrid = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-8 text-center">
        Unsere Produkte
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sampleProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;