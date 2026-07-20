import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CartProvider } from "@/contexts/CartContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Layouts
import { PublicLayout } from "@/layouts/PublicLayout";
import { AdminLayout } from "@/layouts/AdminLayout";

// Public pages
import Home from "@/pages/Home";
import Catalog from "@/pages/Catalog";
import MultitrackDetails from "@/pages/MultitrackDetails";
import Checkout from "@/pages/Checkout";
import Kits from "@/pages/Kits";
import KitDetails from "@/pages/KitDetails";
import KitCheckout from "@/pages/KitCheckout";
import Cart from "@/pages/Cart";
import CartCheckout from "@/pages/CartCheckout";
import DownloadPage from "@/pages/DownloadPage";
import NotFound from "@/pages/NotFound";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminMultitracks from "@/pages/admin/AdminMultitracks";
import AdminSales from "@/pages/admin/AdminSales";
import AdminAdministrators from "@/pages/admin/AdminAdministrators";
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminFinancial from "@/pages/admin/AdminFinancial";
import AdminBundles from "@/pages/admin/AdminBundles";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminFunnel from "@/pages/admin/AdminFunnel";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <CartProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/multitrack/:id" element={<MultitrackDetails />} />
            <Route path="/checkout/:id" element={<Checkout />} />
            <Route path="/kits" element={<Kits />} />
            <Route path="/kit/:id" element={<KitDetails />} />
            <Route path="/checkout/kit/:id" element={<KitCheckout />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<CartCheckout />} />
          </Route>

          {/* Download page (no layout) */}
          <Route path="/download/:token" element={<DownloadPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="multitracks" element={<AdminMultitracks />} />
            <Route path="sales" element={<AdminSales />} />
            <Route path="administrators" element={<AdminAdministrators />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="financial" element={<AdminFinancial />} />
            <Route path="bundles" element={<AdminBundles />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="funnel" element={<AdminFunnel />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
