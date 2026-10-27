import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect, lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import AppLoader from "@/components/AppLoader";
import { handleSessionExpiry, isUnauthorized } from "@/lib/session";

import BuyerLayout from "@/layouts/BuyerLayout";
import SellerLayout from "@/layouts/SellerLayout";
import AdminLayout from "@/layouts/AdminLayout";

// M9: route pages are code-split; each loads on first visit inside its layout.
function lazyPage(factory: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(factory);
  return function LazyPage() {
    return (
      <Suspense fallback={<PageLoading />}>
        <Page />
      </Suspense>
    );
  };
}

function PageLoading() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

const Home = lazyPage(() => import("@/pages/Home"));
const Login = lazyPage(() => import("@/pages/Login"));
const Signup = lazyPage(() => import("@/pages/Signup"));
const ProductDetail = lazyPage(() => import("@/pages/ProductDetail"));
const CategoryBrowse = lazyPage(() => import("@/pages/CategoryBrowse"));
const Cart = lazyPage(() => import("@/pages/Cart"));
const Checkout = lazyPage(() => import("@/pages/Checkout"));
const Orders = lazyPage(() => import("@/pages/Orders"));
const OrderDetail = lazyPage(() => import("@/pages/OrderDetail"));
const Profile = lazyPage(() => import("@/pages/Profile"));
const Wishlist = lazyPage(() => import("@/pages/Wishlist"));
const Credits = lazyPage(() => import("@/pages/Credits"));
const SearchPage = lazyPage(() => import("@/pages/Search"));

const SellerDashboard = lazyPage(() => import("@/pages/seller/Dashboard"));
const SellerProducts = lazyPage(() => import("@/pages/seller/Products"));
const SellerAddProduct = lazyPage(() => import("@/pages/seller/AddProduct"));
const SellerOrders = lazyPage(() => import("@/pages/seller/Orders"));
const SellerAnalytics = lazyPage(() => import("@/pages/seller/Analytics"));
const SellerSettings = lazyPage(() => import("@/pages/seller/Settings"));

const AdminDashboard = lazyPage(() => import("@/pages/admin/Dashboard"));
const AdminUsers = lazyPage(() => import("@/pages/admin/Users"));
const AdminSellers = lazyPage(() => import("@/pages/admin/Sellers"));
const AdminOrders = lazyPage(() => import("@/pages/admin/Orders"));
const AdminProducts = lazyPage(() => import("@/pages/admin/Products"));

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
