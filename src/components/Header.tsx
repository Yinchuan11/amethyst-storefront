import { useState } from "react";
import { User, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import CartDrawer from "./CartDrawer";
import AdminLoginDialog from "./AdminLoginDialog";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();
  const { isAdminLoggedIn } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const handleAdminClick = () => {
    if (isAdminLoggedIn) {
      navigate("/admin");
    } else {
      setShowAdminLogin(true);
    }
  };

  const handleLoginSuccess = () => {
    navigate("/admin");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            AmethystShop
          </h1>
        </div>
        
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Produkte suchen..." 
              className="pl-10 bg-muted/50"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
          <CartDrawer />
          <Button 
            variant="outline" 
            size="sm"
            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            onClick={handleAdminClick}
          >
            {isAdminLoggedIn ? "Admin Panel" : "Admin"}
          </Button>
        </div>
      </div>
      
      <AdminLoginDialog
        open={showAdminLogin}
        onOpenChange={setShowAdminLogin}
        onLoginSuccess={handleLoginSuccess}
      />
    </header>
  );
};

export default Header;