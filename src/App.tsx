import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import TransactionPage from "./pages/TransactionPage";
import SubstatePage from "./pages/SubstatePage";
import TemplatesPage from "./pages/TemplatesPage";
import TemplatePage from "./pages/TemplatePage";
import ValidatorsPage from "./pages/ValidatorsPage";
import L1SupplyPage from "./pages/L1SupplyPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tx/:id" element={<TransactionPage />} />
        <Route path="substate/:id" element={<SubstatePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="template/:address" element={<TemplatePage />} />
        <Route path="validators" element={<ValidatorsPage />} />
        <Route path="l1-supply" element={<L1SupplyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
