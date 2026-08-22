import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";

export default function NotFoundPage() {
  return (
    <div className="fade-up flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-ink-faint">404</p>
      <p className="max-w-md text-sm text-ink-dim">
        This page doesn't exist. If you pasted a hash or address, it may not be a transaction id, substate address, or otl_… wallet address —
        there's no way to tell some shapes apart.
      </p>
      <div className="w-full max-w-md">
        <SearchBar />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
        <Link to="/" className="text-accent hover:text-accent-strong">
          Overview
        </Link>
        <Link to="/events" className="text-accent hover:text-accent-strong">
          Events
        </Link>
        <Link to="/templates" className="text-accent hover:text-accent-strong">
          Templates
        </Link>
        <Link to="/validators" className="text-accent hover:text-accent-strong">
          Validators
        </Link>
      </div>
    </div>
  );
}
