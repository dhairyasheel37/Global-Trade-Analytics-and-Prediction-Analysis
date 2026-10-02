import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TradeAnalysisPage } from "./pages/TradeAnalysisPage";
import { CountryAnalysisPage } from "./pages/CountryAnalysisPage";
import { CountryComparisonPage } from "./pages/CountryComparisonPage";
import { ProductAnalysisPage } from "./pages/ProductAnalysisPage";
import { TradeBalancePage } from "./pages/TradeBalancePage";
import { PredictionPage } from "./pages/PredictionPage";
import { AdminPage } from "./pages/AdminPage";
import { DataManagementPage } from "./pages/DataManagementPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AboutPage } from "./pages/AboutPage";
import { GlobalMapPage } from "./pages/GlobalMapPage";
import { EconomicMetricsPage } from "./pages/EconomicMetricsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes wrapped in AppLayout */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Phase 3 Dashboard */}
            <Route path="/" element={<DashboardPage />} />

            {/* Interactive Global Trade Map */}
            <Route path="/map" element={<GlobalMapPage />} />

            {/* Phase 4 Trade Flow Analysis */}
            <Route path="/trade-analysis" element={<TradeAnalysisPage />} />

            {/* Phase 5 Country Profile Analysis */}
            <Route path="/country-analysis" element={<CountryAnalysisPage />} />

            {/* Country Comparison Module */}
            <Route path="/country-comparison" element={<CountryComparisonPage />} />

            {/* Phase 6 Product & Commodity Analysis */}
            <Route path="/product-analysis" element={<ProductAnalysisPage />} />

            {/* Phase 7 Trade Balance Breakdown */}
            <Route path="/trade-balance" element={<TradeBalancePage />} />

            {/* Phase 14 Economic Metrics & Indices */}
            <Route path="/economic-metrics" element={<EconomicMetricsPage />} />

            {/* Phase 8 Machine Learning Trade Prediction Engine */}
            <Route path="/prediction" element={<PredictionPage />} />

            {/* Admin Console Route */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />

            {/* Placeholder Roadmap Modules */}
            <Route
              path="/data-management"
              element={
                <AdminRoute>
                  <DataManagementPage />
                </AdminRoute>
              }
            />
            <Route
              path="/reports"
              element={<ReportsPage />}
            />
            <Route
              path="/about"
              element={<AboutPage />}
            />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
