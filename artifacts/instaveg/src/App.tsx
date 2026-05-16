import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import NotFound from "@/pages/not-found";

import BuyerLayout from "@/layouts/BuyerLayout";
import SellerLayout from "@/layouts/SellerLayout";
import AdminLayout from "@/layouts/AdminLayout";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ProductDetail from "@/pages/ProductDetail";
import CategoryBrowse from "@/pages/CategoryBrowse";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import Wishlist from "@/pages/Wishlist";
import SearchPage from "@/pages/Search";

import SellerDashboard from "@/pages/seller/Dashboard";
import SellerProducts from "@/pages/seller/Products";
import SellerAddProduct from "@/pages/seller/AddProduct";
import SellerOrders from "@/pages/seller/Orders";
import SellerAnalytics from "@/pages/seller/Analytics";
import SellerSettings from "@/pages/seller/Settings";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminSellers from "@/pages/admin/Sellers";
import AdminOrders from "@/pages/admin/Orders";

// Inject token into all API calls automatically
setAuthTokenGetter(() => useAuthStore.getState().token);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: string | string[];
}) {
  const { user } = useAuthStore();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/login");
    return null;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role ?? "")) {
      setLocation("/");
      return null;
    }
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/">
        <BuyerLayout>
          <Home />
        </BuyerLayout>
      </Route>

      <Route path="/login">
        <Login />
      </Route>

      <Route path="/signup">
        <Signup />
      </Route>

      <Route path="/search">
        <BuyerLayout>
          <SearchPage />
        </BuyerLayout>
      </Route>

      <Route path="/product/:id">
        {(params) => (
          <BuyerLayout>
            <ProductDetail />
          </BuyerLayout>
        )}
      </Route>

      <Route path="/category/:slug">
        {(params) => (
          <BuyerLayout>
            <CategoryBrowse />
          </BuyerLayout>
        )}
      </Route>

      {/* Buyer Routes */}
      <Route path="/cart">
        <BuyerLayout>
          <Cart />
        </BuyerLayout>
      </Route>

      <Route path="/checkout">
        <BuyerLayout>
          <ProtectedRoute role="buyer">
            <Checkout />
          </ProtectedRoute>
        </BuyerLayout>
      </Route>

      <Route path="/orders">
        <BuyerLayout>
          <ProtectedRoute role="buyer">
            <Orders />
          </ProtectedRoute>
        </BuyerLayout>
      </Route>

      <Route path="/orders/:id">
        {(params) => (
          <BuyerLayout>
            <ProtectedRoute role="buyer">
              <OrderDetail />
            </ProtectedRoute>
          </BuyerLayout>
        )}
      </Route>

      <Route path="/profile">
        <BuyerLayout>
          <Profile />
        </BuyerLayout>
      </Route>

      <Route path="/wishlist">
        <BuyerLayout>
          <ProtectedRoute role="buyer">
            <Wishlist />
          </ProtectedRoute>
        </BuyerLayout>
      </Route>

      {/* Seller Routes */}
      <Route path="/seller/dashboard">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerDashboard />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/seller/products">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerProducts />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/seller/add-product">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerAddProduct />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/seller/orders">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerOrders />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/seller/analytics">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerAnalytics />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/seller/settings">
        <ProtectedRoute role="seller">
          <SellerLayout>
            <SellerSettings />
          </SellerLayout>
        </ProtectedRoute>
      </Route>

      {/* Admin Routes */}
      <Route path="/admin">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/users">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <AdminUsers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/sellers">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <AdminSellers />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/orders">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <AdminOrders />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route>
        <BuyerLayout>
          <NotFound />
        </BuyerLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
