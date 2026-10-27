import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import AppLoader from "@/components/AppLoader";
import { handleSessionExpiry, isUnauthorized } from "@/lib/session";

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
import Credits from "@/pages/Credits";
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
import AdminProducts from "@/pages/admin/Products";

// Inject token into all API calls automatically
setAuthTokenGetter(() => useAuthStore.getState().token);

const queryClient: QueryClient = new QueryClient({
  // M7: any 401 from a request made with a session token logs the user out.
  queryCache: new QueryCache({ onError: (error) => handleSessionExpiry(error, queryClient) }),
  mutationCache: new MutationCache({ onError: (error) => handleSessionExpiry(error, queryClient) }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !isUnauthorized(error) && failureCount < 1,
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

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role ?? "")) {
      return <Redirect to="/" />;
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

      <Route path="/credits">
        <BuyerLayout>
          <Credits />
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

      <Route path="/seller/products/:id/edit">
        <ProtectedRoute role={["seller", "admin"]}>
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

      <Route path="/admin/products">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <AdminProducts />
          </AdminLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/products/:id/edit">
        <ProtectedRoute role="admin">
          <AdminLayout>
            <SellerAddProduct />
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLoader show={loading} />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
