import { NavLink, Route, Routes } from 'react-router-dom';
import ListsPage from './pages/ListsPage';
import ListDetailPage from './pages/ListDetailPage';
import LibraryPage from './pages/LibraryPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">SongFind</div>
          <div className="sidebar-brand-sub">Music Collection</div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Lists
          </NavLink>
          <NavLink to="/library" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Library
          </NavLink>
          <NavLink to="/activity" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Activity
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            Settings
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ListsPage />} />
          <Route path="/lists/:id" element={<ListDetailPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
