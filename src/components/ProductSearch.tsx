import { useState, useMemo } from "react";

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
}

interface ProductSearchProps {
  products: Product[];
  searchQuery: string;
  children: (filteredProducts: Product[]) => React.ReactNode;
}

const ProductSearch = ({ products, searchQuery, children }: ProductSearchProps) => {
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return products;
    }
    
    return products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  return <>{children(filteredProducts)}</>;
};

export default ProductSearch;