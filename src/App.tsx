import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LoadingBlock } from "./components/ui";
import HomePage from "./pages/HomePage";
const TransactionPage = lazy(() => import("./pages/TransactionPage"));
const SubstatePage = lazy(() => import("./pages/SubstatePage"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage"));
const TemplatePage = lazy(() => import("./pages/TemplatePage"));
const ValidatorsPage = lazy(() => import("./pages/ValidatorsPage"));
const L1SupplyPage = lazy(() => import("./pages/L1SupplyPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="tx/:id" element={<TransactionPage />} />
        <Route path="substate/:id" element={<SubstatePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="template/:address" element={<TemplatePage />} />
        <Route path="validators" element={<ValidatorsPage />} />
        <Route path="l1-supply" element={<L1SupplyPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      </Routes>
    </Suspense>
  );
}
