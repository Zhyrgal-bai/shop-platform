import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminProductsPage from "./AdminProductsPage";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminProductManagePage from "./AdminProductManagePage";

type AdminAppProps = {
  onExit: () => void;
};

export default function AdminApp({ onExit }: AdminAppProps) {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/orders" replace />} />
        <Route path="/admin" element={<AdminLayout onExit={onExit} />}>
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/manage" element={<AdminProductManagePage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/orders" replace />} />
      </Routes>
    </HashRouter>
  );
}
