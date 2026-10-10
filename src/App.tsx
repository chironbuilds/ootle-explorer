import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import HomePage from "./pages/HomePage";
import NotFoundPage from "./pages/NotFoundPage";
const loadTransactionPage = () => import("./pages/TransactionPage");
const loadSubstatePage = () => import("./pages/SubstatePage");
const loadTemplatesPage = () => import("./pages/TemplatesPage");
const loadTemplatePage = () => import("./pages/TemplatePage");
const loadValidatorsPage = () => import("./pages/ValidatorsPage");
const loadL1SupplyPage = () => import("./pages/L1SupplyPage");
const loadEventsPage = () => import("./pages/EventsPage");

/** Fetches every page chunk during idle time so navigating anywhere after first paint is instant
 * instead of waiting on a network round trip for the page's code. */
export function preloadRoutes() {
  const loaders = [
    loadTransactionPage,
    loadSubstatePage,
    loadTemplatesPage,
    loadTemplatePage,
    loadValidatorsPage,
    loadL1SupplyPage,
    loadEventsPage,
  ];
  for (const load of loaders) void load();
}

const TransactionPage = lazy(loadTransactionPage);
const SubstatePage = lazy(loadSubstatePage);
const TemplatesPage = lazy(loadTemplatesPage);
const TemplatePage = lazy(loadTemplatePage);
const ValidatorsPage = lazy(loadValidatorsPage);
const L1SupplyPage = lazy(loadL1SupplyPage);
const EventsPage = lazy(loadEventsPage);

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
        <Route path="events" element={<EventsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
