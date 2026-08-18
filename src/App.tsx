import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import TransactionPage from "./pages/TransactionPage";
import SubstatePage from "./pages/SubstatePage";
import TemplatesPage from "./pages/TemplatesPage";
import ValidatorsPage from "./pages/ValidatorsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tx/:id" element={<TransactionPage />} />
        <Route path="substate/:id" element={<SubstatePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="validators" element={<ValidatorsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
