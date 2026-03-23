import { Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import ProjectShell from "./pages/ProjectShell";
import DashboardPage from "./pages/DashboardPage";
import StagesPage from "./pages/StagesPage";
import EntriesPage from "./pages/EntriesPage";
import FinancialSection from "./pages/FinancialSection";
import FinancialPanelPage from "./pages/FinancialPanelPage";
import FinancialPhysicalComparisonPage from "./pages/FinancialPhysicalComparisonPage";
import FinancialPlanningPage from "./pages/FinancialPlanningPage";
import FinancialProductivityPage from "./pages/FinancialProductivityPage";
import FinancialTeamsPage from "./pages/FinancialTeamsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin/usuarios" element={<AdminUsersPage />} />
        <Route path="/projeto/:id" element={<ProjectShell />}>
          <Route index element={<Navigate to="painel" replace />} />
          <Route path="painel" element={<DashboardPage />} />
          <Route path="etapas" element={<StagesPage />} />
          <Route path="lancamentos" element={<EntriesPage />} />
          <Route path="financeiro" element={<FinancialSection />}>
            <Route index element={<FinancialPanelPage />} />
            <Route path="comparativo" element={<FinancialPhysicalComparisonPage />} />
            <Route path="equipes" element={<FinancialTeamsPage />} />
            <Route path="planejamento" element={<FinancialPlanningPage />} />
            <Route path="produtividade" element={<FinancialProductivityPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
