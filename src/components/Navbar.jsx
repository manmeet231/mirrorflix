import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import './Navbar.css';

const Navbar = ({ searchQuery, onSearchChange }) => {
  const { user, logout, requestLogin } = useAuth();
  const searchInput = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState('Home');

  const clearSearch = () => {
    onSearchChange('');
    searchInput.current?.focus();
  };

  const handleScroll = () => {
    setScrolled(window.scrollY > 50);
  };

  const handleNavClick = (navItem) => {
    setActiveNav(navItem);
    if (navItem === 'Home') onSearchChange('');
  };

  useEffect(() => {
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [];

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-left">
        <div className="navbar-logo">ALTERBUCKET</div>
        <div className="navbar-center">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-pill ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="navbar-right">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <div className="search-bar">
          <input
            ref={searchInput}
            type="text"
            placeholder="Titles, people, genres"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clearSearch();
              }
            }}
          />
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        <button
          type="button"
          className={`navbar-login ${user ? 'is-authenticated' : ''}`}
          onClick={user ? logout : requestLogin}
          aria-label={user ? `Log out ${user.username}` : 'Log in'}
        >
          {user ? <><span className="navbar-user-dot" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span><span>{user.username}</span><small>Log out</small></> : 'Log in'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
