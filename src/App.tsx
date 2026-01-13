import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import DownloadPage from "@/pages/DownloadPage";
import NotFound from "@/pages/NotFound";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminMultitracks from "@/pages/admin/AdminMultitracks";
import AdminSales from "@/pages/admin/AdminSales";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          </Route>

          {/* Download page (no layout) */}
          <Route path="/download/:token" element={<DownloadPage />} />

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="multitracks" element={<AdminMultitracks />} />
            <Route path="sales" element={<AdminSales />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
