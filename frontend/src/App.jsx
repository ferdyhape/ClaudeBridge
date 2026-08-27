import { HashRouter, Routes, Route } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Account from "./pages/Account";
import Docs from "./pages/Docs";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Account />} />
          <Route path="docs" element={<Docs />} />
          <Route path="*" element={<Account />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
